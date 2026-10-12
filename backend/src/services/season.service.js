import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { HttpError } from "../utils/http-error.js";
import { currentWeek, harvestEstimate } from "../utils/season-flow.js"; // [REVISI] 18.7

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

// [REVISI] 18.4: ubah musim. `data` sudah divalidasi (hanya kunci yang dikirim).
// Hook (pola 17.11): bila crop/areaHa benar-benar berubah, CostPlan terbaru Season ini ditandai
// needsRecalc = true dalam transaksi yang sama. Kolom lain dan nilai yang sama tidak memicu hook.
export async function updateSeason(userId, id, data) {
  return prisma.$transaction(async (tx) => {
    const old = await tx.season.findFirst({ where: { id, farm: { userId } } });
    if (!old) throw new HttpError(404, "Musim tidak ditemukan");
    if (old.status === "SELESAI") throw new HttpError(409, "Musim yang sudah selesai tidak bisa diubah");
    if (data.crop !== undefined && ["TANAM", "PANEN"].includes(old.status)) {
      throw new HttpError(409, "Tanaman tidak bisa diganti setelah penanaman dimulai");
    }
    const cropChanged = data.crop !== undefined && data.crop !== old.crop;
    const areaChanged = data.areaHa !== undefined && !new Prisma.Decimal(old.areaHa).equals(new Prisma.Decimal(data.areaHa));
    const season = await tx.season.update({ where: { id }, data, select: SEASON_SELECT });
    if (cropChanged || areaChanged) {
      const plan = await tx.costPlan.findFirst({ where: { seasonId: id }, orderBy: { createdAt: "desc" }, select: { id: true } });
      if (plan) await tx.costPlan.update({ where: { id: plan.id }, data: { needsRecalc: true } });
    }
    return season;
  });
}

// [REVISI] 18.5: hentikan perhitungan. Hanya dari PEMBIAYAAN; kembali ke DRAFT. Riwayat CostPlan dipertahankan (Q8).
export async function stopFinancing(userId, id) {
  return prisma.$transaction(async (tx) => {
    const cur = await tx.season.findFirst({ where: { id, farm: { userId } }, select: { status: true } });
    if (!cur) throw new HttpError(404, "Musim tidak ditemukan");
    const r = await tx.season.updateMany({
      where: { id, status: "PEMBIAYAAN" },
      data: { status: "DRAFT", financingStoppedAt: new Date() },
    });
    if (r.count !== 1) throw new HttpError(409, "Perhitungan hanya bisa dihentikan saat status PEMBIAYAAN");
    return tx.season.findUnique({ where: { id }, select: SEASON_SELECT });
  });
}
// [REVISI] 18.7: mulai penanaman. Hanya dari PEMBIAYAAN (updateMany bersyarat agar permintaan bersamaan tidak sama-sama lolos).
export async function startPlanting(userId, id, { plantedOn, today }) {
  return prisma.$transaction(async (tx) => {
    const cur = await tx.season.findFirst({ where: { id, farm: { userId } }, select: { crop: true } });
    if (!cur) throw new HttpError(404, "Musim tidak ditemukan");
    const r = await tx.season.updateMany({ where: { id, status: "PEMBIAYAAN" }, data: { status: "TANAM", plantedOn } });
    if (r.count !== 1) throw new HttpError(409, "Penanaman hanya bisa dimulai saat status PEMBIAYAAN");
    const season = await tx.season.findUnique({ where: { id }, select: SEASON_SELECT });
    return {
      season,
      currentWeek: currentWeek(plantedOn, today, cur.crop),
      harvestEstimate: harvestEstimate(plantedOn, cur.crop),
    };
  });
}



export async function getSeason(userId, id) {
  const season = await prisma.season.findFirst({ where: { id, farm: { userId } }, select: SEASON_SELECT });
  if (!season) throw new HttpError(404, "Musim tidak ditemukan");
  return season;
}

