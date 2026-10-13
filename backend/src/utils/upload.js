import multer from "multer";
import { randomUUID } from "node:crypto";
import { mkdir, writeFile, readFile, unlink } from "node:fs/promises"; // [REVISI] unlink
import path from "node:path";
import { env } from "../config/env.js";
import { HttpError } from "./http-error.js";
import { ALLOWED_MIME, EXT_BY_MIME } from "../validators/detection.validator.js";

// [REVISI] Unggahan foto deteksi tanaman. Berkas ditahan di memori (maks DETECTION_MAX_MB, 1 berkas),
// diperiksa isinya, baru ditulis dengan nama acak ke AGROCHIE_UPLOAD_DIR (di luar folder publik).
const KEY_RE = /^[0-9a-f-]{36}\.(jpg|png|webp)$/;

const parser = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: env.detectionMaxBytes, files: 1, fields: 5, fieldSize: 4 * 1024, parts: 8 },
  fileFilter(_req, file, cb) {
    if (file.fieldname !== "foto") return cb(new HttpError(400, "Isian file harus bernama 'foto'"));
    if (!ALLOWED_MIME.includes(file.mimetype)) return cb(new HttpError(415, "Format foto harus JPG, PNG, atau WebP"));
    cb(null, true);
  },
}).single("foto");

/** Middleware Express: mengisi req.file dan req.body; galat multer diubah menjadi HttpError berbahasa Indonesia. */
export function uploadFoto(req, res, next) {
  parser(req, res, (err) => {
    if (!err) return next();
    if (err instanceof HttpError) return next(err);
    if (err instanceof multer.MulterError) {
      const mb = Math.round(env.detectionMaxBytes / 1024 / 1024);
      if (err.code === "LIMIT_FILE_SIZE") return next(new HttpError(413, `Foto terlalu besar (maksimal ${mb} MB)`));
      if (err.code === "LIMIT_UNEXPECTED_FILE") return next(new HttpError(400, "Hanya satu foto pada isian 'foto' yang diterima"));
      return next(new HttpError(400, "Unggahan tidak valid"));
    }
    return next(new HttpError(400, "Unggahan tidak dapat dibaca. Pastikan dikirim sebagai multipart/form-data"));
  });
}

const dir = () => path.resolve(env.uploadDir);

/** Menyimpan byte foto dengan nama acak. Mengembalikan kunci (nama berkas) yang dicatat di database. */
export async function saveImage(buffer, ext) {
  if (!Object.values(EXT_BY_MIME).includes(ext)) throw new HttpError(400, "Ekstensi foto tidak dikenal");
  const key = `${randomUUID()}.${ext}`;
  await mkdir(dir(), { recursive: true });
  await writeFile(path.join(dir(), key), buffer, { flag: "wx" });
  return key;
}

/** [REVISI] sub-langkah 3: hapus satu foto lewat kunci (mis. analisis gagal, agar tidak ada berkas yatim). Senyap bila tidak ada. */
export async function deleteImage(key) {
  if (!KEY_RE.test(String(key))) return;
  await unlink(path.join(dir(), key)).catch(() => {});
}

/** Membaca foto lewat kunci. Kunci dipastikan berpola UUID.ekstensi agar tidak bisa keluar dari folder unggahan. */
export async function readImage(key) {
  if (!KEY_RE.test(String(key))) throw new HttpError(404, "Foto tidak ditemukan");
  try {
    return await readFile(path.join(dir(), key));
  } catch {
    throw new HttpError(404, "Foto tidak ditemukan");
  }
}
