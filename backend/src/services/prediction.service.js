import { Prisma } from "@prisma/client";
import { z } from "zod"; // [REVISI] 18.6
import { prisma } from "../config/prisma.js";
import { farmObject } from "../validators/farm.validator.js";
import { HttpError } from "../utils/http-error.js";
import { engineCost, engineLeaf } from "./engine.service.js";
import { toEngineInput, checkLeafCrop } from "../utils/engine-input.js";
import { planView } from "../utils/money-gate.js"; // [REVISI] 18.11b

// [REVISI] 18.5: aturan capitalJt dipakai ulang dari farmObject (Decimal tidak negatif, maks 2 desimal; null = kosong).
const capitalSchema = farmObject.shape.capitalJt;

/** Musim harus milik pengguna yang login; selain itu dijawab 404 (tidak membocorkan keberadaannya). */
async function ownedSeason(userId, seasonId) {
  const season = await prisma.season.findFirst({ where: { id: seasonId, farm: { userId } }, include: { farm: true } });
  if (!season) throw new HttpError(404, "Musim tidak ditemukan");
  return season;
}

async function runCost(season, body) {
  const input = toEngineInput({
    farm: season.farm, season, weather: body.weather, indices: body.indices, startMonth: body.startMonth,
  });
  const output = await engineCost(input);
  return { input, output, modelVersion: `${output.models.season} + ${output.models.weekly}` };
}

/** Prediksi biasa (misalnya skenario "bagaimana kalau"). Dicatat di prediction_logs, tidak mengubah musim. */
export async function predictCost(userId, seasonId, body = {}) {
  const season = await ownedSeason(userId, seasonId); // 404 (bukan milik / tidak ada) menang atas 409
  // [REVISI] 18.11c: gerbang uang (Q5). Saat DRAFT tidak ada angka prediksi; cek SEBELUM engine dipanggil dan sebelum log ditulis.
  if (season.status === "DRAFT") throw new HttpError(409, "Prediksi hanya untuk musim yang pembiayaannya sudah dimulai");
  const { input, output, modelVersion } = await runCost(season, body);
  await prisma.predictionLog.create({ data: { seasonId, input, output, modelVersion } });
  return output;
}

/** Tombol Mulai: hitung, simpan potret rencana biaya (CostPlan), dan ubah status musim. */
// [REVISI] 18.5: capitalJt opsional (tidak dikirim -> Season.capitalJt; null -> kosong, tidak ditebak).
// Decimal, bukan Number. Masukan engine disimpan di CostPlan.input. breakEvenPerKg tetap null (Q10).
// Hanya dari DRAFT; financingStoppedAt dikosongkan.
export async function startFinancing(userId, seasonId, body = {}) {
  const sent = body.capitalJt !== undefined;
  const parsed = capitalSchema.safeParse(body.capitalJt);
  if (sent && !parsed.success) throw new HttpError(400, parsed.error.issues.map((i) => i.message).join("; "));

  const season = await ownedSeason(userId, seasonId);
  if (season.status !== "DRAFT") throw new HttpError(409, "Pembiayaan sudah dimulai untuk musim ini");
  const capital = sent ? parsed.data : season.capitalJt;
  const capitalDec = capital == null ? null : new Prisma.Decimal(capital);

  const { input, output, modelVersion } = await runCost(season, body);
  const { low, mid, high } = output.total_jt;
  const midDec = new Prisma.Decimal(mid);
  // Modal kosong: kekurangan tidak bisa dihitung; kolom wajib diisi 0 (bukan perkiraan).
  const shortfall = capitalDec == null ? new Prisma.Decimal(0) : Prisma.Decimal.max(0, midDec.minus(capitalDec));

  const plan = await prisma.$transaction(async (tx) => {
    const moved = await tx.season.updateMany({
      where: { id: seasonId, status: "DRAFT" },
      data: { status: "PEMBIAYAAN", financingStartedAt: new Date(), financingStoppedAt: null, ...(sent ? { capitalJt: capitalDec } : {}) },
    });
    if (moved.count !== 1) throw new HttpError(409, "Pembiayaan sudah dimulai untuk musim ini");
    await tx.predictionLog.create({ data: { seasonId, input, output, modelVersion } });
    return tx.costPlan.create({
      data: {
        seasonId, kind: "AWAL", totalJt: midDec, p10Jt: low, p50Jt: mid, p90Jt: high, capitalJt: capitalDec,
        shortfallJt: shortfall, breakEvenPerKg: null, weeklyJt: output.weekly, input, modelVersion,
      },
    });
  });
  return { plan: planView(plan), output }; // [REVISI] 18.11b: kolom `input` (masukan engine) tidak dikirim ke klien
}

// [REVISI] 18.6: hitung ulang rencana biaya. Kunci body = yang dipakai start-financing.
const num = z.number().finite();
const recalcSchema = z.strictObject(
  {
    weather: z.strictObject({ rainAvgMm: num, heavyRainWks: num, tempMaxAvg: num }).partial(),
    indices: z.strictObject({ fertIndex: num, wageIndex: num, pestIndex: num }).partial(),
    startMonth: z.number().int().min(1).max(12),
    capitalJt: capitalSchema,
  },
  { error: (iss) => (iss.code === "unrecognized_keys" ? `Isian tidak dikenal: ${iss.keys.join(", ")}` : undefined) },
).partial();

