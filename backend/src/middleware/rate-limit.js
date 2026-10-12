import { HttpError } from "../utils/http-error.js";

/** Pembatas sederhana di memori, per pengguna. Cukup untuk satu proses; untuk banyak server pakai Redis. */
// [REVISI] bagian 17.5: opsi keyFn (kunci pembatas) dan message. Tanpa keduanya perilaku lama:
// kunci = req.userId, pesan = pesan lama. Setiap pemanggilan rateLimit() punya Map sendiri,
// jadi pembatas berbeda tidak pernah berbagi kunci.
const DEFAULT_MESSAGE = "Terlalu banyak pertanyaan. Coba lagi beberapa menit lagi.";
const byUser = (req) => req.userId;

export function rateLimit({ windowMs = 10 * 60_000, max = 20, keyFn = byUser, message = DEFAULT_MESSAGE } = {}) {
  const hits = new Map();
  return (req, _res, next) => {
    const key = keyFn(req);
    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      hits.set(key, recent);
      return next(new HttpError(429, message));
    }
    recent.push(now);
    hits.set(key, recent);
    next();
  };
}

/** Kunci berbasis IP. Hanya req.ip; X-Forwarded-For ditangani lewat pengaturan trust proxy (sub-langkah 8). */
export const byIp = (req) => req.ip;

/** Login: 10 percobaan per 10 menit per IP. */
export function loginRateLimit() {
  return rateLimit({
    windowMs: 10 * 60_000,
    max: 10,
    keyFn: byIp,
    message: "Terlalu banyak percobaan masuk. Coba lagi beberapa menit lagi.",
  });
}