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

const COPY = {
  id: {
    estimated: SEVERITY_ESTIMATED,
    symptom: GEJALA_NETRAL,
    sick: (label) => `Model AgroChie mengenali: ${label}. Tingkat keparahan tidak dapat dipastikan dari model; "${SEVERITY_ESTIMATED}" hanya perkiraan.`,
    healthy: (label) => `Model AgroChie mengenali: ${label}. Tidak ada masalah yang terdeteksi oleh model.`,
  },
  en: {
    estimated: "sedang",
    symptom: "Detected by the leaf classification model; the model does not describe symptoms in detail.",
    sick: (label) => `The AgroChie model identified: ${label}. The model cannot determine severity; the medium severity level is only an estimate.`,
    healthy: (label) => `The AgroChie model identified: ${label}. The model detected no problems.`,
  },
  zh: {
    estimated: "sedang",
    symptom: "由叶片分类模型检测；该模型无法详细描述症状。",
    sick: (label) => `AgroChie 模型识别为：${label}。模型无法确定严重程度；中等严重程度仅为估计。`,
    healthy: (label) => `AgroChie 模型识别为：${label}。模型未检测到问题。`,
  },
};
const PROBLEM_NAME = {
  en: {
    "Bercak daun Cercospora": "Cercospora leaf spot",
    "Keriting daun (kompleks murda: tungau dan thrips)": "Leaf curl (mite and thrips complex)",
    "Gangguan hara (nutrisi)": "Nutrient deficiency",
    "Embun tepung": "Powdery mildew",
    "Bercak bakteri": "Bacterial spot",
    "Jamur hitam": "Black mold",
    "Bercak abu-abu": "Gray leaf spot",
    "Hawar daun (late blight)": "Late blight",
  },
  zh: {
    "Bercak daun Cercospora": "尾孢叶斑病",
    "Keriting daun (kompleks murda: tungau dan thrips)": "卷叶（螨虫和蓟马复合危害）",
    "Gangguan hara (nutrisi)": "营养缺乏",
    "Embun tepung": "白粉病",
    "Bercak bakteri": "细菌性斑点病",
    "Jamur hitam": "黑霉病",
    "Bercak abu-abu": "灰斑病",
    "Hawar daun (late blight)": "晚疫病",
  },
};
const problemName = (name, lang) => PROBLEM_NAME[lang]?.[name] ?? name;

/** Ubah keluaran engine (/predict/leaf) menjadi bentuk detectionService + _meta. Melempar UnknownLeafClassError bila kelas tak dikenal. */
export function mapLeafResult(r, { classMap = LEAF_CLASS_MAP, minMargin = env.detectionMinMargin, lang = "id" } = {}) {
  const entry = Object.hasOwn(classMap, r?.label) ? classMap[r.label] : null;
  if (!entry) throw new UnknownLeafClassError(r?.label);

  const skor = Number(r.confidence);
  const top = Array.isArray(r.top3) ? r.top3 : [];
  const second = top.length >= 2 ? Number(top[1]?.confidence) : null;
  const margin = Number.isFinite(second) && Number.isFinite(skor) ? Math.round((skor - second) * 10000) / 10000 : null;

  const label = r.label_id ?? r.label;
  const copy = COPY[lang] ?? COPY.id;
  const masalah = entry.masalah
    ? [{ nama: problemName(entry.masalah.nama, lang), jenis: entry.masalah.jenis, tingkat_keparahan: copy.estimated, gejala_terlihat: copy.symptom }]
    : [];
  const kondisi = entry.masalah
    ? copy.sick(label)
    : copy.healthy(label);

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
    async detect(imageBuffer, _mimeType, context = {}) {
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
      return mapLeafResult(result, { classMap, minMargin, lang: context.lang });
    },
  };
}
