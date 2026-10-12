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


// [REVISI] 18.7: mulai penanaman. plantedOn YYYY-MM-DD, default hari ini; tidak boleh di masa depan; maksimal 60 hari lalu.
export const MAX_BACKDATE_DAYS = 60;
const DAY_MS = 86_400_000;

/** Hari ini sebagai tanggal kalender WIB (UTC+7), dalam Date UTC tengah malam (cocok dengan kolom @db.Date). */
export function todayWib(now = new Date()) {
  const t = new Date(now.getTime() + 7 * 3_600_000);
  return new Date(Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate()));
}

export const startPlantingSchema = z.strictObject(
  { plantedOn: z.string({ error: "plantedOn harus teks YYYY-MM-DD" }) },
  { error: (iss) => (iss.code === "unrecognized_keys" ? `Isian tidak dikenal: ${iss.keys.join(", ")}` : undefined) },
).partial();

export function parseStartPlanting(body, now = new Date()) {
  const r = startPlantingSchema.safeParse(body ?? {});
  if (!r.success) throw new HttpError(400, r.error.issues.map((i) => i.message).join("; "));
  const today = todayWib(now);
  if (r.data.plantedOn === undefined) return { plantedOn: today, today };
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(r.data.plantedOn);
  const date = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
  const valid = date && date.getUTCFullYear() === +m[1] && date.getUTCMonth() === +m[2] - 1 && date.getUTCDate() === +m[3];
  if (!valid) throw new HttpError(400, "plantedOn harus tanggal valid berformat YYYY-MM-DD");
  if (date > today) throw new HttpError(400, "Tanggal tanam tidak boleh di masa depan");
  if (today - date > MAX_BACKDATE_DAYS * DAY_MS) {
    throw new HttpError(400, `Tanggal tanam tidak boleh lebih dari ${MAX_BACKDATE_DAYS} hari lalu`);
  }
  return { plantedOn: date, today };
}

