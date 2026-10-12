import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { HttpError } from "../utils/http-error.js";
import { profileCompleteness, outOfTrainingRange } from "../utils/farm-profile.js";

export const listFarms = (userId) => prisma.farm.findMany({ where: { userId }, orderBy: { id: "asc" } });

// [REVISI] bagian 17.9: ambil/ubah satu lahan. Kepemilikan lewat { id, userId }; milik orang lain = 404.
const NOT_FOUND = "Lahan tidak ditemukan";

// [REVISI] bagian 17.10: respons GET/PATCH memuat kelengkapan & rentang latih (dihitung saat dibaca, tidak disimpan).
const withDerived = (farm) => ({
  ...farm,
  kelengkapan: profileCompleteness(farm),
  rentang_latih: outOfTrainingRange(farm),
});

// [REVISI] bagian 18.1: respons memuat kelengkapan & rentang_latih. userId dari sesi, ditaruh setelah data.
export const createFarm = async (userId, data) => withDerived(await prisma.farm.create({ data: { ...data, userId } }));

export async function getFarm(userId, id) {
  const farm = await prisma.farm.findFirst({ where: { id, userId } });
  if (!farm) throw new HttpError(404, NOT_FOUND);
  return withDerived(farm);
}

/** `data` sudah divalidasi (hanya kunci yang dikirim). userId/id tidak pernah ikut ditulis. */
// [REVISI] bagian 17.11: bila areaHa benar-benar berubah (dibandingkan sebagai Decimal), CostPlan aktif
// ditandai needsRecalc = true dalam transaksi yang sama dengan update Farm.
// CostPlan aktif = CostPlan terbaru (createdAt) pada tiap Season farm ini yang statusnya bukan SELESAI.
// Perubahan kolom lain tidak memicu hook. Hook tanaman ditunda ke bagian 18.
export async function updateFarm(userId, id, data) {
  try {
    return withDerived(
      await prisma.$transaction(async (tx) => {
        const old = await tx.farm.findFirst({ where: { id, userId }, select: { areaHa: true } });
        if (!old) throw new HttpError(404, NOT_FOUND);
        const farm = await tx.farm.update({ where: { id, userId }, data });
        if (data.areaHa !== undefined && !new Prisma.Decimal(old.areaHa).equals(new Prisma.Decimal(farm.areaHa))) {
          const seasons = await tx.season.findMany({
            where: { farmId: id, status: { not: "SELESAI" } },
            select: { costPlans: { orderBy: { createdAt: "desc" }, take: 1, select: { id: true } } },
          });
          const planIds = seasons.flatMap((s) => s.costPlans.map((p) => p.id));
          if (planIds.length > 0) {
            await tx.costPlan.updateMany({ where: { id: { in: planIds } }, data: { needsRecalc: true } });
          }
        }
        return farm;
      }),
    );
  } catch (err) {
    if (err.code === "P2025") throw new HttpError(404, NOT_FOUND);
    throw err;
  }
}
