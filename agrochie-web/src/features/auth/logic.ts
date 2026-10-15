/**
 * Fungsi murni untuk alur auth (tanpa React, tanpa impor) agar bisa diuji dengan `node --test`.
 * Jangan menambah impor antar-file di sini dan jangan memakai enum/parameter property
 * (Node hanya menghapus tipe, tidak mengubah sintaks TS lain).
 */

const AUTH_PATHS = ['/masuk', '/daftar', '/lupa-password', '/reset-password', '/verify-email'];

/** Halaman publik auth: tidak boleh dilempar ke login hanya karena /auth/me membalas 401. */
export function isAuthPagePath(path: string | null | undefined): boolean {
  const p = String(path ?? '').split(/[?#]/)[0];
  return AUTH_PATHS.some(a => p === a || p.startsWith(`${a}/`));
}

/**
 * Tujuan setelah login yang aman dari open redirect. Hanya path internal ("/abc").
 * Menolak "//host", "/\host", karakter kontrol, dan halaman auth (hindari putaran).
 */
export function safeNext(raw: string | null | undefined, fallback = '/beranda'): string {
  if (typeof raw !== 'string') return fallback;
  if (raw.length === 0 || raw.length > 300) return fallback;
  if (raw[0] !== '/' || raw[1] === '/') return fallback;
  if (raw.includes('\\')) return fallback;
  for (let i = 0; i < raw.length; i += 1) {
    const code = raw.charCodeAt(i);
    if (code < 0x20 || code === 0x7f) return fallback;
  }
  if (isAuthPagePath(raw)) return fallback;
  return raw;
}

/** Tujuan setelah masuk/daftar/Google: akun yang belum lengkap ke /profil, selain itu ke `next` aman. */
export function postLoginPath(user: { needsProfileCompletion?: boolean } | null | undefined, next?: string | null): string {
  if (user?.needsProfileCompletion === true) return '/profil';
  return safeNext(next);
}

export type PasswordProblem = 'required' | 'tooShort' | 'tooLong' | 'mismatch';

/** Validasi kata sandi baru + konfirmasi (8-128 karakter, harus sama). null = valid. */
export function checkNewPassword(password: string, confirm: string): PasswordProblem | null {
  if (password.length === 0) return 'required';
  if (password.length < 8) return 'tooShort';
  if (password.length > 128) return 'tooLong';
  if (password !== confirm) return 'mismatch';
  return null;
}

/** Cocokkan galat API dengan status + teks persis (lihat serverMessages.ts). Tahan terhadap nilai bukan galat. */
export function isApiMessage(error: unknown, status: number, text: string): boolean {
  if (typeof error !== 'object' || error === null) return false;
  const e = error as { status?: unknown; message?: unknown };
  return e.status === status && e.message === text;
}

/** True bila galat membawa status HTTP tertentu (mis. 429 untuk cooldown). */
export function isStatus(error: unknown, status: number): boolean {
  return typeof error === 'object' && error !== null && (error as { status?: unknown }).status === status;
}

export type GoogleLoginOutcome = 'failed' | 'server' | 'cooldown' | 'hide' | 'other';

/**
 * Peta galat POST /auth/google ke tindakan UI:
 * 401 -> pesan "login Google gagal", 409 -> tampilkan pesan server, 429 -> cooldown,
 * 503 -> sembunyikan tombol Google, selain itu -> galat umum.
 */
export function googleLoginOutcome(error: unknown): GoogleLoginOutcome {
  if (isStatus(error, 401)) return 'failed';
  if (isStatus(error, 409)) return 'server';
  if (isStatus(error, 429)) return 'cooldown';
  if (isStatus(error, 503)) return 'hide';
  return 'other';
}

/** Lebar tombol Google (px): mengikuti kontainer, minimal 200 (batas Google), maksimal 400. */
export function googleButtonWidth(containerWidth: number): number {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) return 280;
  return Math.max(200, Math.min(400, Math.floor(containerWidth)));
}

/** Email longgar untuk validasi awal di klien; keputusan akhir tetap di server. */
export function looksLikeEmail(value: string): boolean {
  const v = value.trim();
  return v.length > 0 && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
