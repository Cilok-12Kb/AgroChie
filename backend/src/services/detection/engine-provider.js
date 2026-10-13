import { env } from "../../config/env.js";
import { HttpError } from "../../utils/http-error.js";
import { engineLeaf } from "../engine.service.js";
import { LEAF_CLASS_MAP, SEVERITY_ESTIMATED, GEJALA_NETRAL } from "./leaf-class-map.js";

// [REVISI] Provider deteksi utama: model CNN di engine (POST /predict/leaf lewat engine.service, jadi ENGINE_URL,
// kunci internal, dan timeout sama dengan fitur lama /api/crops/leaf-quality). Tanpa panggilan Gemini.
export const ENGINE_UNAVAILABLE_MESSAGE = "Layanan deteksi sedang tidak tersedia. Coba lagi beberapa saat lagi.";

/** Engine mati / timeout / model belum termuat. Kode ENGINE_UNAVAILABLE (503); tidak pernah disertai hasil simulasi. */
export class EngineUnavailableError extends HttpError {
  constructor() {
    super(503, ENGINE_UNAVAILABLE_MESSAGE);
    this.code = "ENGINE_UNAVAILABLE";
  }
}

/** Kelas dari model yang belum ada di leaf-class-map.js. */
export class UnknownLeafClassError extends HttpError {
  constructor(label) {
    super(502, `Model mengembalikan kelas "${label}" yang belum terdaftar di pemetaan kelas. Hubungi pengembang untuk memperbarui pemetaan.`);
    this.code = "LEAF_CLASS_UNKNOWN";
  }
}

const pct = (x) => `${Math.round(x * 100)}%`;

/** Ubah keluaran engine (/predict/leaf) menjadi bentuk detectionService + _meta. Melempar UnknownLeafClassError bila kelas tak dikenal. */
export function mapLeafResult(r, { classMap = LEAF_CLASS_MAP, minMargin = env.detectionMinMargin } = {}) {
  const entry = Object.hasOwn(classMap, r?.label) ? classMap[r.label] : null;
  if (!entry) throw new UnknownLeafClassError(r?.label);

  const skor = Number(r.confidence);
  const top = Array.isArray(r.top3) ? r.top3 : [];
  const second = top.length >= 2 ? Number(top[1]?.confidence) : null;
  const margin = Number.isFinite(second) && Number.isFinite(skor) ? Math.round((skor - second) * 10000) / 10000 : null;

  const label = r.label_id ?? r.label;
  const masalah = entry.masalah
    ? [{ nama: entry.masalah.nama, jenis: entry.masalah.jenis, tingkat_keparahan: SEVERITY_ESTIMATED, gejala_terlihat: GEJALA_NETRAL }]
    : [];
  const kondisi = entry.masalah
    ? `Model AgroChie mengenali: ${label}. Tingkat keparahan tidak dapat dipastikan dari model; "${SEVERITY_ESTIMATED}" hanya perkiraan.`
    : `Model AgroChie mengenali: ${label}. Tidak ada masalah yang terdeteksi oleh model.`;

  return {
    tanaman_terlihat: true, // CNN tidak punya kelas "bukan tanaman"; pemeriksa bukan-tanaman = fallback Gemini (bila diaktifkan)
    kondisi,
    kategori_kualitas: entry.kategori_kualitas,
    skor_kepercayaan: skor,
    masalah_terdeteksi: masalah,
    _meta: {
      sumber: "engine",
      model_versi: r.model ?? null,
      kelas: r.label,
      crop: entry.crop,
      margin,
      margin_tipis: margin != null && margin < minMargin,
      keterangan: `skor ${pct(skor)}${margin != null ? `, selisih dengan kelas kedua ${pct(margin)}` : ""}`,
    },
  };
}

/** `leaf` hanya untuk uji (mock). */
export function createEngineProvider({ leaf = engineLeaf, classMap = LEAF_CLASS_MAP, minMargin = env.detectionMinMargin } = {}) {
  return {
    name: "engine",
    async detect(imageBuffer) {
      let result;
      try {
        result = await leaf(Buffer.from(imageBuffer).toString("base64"));
      } catch (e) {
        if (e instanceof HttpError && (e.status === 503 || e.status === 502)) {
          console.error("[deteksi] engine tidak tersedia:", e.message);
          throw new EngineUnavailableError();
        }
        if (e instanceof HttpError && e.status === 400) {
          throw new HttpError(400, "Foto tidak dapat dibaca oleh layanan deteksi. Coba unggah foto lain.");
        }
        throw e;
      }
      return mapLeafResult(result, { classMap, minMargin });
    },
  };
}
