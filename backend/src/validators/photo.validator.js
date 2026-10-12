import { z } from "zod";
import { HttpError } from "../utils/http-error.js";

// [REVISI] 18.10: metadata foto sampel (Q7, tanpa penyimpanan objek). Nama kolom persis model Photo.
// seasonWeek dan insideBoundary tidak diterima dari klien (belum ada penurunan di server; dibiarkan null).
export const PHOTO_KINDS = ["PROGRES", "SAMPEL"]; // enum PhotoKind
export const MAX_PHOTOS = 6;
const MAX_SKEW_MS = 5 * 60_000; // toleransi jam perangkat

const coord = (name, limit) =>
  z
    .union([z.string(), z.number()], { error: `${name} harus angka` })
    .transform((v) => String(v).trim())
    .refine((s) => /^-?\d+(\.\d{1,6})?$/.test(s), `${name} harus angka dengan maksimal 6 desimal`)
    .refine((s) => Math.abs(Number(s)) <= limit, `${name} di luar rentang (maks ${limit})`);

export const photoCreateSchema = z.strictObject(
  {
    kind: z.enum(PHOTO_KINDS, { error: `kind wajib dan harus salah satu dari: ${PHOTO_KINDS.join(", ")}` }),
    objectKey: z.string({ error: "objectKey wajib" }).trim().min(1, "objectKey wajib").max(300, "objectKey maksimal 300 karakter"),
    sha256: z.string({ error: "sha256 wajib" }).trim().toLowerCase().regex(/^[0-9a-f]{64}$/, "sha256 harus 64 karakter heksadesimal"),
    takenAt: z.string({ error: "takenAt wajib berformat waktu ISO" }),
    latitude: coord("latitude", 90).optional(),
    longitude: coord("longitude", 180).optional(),
  },
  { error: (iss) => (iss.code === "unrecognized_keys" ? `Isian tidak dikenal: ${iss.keys.join(", ")}` : undefined) },
);

export function parsePhotoCreate(body, now = new Date()) {
  const r = photoCreateSchema.safeParse(body ?? {});
  if (!r.success) throw new HttpError(400, r.error.issues.map((i) => i.message).join("; "));
  const d = r.data;
  if ((d.latitude === undefined) !== (d.longitude === undefined)) throw new HttpError(400, "latitude dan longitude harus diisi berpasangan");
  const takenAt = new Date(d.takenAt);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(d.takenAt) || Number.isNaN(takenAt.getTime())) {
    throw new HttpError(400, "takenAt harus waktu ISO yang valid, contoh 2026-06-01T08:30:00Z");
  }
  if (takenAt.getTime() > now.getTime() + MAX_SKEW_MS) throw new HttpError(400, "Waktu foto tidak boleh di masa depan");
  return { kind: d.kind, objectKey: d.objectKey, sha256: d.sha256, takenAt, latitude: d.latitude ?? null, longitude: d.longitude ?? null };
}
