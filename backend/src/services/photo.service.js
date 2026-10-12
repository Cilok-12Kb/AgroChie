import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { HttpError } from "../utils/http-error.js";
import { MAX_PHOTOS } from "../validators/photo.validator.js";

// [REVISI] 18.10: foto sampel, metadata saja. sha256 unik global (duplikat 409); maksimal 6 foto per musim.
const SELECT = { id: true, seasonId: true, kind: true, objectKey: true, sha256: true, latitude: true, longitude: true, takenAt: true, seasonWeek: true, insideBoundary: true };

export async function addPhoto(userId, seasonId, data) {
  try {
    return await prisma.$transaction(async (tx) => {
      const season = await tx.season.findFirst({ where: { id: seasonId, farm: { userId } }, select: { id: true, status: true } });
      if (!season) throw new HttpError(404, "Musim tidak ditemukan");
      if (season.status === "SELESAI") throw new HttpError(409, "Musim yang sudah selesai tidak bisa diubah");
      // Kunci baris musim agar dua unggahan bersamaan tidak sama-sama lolos batas 6.
      await tx.$queryRaw`SELECT id FROM seasons WHERE id = ${seasonId} FOR UPDATE`;
      if ((await tx.photo.count({ where: { seasonId } })) >= MAX_PHOTOS) throw new HttpError(409, `Maksimal ${MAX_PHOTOS} foto per musim`);
      if (await tx.photo.findUnique({ where: { sha256: data.sha256 }, select: { id: true } })) throw new HttpError(409, "Foto ini sudah pernah diunggah");
      return tx.photo.create({ data: { seasonId, ...data }, select: SELECT });
    });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") throw new HttpError(409, "Foto ini sudah pernah diunggah");
    throw e;
  }
}

export async function listPhotos(userId, seasonId) {
  const season = await prisma.season.findFirst({ where: { id: seasonId, farm: { userId } }, select: { id: true } });
  if (!season) throw new HttpError(404, "Musim tidak ditemukan");
  return prisma.photo.findMany({ where: { seasonId }, orderBy: [{ takenAt: "asc" }, { id: "asc" }], select: SELECT });
}
