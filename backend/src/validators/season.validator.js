import { z } from "zod";
import { HttpError } from "../utils/http-error.js";

// Nilai persis enum Crop di schema.prisma.
export const CROPS = ["CABAI", "BAWANG", "TOMAT"];

export const seasonCreateSchema = z.strictObject(
  { crop: z.enum(CROPS, { error: `crop wajib dan harus salah satu dari: ${CROPS.join(", ")}` }) },
  { error: (iss) => (iss.code === "unrecognized_keys" ? `Isian tidak dikenal: ${iss.keys.join(", ")}` : undefined) },
);

export function parseSeasonCreate(body) {
  const r = seasonCreateSchema.safeParse(body ?? {});
  if (!r.success) throw new HttpError(400, r.error.issues.map((i) => i.message).join("; "));
  return r.data;
}

