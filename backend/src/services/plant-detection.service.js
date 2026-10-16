import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { env } from "../config/env.js";
import { HttpError } from "../utils/http-error.js";
import { saveImage, readImage, deleteImage } from "../utils/upload.js";
import { validateImageFile } from "../validators/detection.validator.js";
import { todayWib } from "../validators/season.validator.js";
import { rupiahToJt, expenseCategoryFor } from "../utils/detection-cost.js";
import { detectionService } from "./detection/index.js";
import { solutionService } from "./solution.service.js";

// [REVISI] Deteksi kualitas tanaman (sub-langkah 3): orkestrasi alur API. Semua akses data lewat farm: { userId };
// milik orang lain dijawab 404. Tidak ada hasil simulasi: galat AI diteruskan apa adanya (pesan Indonesia).
const FARM_NOT_FOUND = "Lahan tidak ditemukan";
const DET_NOT_FOUND = "Hasil deteksi tidak ditemukan";
export const NO_SEASON_MESSAGE = "Lahan ini belum punya musim tanam yang aktif. Buat musim tanam dulu agar hasil bisa disimpan ke Catatan.";
export const NO_COST_MESSAGE = "Hasil ini tidak punya estimasi biaya, jadi tidak bisa disimpan ke Catatan.";
export const ALREADY_MESSAGE = "Hasil deteksi ini sudah disimpan ke Catatan.";
const MAX_NOTE_EXPENSE = 500;

const PHASE = { DRAFT: "persiapan", PEMBIAYAAN: "pembiayaan", TANAM: "tanam", PANEN: "panen" };

/** Musim aktif lahan = musim yang belum SELESAI (satu lahan paling banyak satu, lihat season.service). */
async function activeSeason(db, farmId) {
  return db.season.findFirst({
    where: { farmId, status: { not: "SELESAI" } },
    orderBy: { id: "desc" },
    select: { id: true, crop: true, areaHa: true, status: true, plantedOn: true },
  });
}

function weekOf(plantedOn, now) {
  if (!plantedOn) return null;
  const days = Math.floor((todayWib(now).getTime() - new Date(plantedOn).getTime()) / 86_400_000);
  return days < 0 ? null : Math.floor(days / 7) + 1;
}

/** Konteks lahan untuk AI: hanya yang diketahui; yang kosong dibiarkan kosong (tidak ditebak). */
export function buildLandContext(farm, season, now = new Date()) {
  // [REVISI] kode negara ikut bila bukan "ID"
  const lokasi = [farm.village, farm.subdistrict, farm.province, farm.country && farm.country !== "ID" ? farm.country : null].filter(Boolean).join(", ");
  return {
    komoditas: season ? String(season.crop).toLowerCase() : null,
    luasHa: season?.areaHa != null ? String(season.areaHa) : farm.areaHa != null ? String(farm.areaHa) : null,
    lokasi: lokasi || null,
    fase: season ? PHASE[season.status] ?? null : null,
    mingguKe: season ? weekOf(season.plantedOn, now) : null,
  };
}

/** Nilai tengah rentang (juta Rupiah, 3 desimal) dari costMinJt/costMaxJt; null bila tidak ada rentang. */
export function midpointJt(minJt, maxJt) {
  if (minJt == null || maxJt == null) return null;
  return new Prisma.Decimal(minJt).plus(new Prisma.Decimal(maxJt)).div(2).toDecimalPlaces(3, Prisma.Decimal.ROUND_HALF_UP);
}

/** Dapat tidaknya hasil disimpan ke Catatan, beserta alasan bila tidak (untuk tombol nonaktif di frontend). */
export function noteState(row, season) {
  if (row.expenseId) return { tersedia: false, sudah_disimpan: true, alasan: ALREADY_MESSAGE };
  if (row.status !== "SELESAI" || !row.solution) return { tersedia: false, sudah_disimpan: false, alasan: NO_COST_MESSAGE };
  const mid = midpointJt(row.costMinJt, row.costMaxJt);
  if (!mid || !mid.gt(0)) return { tersedia: false, sudah_disimpan: false, alasan: NO_COST_MESSAGE };
  if (!season) return { tersedia: false, sudah_disimpan: false, alasan: NO_SEASON_MESSAGE };
  return { tersedia: true, sudah_disimpan: false, alasan: null };
}

/** Bentuk respons. Kunci foto di disk tidak pernah keluar; foto diambil lewat /:id/foto. */
export function toView(row, season = undefined) {
  const det = row.detection ?? {};
  const noteInfo = season === undefined ? { sudah_disimpan: Boolean(row.expenseId) } : noteState(row, season);
  return {
    id: row.id,
    lahan_id: row.farmId,
    status: row.status,
    alasan: det.alasan ?? null,
    pesan: det.pesan ?? null,
    provider: row.provider,
    catatan: row.note,
    dibuat_pada: row.createdAt,
    foto_url: `/api/deteksi-tanaman/${row.id}/foto`,
    hasil: det.hasil ?? null,
    sumber_deteksi: det.sumber ? { provider: det.sumber.provider, model_versi: det.sumber.model_versi ?? null } : null, // [REVISI] opsional
    solusi: row.solution ?? null,
    biaya_jt: row.costMinJt != null && row.costMaxJt != null ? { min: row.costMinJt, max: row.costMaxJt } : null,
    ke_catatan: { ...noteInfo, expense_id: row.expenseId ?? null },
  };
}