const WEATHER_MAP = { rainAvgMm: "hujan_mm_rata_per_minggu", heavyRainWks: "minggu_hujan_lebat", tempMaxAvg: "suhu_maks_rata" };
const INDEX_MAP = { fertIndex: "indeks_harga_pupuk", wageIndex: "indeks_upah", pestIndex: "indeks_harga_pestisida" };

/** Hitung ulang: CostPlan baru kind HITUNG_ULANG, bendera needsRecalc lama dimatikan, selisih terhadap AWAL. */
export async function recalcCost(userId, seasonId, rawBody = {}) {
  const r = recalcSchema.safeParse(rawBody ?? {});
  if (!r.success) throw new HttpError(400, r.error.issues.map((i) => i.message).join("; "));
  const body = r.data;

  const season = await ownedSeason(userId, seasonId);
  if (!["PEMBIAYAAN", "TANAM"].includes(season.status)) {
    throw new HttpError(409, "Hitung ulang hanya untuk musim berstatus PEMBIAYAAN atau TANAM");
  }
  const latest = await prisma.costPlan.findFirst({ where: { seasonId }, orderBy: { createdAt: "desc" } });
  const stored = latest?.input && typeof latest.input === "object" ? latest.input : null;
  const hasStored = stored && Object.keys(stored).length > 0;

  let input;
  if (hasStored) {
    // areaHa dan crop dari Season terkini (sumber tunggal), bukan dari masukan lama.
    input = { ...stored, komoditas: String(season.crop).toLowerCase(), luas_ha: Number(season.areaHa) };
    for (const [k, v] of Object.entries(body.weather ?? {})) input[WEATHER_MAP[k]] = v;
    for (const [k, v] of Object.entries(body.indices ?? {})) input[INDEX_MAP[k]] = v;
    if (body.startMonth !== undefined) input.bulan_tanam = body.startMonth;
  } else {
    try {
      input = toEngineInput({ farm: season.farm, season, weather: body.weather, indices: body.indices, startMonth: body.startMonth });
    } catch (e) {
      if (e instanceof HttpError && e.status === 400) {
        throw new HttpError(409, `Tidak ada masukan prediksi sebelumnya dan isian di body belum lengkap. ${e.message}`);
      }
      throw e;
    }
  }

  const capitalSent = body.capitalJt !== undefined;
  const capital = capitalSent ? body.capitalJt : season.capitalJt;
  const capitalDec = capital == null ? null : new Prisma.Decimal(capital);

  const output = await engineCost(input);
  const { low, mid, high } = output.total_jt;
  const midDec = new Prisma.Decimal(mid);
  const shortfall = capitalDec == null ? new Prisma.Decimal(0) : Prisma.Decimal.max(0, midDec.minus(capitalDec));
  const modelVersion = `${output.models.season} + ${output.models.weekly}`;

  const plan = await prisma.$transaction(async (tx) => {
    if (capitalSent) await tx.season.update({ where: { id: seasonId }, data: { capitalJt: capitalDec } });
    if (latest) await tx.costPlan.update({ where: { id: latest.id }, data: { needsRecalc: false } });
    await tx.predictionLog.create({ data: { seasonId, input, output, modelVersion } });
    return tx.costPlan.create({
      data: {
        seasonId, kind: "HITUNG_ULANG", totalJt: midDec, p10Jt: low, p50Jt: mid, p90Jt: high, capitalJt: capitalDec,
        shortfallJt: shortfall, breakEvenPerKg: null, weeklyJt: output.weekly, input, modelVersion, needsRecalc: false,
      },
    });
  });

  const awal = await prisma.costPlan.findFirst({ where: { seasonId, kind: "AWAL" }, orderBy: { createdAt: "desc" } });
  const diff = (a, b) => new Prisma.Decimal(a).minus(b);
  const selisih = awal
    ? {
        totalJt: diff(plan.totalJt, awal.totalJt), p10Jt: diff(plan.p10Jt, awal.p10Jt), p50Jt: diff(plan.p50Jt, awal.p50Jt),
        p90Jt: diff(plan.p90Jt, awal.p90Jt), shortfallJt: diff(plan.shortfallJt, awal.shortfallJt),
      }
    : null;
  return { plan: planView(plan), output, selisih }; // [REVISI] 18.11b: tanpa `input`
}

/** Kualitas tanaman dari foto daun. Foto tidak disimpan di sini (hanya dikirim ke engine). */
export async function predictLeaf({ imageBase64, crop }) {
  const b64 = String(imageBase64 ?? "").replace(/^data:image\/[a-z+]+;base64,/i, "");
  if (b64.length < 100) throw new HttpError(400, "Foto tidak valid");
  if (b64.length > 7_000_000) throw new HttpError(413, "Foto terlalu besar (maksimal sekitar 5 MB)");
  if (crop != null && !["CABAI", "TOMAT"].includes(crop)) throw new HttpError(400, "Tanaman harus CABAI atau TOMAT");
  return checkLeafCrop(await engineLeaf(b64), crop);
}