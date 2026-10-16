import { HttpError } from "../utils/http-error.js";
import { TARGETS, LIMITS } from "../services/translate.service.js";

/** Validasi body POST /api/translate. Mengembalikan { target, texts } atau melempar HttpError 400. */
export function parseTranslateBody(body) {
  const { target, texts } = body ?? {};
  if (!TARGETS.includes(target)) throw new HttpError(400, "target harus en atau zh.");
  if (!Array.isArray(texts) || texts.length === 0) throw new HttpError(400, "texts harus berupa daftar teks yang tidak kosong.");
  if (texts.length > LIMITS.maxTexts) throw new HttpError(400, `Maksimal ${LIMITS.maxTexts} teks per permintaan.`);
  if (!texts.every((t) => typeof t === "string")) throw new HttpError(400, "Setiap teks harus berupa string.");
  if (texts.some((t) => t.length > LIMITS.maxTextChars)) throw new HttpError(400, `Setiap teks maksimal ${LIMITS.maxTextChars} karakter.`);
  if (texts.reduce((n, t) => n + t.length, 0) > LIMITS.maxTotalChars) throw new HttpError(400, `Total maksimal ${LIMITS.maxTotalChars} karakter.`);
  return { target, texts };
}
