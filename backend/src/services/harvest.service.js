import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { HttpError } from "../utils/http-error.js";

// [REVISI] 18.9: panen dan sampel panen (F5 langkah 3). kg dan rupiah Decimal, diserialisasi sebagai string.
export const MISMATCH_RATIO = new Prisma.Decimal("0.3"); // selisih > 30% = tidak selaras (tepat 30% masih selaras)
const D = (v) => new Prisma.Decimal(v);

async function ownedSeason(db, userId, id) {
  const season = await db.season.findFirst({ where: { id, farm: { userId } } });
  if (!season) throw new HttpError(404, "Musim tidak ditemukan");
  return season;
}

/**
 * Murni. Perkiraan dari sampel = sampleKg / sampleM2 x 10000 x areaHa. Tidak selaras bila |total - perkiraan| > 30% perkiraan.
 * Dihitung tanpa pembagian: |total x m2 - kg x 10000 x area| > 0.3 x kg x 10000 x area. null bila sampel atau panen belum ada.
 */
export function mismatchOver30(sample, totalKg, areaHa, hasHarvest = true) {
  if (!sample || !hasHarvest || totalKg === null || totalKg === undefined) return null;
  const left = D(totalKg).mul(sample.sampleM2).minus(D(sample.sampleKg).mul(10000).mul(areaHa)).abs();
  return left.gt(MISMATCH_RATIO.mul(sample.sampleKg).mul(10000).mul(areaHa));
}

async function harvestTotal(db, seasonId) {
  const agg = await db.harvest.aggregate({ where: { seasonId }, _sum: { weightKg: true }, _count: true });
  return { count: agg._count, totalKg: agg._count ? D(agg._sum.weightKg) : null };
}

export async function addHarvest(userId, seasonId, data) {
  return prisma.$transaction(async (tx) => {
    const season = await ownedSeason(tx, userId, seasonId);
    if (!["TANAM", "PANEN"].includes(season.status)) throw new HttpError(409, "Panen hanya bisa dicatat saat status TANAM atau PANEN");
    if (season.status === "TANAM") {
      // Panen pertama: TANAM -> PANEN (kondisional agar aman dari permintaan bersamaan).
      await tx.season.updateMany({ where: { id: seasonId, status: "TANAM" }, data: { status: "PANEN" } });
    }
    const harvest = await tx.harvest.create({
      data: { seasonId, harvestedOn: data.harvestedOn, grade: data.grade, weightKg: D(data.weightKg), pricePerKg: D(data.pricePerKg), buyer: data.buyer ?? null },
    });
    const sample = await tx.harvestSample.findUnique({ where: { seasonId } });
    if (sample) {
      const { totalKg } = await harvestTotal(tx, seasonId);
      await tx.harvestSample.update({ where: { seasonId }, data: { mismatchOver30: mismatchOver30(sample, totalKg, season.areaHa) === true } });
    }
    return harvest;
  });
}

export async function listHarvests(userId, seasonId) {
  await ownedSeason(prisma, userId, seasonId);
  return prisma.harvest.findMany({ where: { seasonId }, orderBy: [{ harvestedOn: "asc" }, { id: "asc" }] });
}

// Sampel hanya saat PANEN: perbandingan butuh total panen, yang baru ada setelah panen pertama (TANAM -> 409).
export async function putSample(userId, seasonId, { sampleKg, sampleM2 }) {
  return prisma.$transaction(async (tx) => {
    const season = await ownedSeason(tx, userId, seasonId);
    if (season.status !== "PANEN") throw new HttpError(409, "Sampel panen hanya bisa diisi saat status PANEN");
    const { count, totalKg } = await harvestTotal(tx, seasonId);
    const mismatch = mismatchOver30({ sampleKg, sampleM2 }, totalKg, season.areaHa, count > 0);
    const data = { sampleKg: D(sampleKg), sampleM2: D(sampleM2), mismatchOver30: mismatch === true };
    const row = await tx.harvestSample.upsert({ where: { seasonId }, create: { seasonId, ...data }, update: data });
    return { ...row, mismatchOver30: mismatch, totalHarvestKg: totalKg };
  });
}
