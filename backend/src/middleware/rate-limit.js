import { HttpError } from "../utils/http-error.js";

/** Pembatas sederhana di memori, per pengguna. Cukup untuk satu proses; untuk banyak server pakai Redis. */
export function rateLimit({ windowMs = 10 * 60_000, max = 20 } = {}) {
  const hits = new Map();
  return (req, _res, next) => {
    const now = Date.now();
    const recent = (hits.get(req.userId) ?? []).filter((t) => now - t < windowMs);
    if (recent.length >= max) {
      hits.set(req.userId, recent);
      return next(new HttpError(429, "Terlalu banyak pertanyaan. Coba lagi beberapa menit lagi."));
    }
    recent.push(now);
    hits.set(req.userId, recent);
    next();
  };
}