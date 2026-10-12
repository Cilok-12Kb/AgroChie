import { prisma } from "../config/prisma.js";
import { HttpError } from "../utils/http-error.js";
import { profileCompleteness, outOfTrainingRange } from "../utils/farm-profile.js";

export const createFarm = (userId, data) => prisma.farm.create({ data: { userId, ...data } });
export const listFarms = (userId) => prisma.farm.findMany({ where: { userId }, orderBy: { id: "asc" } });

// [REVISI] bagian 17.9: ambil/ubah satu lahan. Kepemilikan lewat { id, userId }; milik orang lain = 404.
const NOT_FOUND = "Lahan tidak ditemukan";

// [REVISI] bagian 17.10: respons GET/PATCH memuat kelengkapan & rentang latih (dihitung saat dibaca, tidak disimpan).
const withDerived = (farm) => ({
  ...farm,
  kelengkapan: profileCompleteness(farm),
  rentang_latih: outOfTrainingRange(farm),
});

export async function getFarm(userId, id) {
  const farm = await prisma.farm.findFirst({ where: { id, userId } });
  if (!farm) throw new HttpError(404, NOT_FOUND);
  return withDerived(farm);
}

/** `data` sudah divalidasi (hanya kunci yang dikirim). userId/id tidak pernah ikut ditulis. */
export async function updateFarm(userId, id, data) {
  try {
    return withDerived(await prisma.farm.update({ where: { id, userId }, data }));
  } catch (err) {
    if (err.code === "P2025") throw new HttpError(404, NOT_FOUND);
    throw err;
  }
}
