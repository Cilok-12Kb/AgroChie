import { z } from "zod";
import { HttpError } from "../utils/http-error.js";

// [REVISI] Deteksi kualitas tanaman: validasi unggahan dan isian. Tipe file ditentukan dari isi berkas
// (magic bytes), bukan dari nama atau header klien yang bisa dipalsukan.
export const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp"];
export const EXT_BY_MIME = { "image/jpeg": "jpg", "image/png": "png", "image/webp": "webp" };
export const MAX_NOTE = 500;

/** Mengenali jpg/png/webp dari byte awal. null bila bukan salah satunya (atau berkas rusak/terlalu pendek). */
export function sniffImageMime(buf) {
  if (!Buffer.isBuffer(buf) || buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "image/jpeg";
  if (buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return "image/png";
  if (buf.subarray(0, 4).toString("latin1") === "RIFF" && buf.subarray(8, 12).toString("latin1") === "WEBP") return "image/webp";
  return null;
}

/** Memeriksa berkas hasil multer: ada, tidak kosong, tipe sah menurut isi, dan batas ukuran. Mengembalikan { mime, ext }. */
export function validateImageFile(file, maxBytes) {
  if (!file || !file.buffer) throw new HttpError(400, "Foto wajib diunggah (isian 'foto')");
  if (file.size === 0 || file.buffer.length === 0) throw new HttpError(400, "File foto kosong");
  if (file.buffer.length > maxBytes) throw new HttpError(413, `Foto terlalu besar (maksimal ${Math.round(maxBytes / 1024 / 1024)} MB)`);
  const mime = sniffImageMime(file.buffer);
  if (!mime) throw new HttpError(415, "File bukan foto yang sah atau rusak. Gunakan JPG, PNG, atau WebP");
  return { mime, ext: EXT_BY_MIME[mime] };
}

/** Catatan bebas masuk ke prompt AI sebagai data: buang karakter kontrol dan tanda < >, rapikan spasi, batasi panjang. */
export function sanitizeNote(value) {
  return String(value ?? "")
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    .replace(/[<>`]/g, "")
    .replace(/[ \t]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .trim();
}

export const detectionCreateSchema = z.object({
  lahan_id: z
    .string({ error: "lahan_id wajib" })
    .trim()
    .min(1, "lahan_id wajib")
    .max(64, "lahan_id tidak valid")
    .regex(/^[A-Za-z0-9_-]+$/, "lahan_id tidak valid"),
  catatan: z.string({ error: "catatan harus teks" }).optional(),
  lang: z.enum(["id", "en", "zh"]).optional().default("id"),
});

export function parseDetectionCreate(body) {
  const r = detectionCreateSchema.safeParse(body ?? {});
  if (!r.success) throw new HttpError(400, r.error.issues.map((i) => i.message).join("; "));
  const raw = r.data.catatan ?? "";
  if (raw.length > MAX_NOTE * 2) throw new HttpError(400, `Catatan maksimal ${MAX_NOTE} karakter`);
  const catatan = sanitizeNote(raw);
  if (catatan.length > MAX_NOTE) throw new HttpError(400, `Catatan maksimal ${MAX_NOTE} karakter`);
  return { lahanId: r.data.lahan_id, catatan: catatan || null, lang: r.data.lang };
}

// [REVISI] sub-langkah 3: query riwayat. lahan_id wajib; page >= 1 (bawaan 1); limit 1..50 (bawaan 10).
export const MAX_LIMIT = 50;
export function parseDetectionList(query) {
  const q = query ?? {};
  const lahan = z.string().trim().min(1).max(64).regex(/^[A-Za-z0-9_-]+$/).safeParse(q.lahan_id);
  if (!lahan.success) throw new HttpError(400, "lahan_id wajib dan harus valid");
  const int = (v, name, min, max, fallback) => {
    if (v === undefined || v === "") return fallback;
    if (typeof v !== "string" || !/^\d+$/.test(v) || Number(v) < min || Number(v) > max) {
      throw new HttpError(400, `${name} harus bilangan bulat ${min} sampai ${max}`);
    }
    return Number(v);
  };
  return { lahanId: lahan.data, page: int(q.page, "page", 1, 100000, 1), limit: int(q.limit, "limit", 1, MAX_LIMIT, 10) };
}

