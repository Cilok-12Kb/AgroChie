import { env } from "../../config/env.js";
import { HttpError } from "../../utils/http-error.js";
import { LlmError } from "../llm.service.js";
import { createGeminiProvider } from "./gemini-provider.js";
import { detectionResultSchema } from "./schema.js";

// [REVISI] Deteksi kualitas tanaman. Controller hanya memanggil detectionService.detect(); provider bisa diganti
// lewat DETECTION_PROVIDER. Provider baru (ONNX/TensorFlow/endpoint luar) cukup didaftarkan di PROVIDERS dengan
// antarmuka { name, detect(imageBuffer, mimeType, context) -> objek sesuai detectionResultSchema }.
const PROVIDERS = { gemini: () => createGeminiProvider() };

export function getProvider(name = env.detectionProvider) {
  const make = PROVIDERS[name];
  if (!make) throw new HttpError(500, `DETECTION_PROVIDER "${name}" tidak dikenal. Pilihan: ${Object.keys(PROVIDERS).join(", ")}`);
  return make();
}

export const UNSURE_MESSAGE =
  "Kami belum yakin dengan hasil deteksinya. Unggah foto yang lebih jelas: ambil di tempat terang, satu bagian tanaman (daun/buah) terlihat fokus dan dekat, tanpa bayangan tangan.";
export const NOT_PLANT_MESSAGE =
  "Foto ini tampaknya bukan tanaman atau tidak dapat dinilai. Unggah foto tanaman yang jelas, di tempat terang, dengan daun/buah terlihat fokus.";

/**
 * Bentuk keluaran detect():
 * { status: "SELESAI" | "TIDAK_YAKIN",         // sama dengan enum DetectionStatus
 *   provider: string,
 *   hasil: { tanaman_terlihat?, kondisi, kategori_kualitas, skor_kepercayaan, masalah_terdeteksi[] },
 *   alasan: null | "bukan_tanaman" | "keyakinan_rendah",
 *   pesan: string | null }                       // pesan untuk user bila TIDAK_YAKIN
 */
export function createDetectionService({ provider, minConfidence } = {}) {
  return {
    async detect(imageBuffer, mimeType, context = {}) {
      const p = provider ?? getProvider();
      const min = minConfidence ?? env.detectionMinConfidence;
      const raw = await p.detect(imageBuffer, mimeType, context);
      const parsed = detectionResultSchema.safeParse(raw);
      if (!parsed.success) {
        console.error("[deteksi] keluaran provider tidak valid:", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
        throw new LlmError(502, "AI_INVALID_OUTPUT", "Hasil deteksi tidak valid. Coba ulangi beberapa saat lagi.");
      }
      const hasil = parsed.data;
      if (hasil.tanaman_terlihat === false) {
        return { status: "TIDAK_YAKIN", provider: p.name, hasil, alasan: "bukan_tanaman", pesan: NOT_PLANT_MESSAGE };
      }
      if (hasil.skor_kepercayaan < min) {
        return { status: "TIDAK_YAKIN", provider: p.name, hasil, alasan: "keyakinan_rendah", pesan: UNSURE_MESSAGE };
      }
      return { status: "SELESAI", provider: p.name, hasil, alasan: null, pesan: null };
    },
  };
}

export const detectionService = createDetectionService();
