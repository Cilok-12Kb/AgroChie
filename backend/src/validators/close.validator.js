import { z } from "zod";
import { HttpError } from "../utils/http-error.js";

// [REVISI] 18.10: body tutup musim. totalCostJt sengaja TIDAK divalidasi di sini: aturan docs/03 bagian 8
// menempatkan "Isi total biaya musim" paling akhir (setelah panen, sampel, foto), jadi dicek di service.
const dec1 = (name, max) =>
  z
    .union([z.string(), z.number()], { error: `${name} harus angka` })
    .transform((v) => String(v).trim())
    .refine((s) => /^\d+(\.\d)?$/.test(s), `${name} harus angka tidak negatif dengan maksimal 1 desimal`)
    .refine((s) => Number(s) <= max, `${name} maksimal ${max}`)
    .optional();

export const closeSchema = z.strictObject(
  {
    totalCostJt: z.union([z.string(), z.number()]).optional(),
    closingNote: z.string({ error: "closingNote harus teks" }).trim().max(1000, "closingNote maksimal 1000 karakter").optional(),
    rainAvgMm: dec1("rainAvgMm", 9999),
    heavyRainWks: z.number({ error: "heavyRainWks harus bilangan bulat" }).int("heavyRainWks harus bilangan bulat").min(0).max(60).optional(),
    tempMaxAvg: dec1("tempMaxAvg", 60),
    fertIndex: dec1("fertIndex", 9999),
    wageIndex: dec1("wageIndex", 9999),
    pestIndex: dec1("pestIndex", 9999),
    consentTraining: z.boolean({ error: "consentTraining harus true atau false" }).optional(),
  },
  { error: (iss) => (iss.code === "unrecognized_keys" ? `Isian tidak dikenal: ${iss.keys.join(", ")}` : undefined) },
);

export function parseClose(body) {
  const r = closeSchema.safeParse(body ?? {});
  if (!r.success) throw new HttpError(400, r.error.issues.map((i) => i.message).join("; "));
  return r.data;
}
