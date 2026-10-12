import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client"; // [REVISI] 18.8
import { prisma } from "../config/prisma.js";
import { HttpError } from "../utils/http-error.js";
import { mismatchOver30 } from "./harvest.service.js"; // [REVISI] 18.10

const DURATION = { CABAI: 16, TOMAT: 14, BAWANG: 10 };
const WEEK_MS = 7 * 86_400_000;

/** Jumlahkan catatan per minggu musim. Catatan simulasi tidak dihitung. */
// [REVISI] 18.8: penjumlahan dan rasio memakai Prisma.Decimal (tanpa galat floating point). Aturan 90-110 persen dan
// penjepit minggu tidak berubah. Hasil diubah ke angka hanya di batas keluaran agar kontrak lama (dan tesnya) tetap.
export function weeklyFromExpenses(expenses, start, durationWks, totalJt) {
  const sums = Array.from({ length: durationWks }, () => new Prisma.Decimal(0));
  let counted = new Prisma.Decimal(0);
  for (const e of expenses) {
    if (e.simulated) continue;
    const wk = Math.floor((e.spentOn.getTime() - start.getTime()) / WEEK_MS) + 1;
    const idx = Math.min(durationWks, Math.max(1, wk)); // sebelum musim -> minggu 1, sesudah -> terakhir
    const v = new Prisma.Decimal(e.amountJt);
    sums[idx - 1] = sums[idx - 1].plus(v);
    counted = counted.plus(v);
  }
  const total = new Prisma.Decimal(totalJt);
  const ratio = total.gt(0) ? counted.div(total) : new Prisma.Decimal(0);
  const usable = ratio.gte("0.9") && ratio.lte("1.1"); // aturan 90-110 persen
  return { weekly: usable ? sums.map((s) => s.toNumber()) : null, ratio: ratio.toNumber() };
}

const CROP_NAME = { CABAI: "Cabai merah", BAWANG: "Bawang merah", TOMAT: "Tomat" };
const D = (v) => new Prisma.Decimal(v);
const isoDate = (d) => d.toISOString().slice(0, 10);

// [REVISI] 18.10: tutup musim (F5 langkah 3, docs/03 bagian 8). Ganti findFirstOrThrow (P2025 -> 500) dengan 404 eksplisit,
// wajib status PANEN (selain itu 409), urutan validasi persis docs/03, updateMany bersyarat (tutup dua kali 409),
// isi yieldKg/pricePerKg/label/note, dan hitung untung/rugi dengan Decimal. Logika kualitas dan biaya mingguan tetap.
export async function closeSeason(userId, seasonId, input) {
  try {
    return await prisma.$transaction((tx) => closeInTx(tx, userId, seasonId, input));
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new HttpError(409, "Musim ini sudah ditutup");
    throw e;
  }
}

