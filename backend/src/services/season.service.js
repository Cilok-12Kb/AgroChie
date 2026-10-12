import { prisma } from "../config/prisma.js";
import { HttpError } from "../utils/http-error.js";

// Respons Season tidak memuat CostPlan/angka hasil prediksi (gerbang uang: sub-langkah 11).
// Kolom Decimal tetap Decimal (diserialisasi Prisma menjadi string).
const SEASON_SELECT = {
  id: true, farmId: true, crop: true, areaHa: true, status: true,
  capitalJt: true, sellPricePerKg: true, profitTargetJt: true,
  financingStartedAt: true, financingStoppedAt: true, plantedOn: true,
  closedAt: true, totalCostJt: true, closingNote: true,
};

const FARM_NOT_FOUND = "Lahan tidak ditemukan";

export async function createSeason(userId, farmId, { crop }) {
  return prisma.$transaction(async (tx) => {
    const farm = await tx.farm.findFirst({ where: { id: farmId, userId } });
    if (!farm) throw new HttpError(404, FARM_NOT_FOUND);
    // Kunci baris lahan agar dua permintaan bersamaan tidak sama-sama lolos pemeriksaan.
    await tx.$queryRaw`SELECT id FROM farms WHERE id = ${farmId} FOR UPDATE`;
    const open = await tx.season.findFirst({ where: { farmId, status: { not: "SELESAI" } }, select: { id: true } });
    if (open) throw new HttpError(409, "Lahan ini masih punya musim yang belum selesai");
    // Salin default Farm satu kali; null tetap null, Decimal tetap Decimal.
    return tx.season.create({
      data: {
        farmId,
        crop,
        status: "DRAFT",
        areaHa: farm.areaHa,
        capitalJt: farm.capitalJt,
        sellPricePerKg: farm.sellPricePerKg,
        profitTargetJt: farm.profitTargetJt,
      },
      select: SEASON_SELECT,
    });
  });
}

export async function listSeasons(userId, farmId) {
  const farm = await prisma.farm.findFirst({ where: { id: farmId, userId }, select: { id: true } });
  if (!farm) throw new HttpError(404, FARM_NOT_FOUND);
  return prisma.season.findMany({ where: { farmId, farm: { userId } }, orderBy: { id: "asc" }, select: SEASON_SELECT });
}

export async function getSeason(userId, id) {
  const season = await prisma.season.findFirst({ where: { id, farm: { userId } }, select: SEASON_SELECT });
  if (!season) throw new HttpError(404, "Musim tidak ditemukan");
  return season;
}

