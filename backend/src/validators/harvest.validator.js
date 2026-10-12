import { z } from "zod";
import { HttpError } from "../utils/http-error.js";
import { todayWib } from "./season.validator.js";

// [REVISI] 18.9: validasi panen dan sampel. Nilai/nama persis schema.prisma (Harvest, HarvestSample).
export const HARVEST_GRADES = ["A", "B", "C", "SORTIRAN"]; // enum HarvestGrade
export const MAX_KG = "1000000"; // batas wajar; kolom Decimal(10,2)
export const MAX_PRICE_PER_KG = "10000000"; // Rupiah per kg; kolom Decimal(12,2)
export const MAX_M2 = "1000000"; // Decimal(10,2)

const posDecimal = (name, max, unit) =>
  z
    .union([z.string(), z.number()], { error: `${name} harus angka${unit}` })
    .transform((v) => String(v).trim())
    .refine((s) => /^\d+(\.\d{1,2})?$/.test(s), `${name} harus angka positif dengan maksimal 2 desimal`)
    .refine((s) => Number(s) > 0, `${name} harus lebih dari 0`)
    .refine((s) => Number(s) <= Number(max), `${name} maksimal ${max}`);

const unknownKeys = { error: (iss) => (iss.code === "unrecognized_keys" ? `Isian tidak dikenal: ${iss.keys.join(", ")}` : undefined) };

export const harvestCreateSchema = z.strictObject(
  {
    kg: posDecimal("kg", MAX_KG, " (kilogram)"),
    pricePerKg: posDecimal("pricePerKg", MAX_PRICE_PER_KG, " (Rupiah per kg)"),
    harvestedOn: z.string({ error: "harvestedOn wajib berformat YYYY-MM-DD" }),
    grade: z.enum(HARVEST_GRADES, { error: `grade wajib dan harus salah satu dari: ${HARVEST_GRADES.join(", ")}` }),
    buyer: z.string({ error: "buyer harus teks" }).trim().max(100, "buyer maksimal 100 karakter").optional(),
  },
  unknownKeys,
);

export function parseHarvestCreate(body, now = new Date()) {
  const r = harvestCreateSchema.safeParse(body ?? {});
  if (!r.success) throw new HttpError(400, r.error.issues.map((i) => i.message).join("; "));
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(r.data.harvestedOn);
  const date = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
  const valid = date && date.getUTCFullYear() === +m[1] && date.getUTCMonth() === +m[2] - 1 && date.getUTCDate() === +m[3];
  if (!valid) throw new HttpError(400, "harvestedOn harus tanggal valid berformat YYYY-MM-DD");
  if (date > todayWib(now)) throw new HttpError(400, "Tanggal panen tidak boleh di masa depan");
  return { weightKg: r.data.kg, pricePerKg: r.data.pricePerKg, harvestedOn: date, grade: r.data.grade, buyer: r.data.buyer };
}

export const sampleSchema = z.strictObject(
  { sampleKg: posDecimal("sampleKg", MAX_KG, " (kilogram)"), sampleM2: posDecimal("sampleM2", MAX_M2, " (meter persegi)") },
  unknownKeys,
);

export function parseSample(body) {
  const r = sampleSchema.safeParse(body ?? {});
  if (!r.success) throw new HttpError(400, r.error.issues.map((i) => i.message).join("; "));
  return r.data;
}