async function closeInTx(tx, userId, seasonId, input) {
  // [REVISI] 18.11b: relasi dibaca BERURUTAN. `include` banyak relasi di dalam transaksi membuat Prisma menjalankan
  // query bersamaan pada satu koneksi pg -> DeprecationWarning "client.query() while already executing". Hasil sama.
  const season = await tx.season.findFirst({
    where: { id: seasonId, farm: { userId } },
    include: { farm: true },
  });
  if (!season) throw new HttpError(404, "Musim tidak ditemukan");
  season.expenses = await tx.expense.findMany({ where: { seasonId } });
  season.harvests = await tx.harvest.findMany({ where: { seasonId } });
  season.sample = await tx.harvestSample.findUnique({ where: { seasonId } });
  if (season.status !== "PANEN") throw new HttpError(409, "Musim hanya bisa ditutup saat status PANEN");
  if (!season.plantedOn) throw new HttpError(409, "Penanaman belum dimulai");

  // Urutan dan pesan persis docs/03 bagian 8 (finishHv).
  if (season.harvests.length === 0) throw new HttpError(400, "Tambahkan minimal satu hasil panen");
  if (!season.sample || D(season.sample.sampleKg).lte(0) || D(season.sample.sampleM2).lte(0)) {
    throw new HttpError(400, "Isi berat dan luas petak sampel panen");
  }
  if ((await tx.photo.count({ where: { seasonId, kind: "SAMPEL" } })) === 0) {
    throw new HttpError(400, "Tambahkan minimal satu foto bukti sampel panen");
  }
  const raw = input.totalCostJt === undefined ? "" : String(input.totalCostJt).trim();
  if (raw !== "" && !/^-?\d+(\.\d+)?$/.test(raw)) throw new HttpError(400, "totalCostJt harus angka");
  if (raw === "" || D(raw).lte(0)) throw new HttpError(400, "Isi total biaya musim");
  if (!/^\d+(\.\d{1,2})?$/.test(raw) || D(raw).gt("99999999")) {
    throw new HttpError(400, "totalCostJt maksimal 2 desimal dan tidak lebih dari 99.999.999 juta");
  }

  const durationWks = DURATION[season.crop];
  let totalCost = D(raw);
  const { weekly } = weeklyFromExpenses(season.expenses, season.plantedOn, durationWks, totalCost);
  if (weekly) {
    // docs/03: bila catatan mingguan dipakai, total biaya = jumlah catatan non-simulasi (dibulatkan 2 desimal).
    totalCost = season.expenses.filter((e) => !e.simulated).reduce((s, e) => s.plus(e.amountJt), D(0)).toDecimalPlaces(2);
  }

  // Panen: total kg, pendapatan (Rupiah), harga rata-rata tertimbang, tanggal panen terakhir.
  const yieldKg = season.harvests.reduce((s, h) => s.plus(h.weightKg), D(0));
  const revenueRp = season.harvests.reduce((s, h) => s.plus(D(h.weightKg).mul(h.pricePerKg)), D(0));
  const revenueJt = revenueRp.div(1_000_000);
  const profitJt = revenueJt.minus(totalCost);
  const avgPrice = revenueRp.div(yieldKg).toDecimalPlaces(2);
  const lastHarvest = season.harvests.reduce((m, h) => (h.harvestedOn > m ? h.harvestedOn : m), season.harvests[0].harvestedOn);
  const label = `${CROP_NAME[season.crop]} ${isoDate(lastHarvest)}`;
  const mismatch = mismatchOver30(season.sample, yieldKg, season.areaHa);
  input = { ...input, totalCostJt: totalCost };
  const f = season.farm;

  const missing = [f.soilType, f.waterSource, f.province, f.ph, f.nitrogen, f.phosphorus, f.potassium,
    input.rainAvgMm, input.heavyRainWks, input.tempMaxAvg, input.fertIndex, input.wageIndex, input.pestIndex]
    .some((v) => v === null || v === undefined);
  const quality = missing ? "BELUM_LENGKAP" : weekly ? "SIAP_DILATIH" : "TOTAL_SAJA";

  {
    const closed = await tx.season.updateMany({
      where: { id: seasonId, status: "PANEN" },
      data: { status: "SELESAI", closedAt: new Date(), totalCostJt: input.totalCostJt, closingNote: input.closingNote ?? null },
    });
    if (closed.count !== 1) throw new HttpError(409, "Musim ini sudah ditutup");
    const record = await tx.seasonRecord.create({
      data: {
        label, note: input.closingNote ?? null, yieldKg, pricePerKg: avgPrice,
        seasonId, anonId: "R" + randomBytes(4).toString("hex").toUpperCase(),
        crop: season.crop, areaHa: season.areaHa,
        soilType: f.soilType, waterSource: f.waterSource, province: f.province,
        startMonth: season.plantedOn.getUTCMonth() + 1,
        ph: f.ph, nitrogen: f.nitrogen, phosphorus: f.phosphorus, potassium: f.potassium,
        rainAvgMm: input.rainAvgMm, heavyRainWks: input.heavyRainWks, tempMaxAvg: input.tempMaxAvg,
        fertIndex: input.fertIndex, wageIndex: input.wageIndex, pestIndex: input.pestIndex,
        durationWks, totalCostJt: input.totalCostJt, quality,
        consentTraining: input.consentTraining ?? false,
        weeks: weekly ? { create: weekly.map((costJt, i) => ({ week: i + 1, costJt })) } : undefined,
      },
    });
    return {
      record,
      summary: {
        status: "SELESAI",
        totalHarvestKg: yieldKg.toString(),
        revenueJt: revenueJt.toDecimalPlaces(3).toString(),
        totalCostJt: totalCost.toString(),
        profitJt: profitJt.toDecimalPlaces(3).toString(),
        isProfit: profitJt.gte(0),
        pricePerKg: avgPrice.toString(),
        weeklyCostUsed: Boolean(weekly),
        mismatchOver30: mismatch, // null bila tidak ada data
        mismatchWarning: mismatch === true ? "Selisih besar, periksa lagi timbangan atau catatan." : null,
      },
    };
  }
}