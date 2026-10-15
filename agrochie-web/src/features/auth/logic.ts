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

/**
 * Keputusan 401 global: apakah klien harus dilempar ke /masuk?
 * Tidak redirect bila: bukan 401; sudah ada redirect berjalan; halaman sekarang publik auth;
 * endpoint /auth/me (ditangani AppShell), /auth/logout; /auth/login, /auth/register, /auth/google
 * (401 = kredensial salah, bukan sesi habis); /auth/google/link hanya bila pesannya
 * `wrongPassword` atau `googleTokenInvalid` (dioper dari serverMessages.ts).
 */
export function shouldRedirectOn401(input: {
  status: number; message: string; requestPath: string; currentPath: string; redirecting: boolean;
  wrongPassword: string; googleTokenInvalid: string;
  skipGlobal401?: boolean; // pengecualian sempit: hanya berlaku untuk /auth/email (alur daftar)
}): boolean {
  if (input.status !== 401 || input.redirecting) return false;
  if (isAuthPagePath(input.currentPath)) return false;
  const p = input.requestPath.split(/[?#]/)[0];
  if (input.skipGlobal401 === true && p === '/auth/email') return false;
  if (p === '/auth/me' || p === '/auth/logout') return false;
  if (p === '/auth/login' || p === '/auth/register' || p === '/auth/google') return false;
  if (p === '/auth/google/link' && (input.message === input.wrongPassword || input.message === input.googleTokenInvalid)) return false;
  // [REVISI] B7: re-autentikasi di tiga path perubahan akun; hanya dua pesan ini, path persis.
  if (REAUTH_PATHS.includes(p) && (input.message === input.wrongPassword || input.message === input.googleTokenInvalid)) return false;
  return true;
}

// [REVISI] B7: path perubahan akun yang memakai re-autentikasi (API_AUTH.md 3.13-3.15).
const REAUTH_PATHS = ['/auth/phone', '/auth/email/remove', '/auth/google/unlink'];

/** Bahasa untuk field `lang` backend: hanya id/en; zh dikirim sebagai en (API_AUTH.md bagian 5). */
export function apiLang(lang: string | null | undefined): 'id' | 'en' {
  return lang === 'id' ? 'id' : 'en';
}

type AccountLike = {
  isGuest?: boolean; phone?: string | null; email?: string | null; hasPassword?: boolean; hasGoogle?: boolean;
} | null | undefined;

const filled = (v: unknown) => v !== null && v !== undefined && v !== '';

/** Cermin backend countLoginMethods: password dihitung bila ada DAN (HP atau email); Google bila tertaut. */
export function loginMethodCount(account: AccountLike, change: { phone?: string | null; email?: string | null; hasGoogle?: boolean } = {}): number {
  const a = { ...(account ?? {}), ...change };
  const password = a.hasPassword === true && (filled(a.phone) || filled(a.email));
  const google = a.hasGoogle === true;
  return Number(password) + Number(google);
}

/** Hapus email: bukan tamu, email ada, dan sesudahnya masih ada minimal satu metode login. */
export function canRemoveEmail(account: AccountLike): boolean {
  return !!account && account.isGuest !== true && filled(account.email) && loginMethodCount(account, { email: null }) >= 1;
}

/** Lepas Google: bukan tamu, Google tertaut, dan sesudahnya masih ada minimal satu metode login. */
export function canUnlinkGoogle(account: AccountLike): boolean {
  return !!account && account.isGuest !== true && account.hasGoogle === true && loginMethodCount(account, { hasGoogle: false }) >= 1;
}

/** Jenis re-autentikasi ditentukan akun: ber-password -> kata sandi, selain itu token Google. */
export function reauthKind(account: AccountLike): 'password' | 'google' {
  return account?.hasPassword === true ? 'password' : 'google';
}

export type PhoneProblem = 'required' | 'invalid' | 'same';

/** Validasi nomor HP di klien: 8-15 digit setelah non-angka dibuang; sama dengan nomor sekarang ditolak. */
export function phoneProblem(value: string, current?: string | null): PhoneProblem | null {
  const digits = value.replace(/\D/g, '');
  if (value.trim() === '') return 'required';
  if (digits.length < 8 || digits.length > 15) return 'invalid';
  if (filled(current) && String(current).replace(/\D/g, '') === digits) return 'same';
  return null;
}

export type AccountActionOutcome =
  | 'wrongPassword' | 'wrongGoogle' | 'closeCooldown' | 'lastMethod' | 'phoneTaken'
  | 'busy' | 'stale' | 'hide' | 'unavailable' | 'other';

/** Peta galat POST /auth/phone, /auth/email/remove, /auth/google/unlink ke tindakan UI (API_AUTH.md 3.13-3.15). */
export function accountActionOutcome(
  error: unknown,
  msg: { wrongPassword: string; googleTokenInvalid: string; lastLoginMethod: string; phoneUnavailable: string; accountBusy: string },
): AccountActionOutcome {
  if (isApiMessage(error, 401, msg.wrongPassword)) return 'wrongPassword';
  if (isApiMessage(error, 401, msg.googleTokenInvalid)) return 'wrongGoogle';
  if (isStatus(error, 429)) return 'closeCooldown';
  if (isApiMessage(error, 409, msg.lastLoginMethod)) return 'lastMethod';
  if (isApiMessage(error, 409, msg.phoneUnavailable)) return 'phoneTaken';
  if (isApiMessage(error, 409, msg.accountBusy)) return 'busy';
  if (isStatus(error, 409) || isStatus(error, 400)) return 'stale';
  if (isStatus(error, 403)) return 'hide';
  if (isStatus(error, 503)) return 'unavailable';
  return 'other';
}

/** Tujuan redirect 401: /masuk dengan ?next= aman (halaman auth/aneh -> tanpa next). */
export function loginRedirectUrl(currentPath: string, search = ''): string {
  const full = `${currentPath}${search}`;
  const next = safeNext(full, '');
  return next ? `/masuk?next=${encodeURIComponent(next)}` : '/masuk';
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

/** Banner email: hanya untuk akun bukan tamu yang emailnya kosong/belum terverifikasi, dan belum ditutup. */
export function shouldShowEmailBanner(
  account: { isGuest?: boolean; email?: string | null; emailVerified?: boolean } | null | undefined,
  dismissed: boolean,
): boolean {
  if (!account || dismissed || account.isGuest !== false) return false;
  return !account.email || account.emailVerified !== true;
}

// [REVISI] A5: status banner email "ditutup" disimpan per sesi tab (sessionStorage), kunci per id akun, nilainya hanya "1".
type StorageLike = { getItem(k: string): string | null; setItem(k: string, v: string): void };

export function bannerDismissKey(accountId: string | null | undefined): string | null {
  return typeof accountId === 'string' && accountId.length > 0 ? `agrochie:email-banner-dismissed:${accountId}` : null;
}

/** Baca status ditutup. Storage tidak ada/diblokir/melempar galat -> false (banner tetap tampil). */
export function readBannerDismissed(storage: StorageLike | null | undefined, accountId: string | null | undefined): boolean {
  const key = bannerDismissKey(accountId);
  if (!key || !storage) return false;
  try { return storage.getItem(key) === '1'; } catch { return false; }
}

/** Simpan status ditutup. Gagal menulis diabaikan (penutupan tetap berlaku di memori). */
export function writeBannerDismissed(storage: StorageLike | null | undefined, accountId: string | null | undefined): void {
  const key = bannerDismissKey(accountId);
  if (!key || !storage) return;
  try { storage.setItem(key, '1'); } catch { /* storage diblokir atau penuh */ }
}

/**
 * [REVISI] A4: focus trap modal. Menentukan indeks elemen yang harus difokuskan saat Tab/Shift+Tab ditekan.
 * Mengembalikan null bila perilaku bawaan browser sudah benar (fokus pindah di dalam daftar),
 * -1 bila tidak ada elemen fokusable (fokus ditahan di dialog), selain itu indeks tujuan (membungkus di ujung).
 * activeIndex = -1 berarti fokus saat ini bukan salah satu elemen daftar (mis. di dalam iframe atau di dialog).
 */
export function trapFocusIndex(count: number, activeIndex: number, shift: boolean): number | null {
  if (!(count > 0)) return -1;
  if (activeIndex < 0) return shift ? count - 1 : 0;
  if (!shift && activeIndex === count - 1) return 0;
  if (shift && activeIndex === 0) return count - 1;
  return null;
}

export type EmailOutcome = 'refresh' | 'hide' | 'conflict' | 'cooldown' | 'sendFailed' | 'unavailable' | 'server';

/** Peta galat POST /auth/email dan /auth/email/resend-verification ke tindakan UI (API_AUTH.md 3.6, 3.7, 4.6). */
export function emailErrorOutcome(error: unknown, alreadyVerifiedText: string): EmailOutcome {
  if (isApiMessage(error, 400, alreadyVerifiedText)) return 'refresh';
  if (isStatus(error, 403)) return 'hide';
  if (isStatus(error, 409)) return 'conflict';
  if (isStatus(error, 429)) return 'cooldown';
  if (isStatus(error, 502)) return 'sendFailed';
  if (isStatus(error, 503)) return 'unavailable';
  return 'server';
}

/** Tombol "Tautkan Google" hanya untuk akun bukan tamu, belum tertaut Google, dan punya kata sandi. */
export function canLinkGoogle(
  account: { isGuest?: boolean; hasGoogle?: boolean; hasPassword?: boolean } | null | undefined,
): boolean {
  return !!account && account.isGuest === false && account.hasGoogle === false && account.hasPassword === true;
}

export type LinkOutcome = 'wrongPassword' | 'tokenInvalid' | 'server' | 'closeCooldown' | 'hide' | 'unavailable' | 'other';

/** Peta galat POST /auth/google/link ke tindakan UI (API_AUTH.md 3.12, 4.8). */
export function linkErrorOutcome(error: unknown, wrongPassword: string, googleTokenInvalid: string): LinkOutcome {
  if (isApiMessage(error, 401, wrongPassword)) return 'wrongPassword';
  if (isApiMessage(error, 401, googleTokenInvalid)) return 'tokenInvalid';
  if (isStatus(error, 409)) return 'server';
  if (isStatus(error, 429)) return 'closeCooldown';
  if (isStatus(error, 403)) return 'hide';
  if (isStatus(error, 503)) return 'unavailable';
  return 'other';
}

/** Lebar tombol Google (px): mengikuti kontainer, minimal 200 (batas Google), maksimal 400. */
export function googleButtonWidth(containerWidth: number): number {
  if (!Number.isFinite(containerWidth) || containerWidth <= 0) return 280;
  return Math.max(200, Math.min(400, Math.floor(containerWidth)));
}

export type RegisterEmailFailure = 'conflict' | 'tooMany' | 'sendFailed' | 'unavailable' | 'other';

/** Alasan email gagal tersimpan setelah register berhasil (POST /auth/email di alur daftar). */
export function registerEmailFailure(error: unknown): RegisterEmailFailure {
  if (isStatus(error, 409)) return 'conflict';
  if (isStatus(error, 429)) return 'tooMany';
  if (isStatus(error, 502)) return 'sendFailed';
  if (isStatus(error, 503)) return 'unavailable';
  return 'other';
}

/** Email opsional: kosong = valid; terisi harus lolos looksLikeEmail. */
export function isOptionalEmailValid(value: string): boolean {
  return value.trim() === '' || looksLikeEmail(value);
}

/** Email longgar untuk validasi awal di klien; keputusan akhir tetap di server. */
export function looksLikeEmail(value: string): boolean {
  const v = value.trim();
  return v.length > 0 && v.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v);
}
