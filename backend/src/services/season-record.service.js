import { randomBytes } from "node:crypto";
import { prisma } from "../config/prisma.js";
import { HttpError } from "../utils/http-error.js";

const DURATION = { CABAI: 16, TOMAT: 14, BAWANG: 10 };
const WEEK_MS = 7 * 86_400_000;

/** Jumlahkan catatan per minggu musim. Catatan simulasi tidak dihitung. */
export function weeklyFromExpenses(expenses, start, durationWks, totalJt) {
  const sums = new Array(durationWks).fill(0);
  let counted = 0;
  for (const e of expenses) {
    if (e.simulated) continue;
    const wk = Math.floor((e.spentOn.getTime() - start.getTime()) / WEEK_MS) + 1;
    const idx = Math.min(durationWks, Math.max(1, wk)); // sebelum musim -> minggu 1, sesudah -> terakhir
    const v = Number(e.amountJt); // Decimal Prisma -> angka
    sums[idx - 1] += v;
    counted += v;
  }
  const ratio = totalJt > 0 ? counted / totalJt : 0;
  const usable = ratio >= 0.9 && ratio <= 1.1; // aturan 90-110 persen
  return { weekly: usable ? sums : null, ratio };
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