export function createPlantDetectionService({ db = prisma, detector = detectionService, solver = solutionService, storage = { save: saveImage, read: readImage, remove: deleteImage }, config = env, now = () => new Date() } = {}) {
  async function ownedFarm(userId, farmId) {
    const farm = await db.farm.findFirst({ where: { id: farmId, userId } });
    if (!farm) throw new HttpError(404, FARM_NOT_FOUND);
    return farm;
  }
  async function ownedDetection(userId, id) {
    const row = await db.plantDetection.findFirst({ where: { id: String(id), userId, farm: { userId } } });
    if (!row) throw new HttpError(404, DET_NOT_FOUND);
    return row;
  }

  return {
    /** input: { userId, file (hasil multer), lahanId, catatan, lang } */
    async create({ userId, file, lahanId, catatan, lang = "id" }) {
      const { mime, ext } = validateImageFile(file, config.detectionMaxBytes);
      const farm = await ownedFarm(userId, lahanId); // cek kepemilikan sebelum apa pun disimpan atau dikirim ke AI
      const season = await activeSeason(db, farm.id);
      const land = buildLandContext(farm, season, now());

      const photoKey = await storage.save(file.buffer, ext);
      try {
        const det = await detector.detect(file.buffer, mime, { komoditas: land.komoditas, lang });
        // [REVISI] sumber = { provider, model_versi, kelas, ... } disimpan di JSON yang sudah ada (tanpa kolom baru)
        const detection = { hasil: det.hasil, alasan: det.alasan, pesan: det.pesan, sumber: det.sumber ?? { provider: det.provider } };
        const base = { userId, farmId: farm.id, photoKey, photoMime: mime, note: catatan ?? null, provider: det.provider, detection };

        if (det.status === "TIDAK_YAKIN") {
          // Tanpa solutionService: tidak ada saran dan biaya dari foto yang tidak meyakinkan.
          const row = await db.plantDetection.create({ data: { ...base, status: "TIDAK_YAKIN", costMinJt: null, costMaxJt: null } });
          return toView(row, season);
        }

        const coords = farm.latitude != null && farm.longitude != null ? { lat: farm.latitude, lon: farm.longitude } : undefined;
        const solusi = await solver.generate({ detection: det.hasil, land, coords, catatan, sumber: det.sumber, lang });
        const row = await db.plantDetection.create({
          data: {
            ...base,
            status: "SELESAI",
            solution: solusi,
            costMinJt: rupiahToJt(solusi.estimasi_total_biaya.min, "down"), // Rupiah penuh -> juta Rupiah
            costMaxJt: rupiahToJt(solusi.estimasi_total_biaya.max, "up"),
          },
        });
        return toView(row, season);
      } catch (err) {
        await storage.remove(photoKey); // analisis/penyimpanan gagal: jangan tinggalkan foto yatim
        throw err;
      }
    },

    async list({ userId, lahanId, page = 1, limit = 10 }) {
      const farm = await ownedFarm(userId, lahanId);
      const where = { farmId: farm.id, userId };
      const [total, rows] = await Promise.all([
        db.plantDetection.count({ where }),
        db.plantDetection.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * limit, take: limit }),
      ]);
      return { data: rows.map((r) => toView(r)), page, limit, total, total_halaman: Math.max(1, Math.ceil(total / limit)) };
    },

    async get({ userId, id }) {
      const row = await ownedDetection(userId, id);
      return toView(row, await activeSeason(db, row.farmId));
    },

    async photo({ userId, id }) {
      const row = await ownedDetection(userId, id);
      return { buffer: await storage.read(row.photoKey), mime: row.photoMime };
    },

    /** Membuat Expense di musim aktif lahan: kategori dari jenis bahan, jumlah = nilai tengah rentang (juta Rupiah). Sekali per deteksi. */
    async toNote({ userId, id }) {
      const row = await ownedDetection(userId, id);
      if (row.expenseId) throw new HttpError(409, ALREADY_MESSAGE);
      if (row.status !== "SELESAI" || !row.solution) throw new HttpError(409, NO_COST_MESSAGE);
      const amountJt = midpointJt(row.costMinJt, row.costMaxJt);
      if (!amountJt || !amountJt.gt(0)) throw new HttpError(409, NO_COST_MESSAGE);
      const season = await activeSeason(db, row.farmId);
      if (!season) throw new HttpError(409, NO_SEASON_MESSAGE);

      const kategori = expenseCategoryFor(row.solution.bahan_dan_alat).kategori;
      const kondisi = row.detection?.hasil?.kondisi ?? "";
      const note = `Estimasi dari deteksi tanaman: ${kondisi}`.slice(0, MAX_NOTE_EXPENSE);
      return db.$transaction(async (tx) => {
        const expense = await tx.expense.create({ data: { seasonId: season.id, category: kategori, amountJt, spentOn: todayWib(now()), note } });
        // Klaim atomik: hanya satu permintaan yang menang; yang kalah membatalkan transaksi (Expense ikut batal).
        const claim = await tx.plantDetection.updateMany({ where: { id: row.id, userId, expenseId: null }, data: { expenseId: expense.id } });
        if (claim.count !== 1) throw new HttpError(409, ALREADY_MESSAGE);
        return { expense_id: expense.id, musim_id: season.id, kategori: expense.category, jumlah_jt: expense.amountJt, tanggal: expense.spentOn, catatan: expense.note };
      });
    },
  };
}

export const plantDetectionService = createPlantDetectionService();
