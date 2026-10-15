import { HttpError } from "../utils/http-error.js";

/** Pembatas sederhana di memori, per pengguna. Cukup untuk satu proses; untuk banyak server pakai Redis. */
// [REVISI] bagian 17.5: opsi keyFn (kunci pembatas) dan message. Tanpa keduanya perilaku lama:
// kunci = req.userId, pesan = pesan lama. Setiap pemanggilan rateLimit() punya Map sendiri,
// jadi pembatas berbeda tidak pernah berbagi kunci.
const DEFAULT_MESSAGE = "Terlalu banyak pertanyaan. Coba lagi beberapa menit lagi.";
const byUser = (req) => req.userId;

// [REVISI] Daftar semua Map hitungan, hanya agar _resetForTests() bisa mengosongkannya. Tidak dibaca di runtime.
const allHits = new Set();

/** Hanya untuk tes: kosongkan hitungan semua pembatas. Tidak dipanggil kode produksi. */
export function _resetForTests() {
  for (const m of allHits) m.clear();
}

export function rateLimit({ windowMs = 10 * 60_000, max = 20, keyFn = byUser, message = DEFAULT_MESSAGE } = {}) {
  const hits = new Map();
  allHits.add(hits);
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

/** Mode tamu: 20 akun tamu per jam per IP (agar tabel users tidak dibanjiri). */
export function guestRateLimit() {
  return rateLimit({
    windowMs: 60 * 60_000,
    max: 20,
    keyFn: byIp,
    message: "Terlalu banyak sesi tamu dari alamat ini. Coba lagi nanti.",
  });
}


/** [REVISI] Tambah/kirim ulang email: 10 per 15 menit per IP. */
export function emailRateLimit() {
  return rateLimit({
    windowMs: 15 * 60_000,
    max: 10,
    keyFn: byIp,
    message: "Terlalu banyak permintaan email dari alamat ini. Coba lagi nanti.",
  });
}

/** [REVISI] Verifikasi email: 20 per 15 menit per IP. */
export function verifyEmailRateLimit() {
  return rateLimit({
    windowMs: 15 * 60_000,
    max: 20,
    keyFn: byIp,
    message: "Terlalu banyak percobaan verifikasi. Coba lagi nanti.",
  });
}

/** [REVISI] Lupa password: 5 per 15 menit per IP. */
export function forgotPasswordRateLimit() {
  return rateLimit({
    windowMs: 15 * 60_000,
    max: 5,
    keyFn: byIp,
    message: "Terlalu banyak permintaan reset kata sandi. Coba lagi nanti.",
  });
}

/** [REVISI] Reset password: 10 per 15 menit per IP. */
export function resetPasswordRateLimit() {
  return rateLimit({
    windowMs: 15 * 60_000,
    max: 10,
    keyFn: byIp,
    message: "Terlalu banyak percobaan reset kata sandi. Coba lagi nanti.",
  });
}

/** Login: 10 percobaan per 10 menit per IP. */
export function loginRateLimit() {
  return rateLimit({
    windowMs: 10 * 60_000,
    max: 10,
    keyFn: byIp,
    message: "Terlalu banyak percobaan masuk. Coba lagi beberapa menit lagi.",
  });
}