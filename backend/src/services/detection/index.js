import { env } from "../../config/env.js";
import { HttpError } from "../../utils/http-error.js";
import { LlmError } from "../llm.service.js";
import { createGeminiProvider } from "./gemini-provider.js";
import { createEngineProvider } from "./engine-provider.js";
import { detectionResultSchema } from "./schema.js";

// [REVISI] Deteksi kualitas tanaman. Controller hanya memanggil detectionService.detect(); provider bisa diganti
// lewat DETECTION_PROVIDER. Provider baru (ONNX/TensorFlow/endpoint luar) cukup didaftarkan di PROVIDERS dengan
// antarmuka { name, detect(imageBuffer, mimeType, context) -> objek sesuai detectionResultSchema }.
// [REVISI] "engine" (model CNN sendiri) menjadi provider utama; "gemini" tetap valid.
//
// Pemakaian Gemini per analisis (generateContent; embedding RAG dihitung terpisah di bawah):
// - DETECTION_PROVIDER=engine, tanpa fallback : 1 panggilan (hanya solusi). Kasus terburuk 2 (solusi diulang sekali bila JSON rusak).
// - engine + DETECTION_FALLBACK_PROVIDER=gemini: fallback hanya jalan bila engine tidak tersedia atau hasilnya TIDAK_YAKIN
//   (keyakinan rendah/margin tipis). Kasus terburuk 4 = deteksi Gemini (2 dengan retry JSON) + solusi (2 dengan retry JSON).
//   Fallback MEMAKAI KUOTA GEMINI (free tier kecil).
// - Tiap solusi juga memanggil embedding 1x untuk RAG (model embedding terpisah; bila gagal, solusi lanjut tanpa dokumen).
// - Analisis TIDAK_YAKIN tidak memanggil solusi sama sekali.
const PROVIDERS = {
  engine: () => createEngineProvider(),
  gemini: () => createGeminiProvider(),
};

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
export function createDetectionService({ provider, fallbackProvider, minConfidence } = {}) {
  /** Satu provider -> hasil terstruktur. `sumber` (provider, versi model, dll.) ikut disimpan di riwayat. */
  async function run(p, imageBuffer, mimeType, context, min, viaFallback) {
    const raw = await p.detect(imageBuffer, mimeType, context);
    const { _meta: meta, ...body } = raw ?? {}; // _meta hanya milik provider; dibuang dari kontrak hasil
    const parsed = detectionResultSchema.safeParse(body);
    if (!parsed.success) {
      console.error("[deteksi] keluaran provider tidak valid:", parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "));
      throw new LlmError(502, "AI_INVALID_OUTPUT", "Hasil deteksi tidak valid. Coba ulangi beberapa saat lagi.");
    }
    const hasil = parsed.data;
    const sumber = {
      provider: p.name,
      model_versi: meta?.model_versi ?? null,
      kelas: meta?.kelas ?? null,
      komoditas_model: meta?.crop ?? null,
      margin: meta?.margin ?? null,
      fallback: viaFallback,
    };
    const base = { provider: p.name, hasil, sumber };
    if (hasil.tanaman_terlihat === false) {
      return { status: "TIDAK_YAKIN", ...base, alasan: "bukan_tanaman", pesan: NOT_PLANT_MESSAGE };
    }
    // Skor di bawah ambang, atau selisih skor tertinggi dan kedua terlalu tipis (hanya bila provider melaporkannya).
    if (hasil.skor_kepercayaan < min || meta?.margin_tipis === true) {
      return { status: "TIDAK_YAKIN", ...base, alasan: "keyakinan_rendah", pesan: UNSURE_MESSAGE };
    }
    return { status: "SELESAI", ...base, alasan: null, pesan: null };
  }

  return {
    async detect(imageBuffer, mimeType, context = {}) {
      const p = provider ?? getProvider();
      const min = minConfidence ?? env.detectionMinConfidence;
      const fb = fallbackProvider !== undefined ? fallbackProvider : env.detectionFallbackProvider ? getProvider(env.detectionFallbackProvider) : null;
      const useFb = fb && fb.name !== p.name ? fb : null; // fallback sama dengan utama tidak ada gunanya

      let first;
      try {
        first = await run(p, imageBuffer, mimeType, context, min, false);
      } catch (e) {
        // Fallback hanya untuk engine tidak tersedia; galat lain (mis. keluaran tidak valid, kelas tak dikenal) tidak ditutupi.
        if (useFb && e?.code === "ENGINE_UNAVAILABLE") {
          console.error("[deteksi] provider utama tidak tersedia, memakai fallback:", useFb.name);
          return run(useFb, imageBuffer, mimeType, context, min, true);
        }
        throw e;
      }
      // Satu kali saja: keyakinan rendah -> periksa dengan fallback. Bila fallback gagal, hasil utama (TIDAK_YAKIN) tetap dipakai.
      if (useFb && first.status === "TIDAK_YAKIN" && first.alasan === "keyakinan_rendah") {
        try {
          return await run(useFb, imageBuffer, mimeType, context, min, true);
        } catch (e) {
          console.error("[deteksi] fallback gagal, memakai hasil utama:", e?.message);
        }
      }
      return first;
    },
  };
}

export const detectionService = createDetectionService();
