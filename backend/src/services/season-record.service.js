import { randomBytes } from "node:crypto";
import { Prisma } from "@prisma/client"; // [REVISI] 18.8
import { prisma } from "../config/prisma.js";
import { HttpError } from "../utils/http-error.js";

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

export async function closeSeason(userId, seasonId, input) {
  // hanya pemilik musim yang boleh menutupnya, bukan sembarang pengguna yang sudah login
  const season = await prisma.season.findFirstOrThrow({
    where: { id: seasonId, farm: { userId } },
    include: { farm: true, expenses: true },
  });
  if (!season.plantedOn) throw new HttpError(409, "Penanaman belum dimulai");

  const durationWks = DURATION[season.crop];
  const { weekly } = weeklyFromExpenses(season.expenses, season.plantedOn, durationWks, input.totalCostJt);
  const f = season.farm;

  const missing = [f.soilType, f.waterSource, f.province, f.ph, f.nitrogen, f.phosphorus, f.potassium,
    input.rainAvgMm, input.heavyRainWks, input.tempMaxAvg, input.fertIndex, input.wageIndex, input.pestIndex]
    .some((v) => v === null || v === undefined);
  const quality = missing ? "BELUM_LENGKAP" : weekly ? "SIAP_DILATIH" : "TOTAL_SAJA";

  return prisma.$transaction(async (tx) => {
    await tx.season.update({
      where: { id: seasonId },
      data: { status: "SELESAI", closedAt: new Date(), totalCostJt: input.totalCostJt, closingNote: input.closingNote },
    });
    return tx.seasonRecord.create({
      data: {
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
  });
}