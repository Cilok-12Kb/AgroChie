import { z } from "zod";

// [REVISI] Kontrak keluaran provider deteksi. Nama field dipertahankan persis seperti spesifikasi.
export const QUALITY = ["baik", "sedang", "buruk"];
export const PROBLEM_TYPES = ["hama", "penyakit", "defisiensi_nutrisi", "cekaman_air", "lainnya"];
export const SEVERITY = ["ringan", "sedang", "berat"];

export const problemSchema = z.object({
  nama: z.string().trim().min(1).max(120),
  jenis: z.enum(PROBLEM_TYPES),
  tingkat_keparahan: z.enum(SEVERITY),
  gejala_terlihat: z.string().trim().min(1).max(500),
});

export const detectionResultSchema = z.object({
  tanaman_terlihat: z.boolean().optional(), // false = gambar bukan tanaman; kosong dianggap tanaman
  kondisi: z.string().trim().min(1).max(400),
  kategori_kualitas: z.enum(QUALITY),
  skor_kepercayaan: z.number().min(0).max(1),
  masalah_terdeteksi: z.array(problemSchema).max(10),
});

/** Skema khusus Gemini: tanaman_terlihat wajib ada agar "bukan tanaman" tidak terlewat. */
export const geminiDetectionSchema = detectionResultSchema.extend({ tanaman_terlihat: z.boolean() });

/** JSON Schema untuk responseJsonSchema (tanpa penanda $schema). */
export function toResponseSchema(zodSchema) {
  const { $schema, ...rest } = z.toJSONSchema(zodSchema);
  return rest;
}
