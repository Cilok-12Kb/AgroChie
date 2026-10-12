import { z } from "zod";
import { HttpError } from "../utils/http-error.js";
import { farmObject } from "./farm.validator.js";

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


// [REVISI] 18.4: PATCH Season. Aturan nilai dipakai ulang dari farmObject (tidak disalin).
const S = farmObject.shape;
export const seasonPatchSchema = z
  .strictObject(
    {
      crop: z.enum(CROPS, { error: `crop harus salah satu dari: ${CROPS.join(", ")}` }),
      areaHa: S.areaHa,
      capitalJt: S.capitalJt,
      sellPricePerKg: S.sellPricePerKg,
      profitTargetJt: S.profitTargetJt,
    },
    { error: (iss) => (iss.code === "unrecognized_keys" ? `Isian tidak dikenal: ${iss.keys.join(", ")}` : undefined) },
  )
  .partial()
  .superRefine((d, ctx) => {
    if (Object.keys(d).length === 0) ctx.addIssue({ code: "custom", message: "Tidak ada isian yang dikirim", path: ["body"] });
  });

export function parseSeasonPatch(body) {
  const r = seasonPatchSchema.safeParse(body ?? {});
  if (!r.success) throw new HttpError(400, r.error.issues.map((i) => i.message).join("; "));
  return { ...r.data };
}
