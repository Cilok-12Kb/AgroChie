import test from 'node:test';
import assert from 'node:assert/strict';
import { registerEmailFailure, isOptionalEmailValid, safeNext, postLoginPath, isAuthPagePath, checkNewPassword, isApiMessage, isStatus, looksLikeEmail, googleLoginOutcome, googleButtonWidth, shouldRedirectOn401, loginRedirectUrl, shouldShowEmailBanner, emailErrorOutcome, canLinkGoogle, linkErrorOutcome, trapFocusIndex, bannerDismissKey, readBannerDismissed, writeBannerDismissed } from './logic.ts';
import { SERVER_MSG } from './serverMessages.ts';
import { apiLang, loginMethodCount, canRemoveEmail, canUnlinkGoogle, reauthKind, phoneProblem, accountActionOutcome } from './logic.ts';

test('safeNext: path internal biasa diterima', () => {
  assert.equal(safeNext('/profil'), '/profil');
  assert.equal(safeNext('/musim-tanam?x=1'), '/musim-tanam?x=1');
});

test('safeNext: menolak open redirect dan nilai aneh', () => {
  for (const bad of ['//evil.com', 'https://evil.com', '/\\evil.com', 'javascript:alert(1)', '', null, undefined, 'profil', '/a\nb', '/' + 'a'.repeat(400)]) {
    assert.equal(safeNext(bad), '/beranda', `harus ditolak: ${String(bad).slice(0, 20)}`);
  }
});

test('safeNext: halaman auth ditolak agar tidak berputar', () => {
  assert.equal(safeNext('/masuk'), '/beranda');
  assert.equal(safeNext('/reset-password?token=x'), '/beranda');
});

test('postLoginPath: akun belum lengkap ke /profil, selain itu ke next aman', () => {
  assert.equal(postLoginPath({ needsProfileCompletion: true }, '/catatan'), '/profil');
  assert.equal(postLoginPath({ needsProfileCompletion: false }, '/catatan'), '/catatan');
  assert.equal(postLoginPath({}, '//evil.com'), '/beranda');
  assert.equal(postLoginPath(null, null), '/beranda');
});

test('isAuthPagePath: lima halaman publik auth', () => {
  for (const p of ['/masuk', '/daftar', '/lupa-password', '/reset-password', '/verify-email', '/masuk?next=/x']) assert.equal(isAuthPagePath(p), true, p);
  for (const p of ['/', '/beranda', '/profil', '', null, undefined]) assert.equal(isAuthPagePath(p), false, String(p));
});

test('checkNewPassword: aturan 8-128 dan konfirmasi', () => {
  assert.equal(checkNewPassword('', ''), 'required');
  assert.equal(checkNewPassword('1234567', '1234567'), 'tooShort');
  assert.equal(checkNewPassword('a'.repeat(129), 'a'.repeat(129)), 'tooLong');
  assert.equal(checkNewPassword('12345678', '12345679'), 'mismatch');
  assert.equal(checkNewPassword('12345678', '12345678'), null);
  assert.equal(checkNewPassword('a'.repeat(128), 'a'.repeat(128)), null);
});

test('isApiMessage: cocok hanya bila status DAN teks sama', () => {
  const err = { status: 401, message: SERVER_MSG.wrongPassword };
  assert.equal(isApiMessage(err, 401, SERVER_MSG.wrongPassword), true);
  assert.equal(isApiMessage(err, 400, SERVER_MSG.wrongPassword), false);
  assert.equal(isApiMessage(err, 401, SERVER_MSG.googleTokenInvalid), false);
  assert.equal(isApiMessage(null, 401, 'x'), false);
  assert.equal(isApiMessage('teks', 401, 'x'), false);
});

test('isStatus: hanya cocok bila status sama', () => {
  assert.equal(isStatus({ status: 429 }, 429), true);
  assert.equal(isStatus({ status: 401 }, 429), false);
  assert.equal(isStatus(null, 429), false);
  assert.equal(isStatus(new Error('x'), 429), false);
});

test('googleLoginOutcome: peta status ke tindakan', () => {
  assert.equal(googleLoginOutcome({ status: 401 }), 'failed');
  assert.equal(googleLoginOutcome({ status: 409 }), 'server');
  assert.equal(googleLoginOutcome({ status: 429 }), 'cooldown');
  assert.equal(googleLoginOutcome({ status: 503 }), 'hide');
  assert.equal(googleLoginOutcome({ status: 500 }), 'other');
  assert.equal(googleLoginOutcome(new Error('x')), 'other');
  assert.equal(googleLoginOutcome(null), 'other');
});

test('googleButtonWidth: dijepit 200..400', () => {
  assert.equal(googleButtonWidth(290.7), 290);
  assert.equal(googleButtonWidth(120), 200);
  assert.equal(googleButtonWidth(900), 400);
  assert.equal(googleButtonWidth(0), 280);
  assert.equal(googleButtonWidth(NaN), 280);
});

const base = { status: 401, message: 'Belum masuk', requestPath: '/farms', currentPath: '/profil', redirecting: false,
  wrongPassword: SERVER_MSG.wrongPassword, googleTokenInvalid: SERVER_MSG.googleTokenInvalid };

test('shouldRedirectOn401: 401 biasa di halaman terlindungi -> redirect', () => {
  assert.equal(shouldRedirectOn401(base), true);
});

test('shouldRedirectOn401: bukan 401, redirect berjalan, atau halaman publik -> tidak', () => {
  assert.equal(shouldRedirectOn401({ ...base, status: 403 }), false);
  assert.equal(shouldRedirectOn401({ ...base, redirecting: true }), false);
  for (const p of ['/masuk', '/daftar', '/lupa-password', '/reset-password', '/verify-email']) {
    assert.equal(shouldRedirectOn401({ ...base, currentPath: p }), false, p);
  }
});

test('shouldRedirectOn401: pengecualian endpoint auth', () => {
  for (const p of ['/auth/me', '/auth/logout', '/auth/login', '/auth/register', '/auth/google']) {
    assert.equal(shouldRedirectOn401({ ...base, requestPath: p }), false, p);
  }
});

test('shouldRedirectOn401: google/link hanya dikecualikan untuk dua pesan', () => {
  const link = { ...base, requestPath: '/auth/google/link' };
  assert.equal(shouldRedirectOn401({ ...link, message: SERVER_MSG.wrongPassword }), false);
  assert.equal(shouldRedirectOn401({ ...link, message: SERVER_MSG.googleTokenInvalid }), false);
  assert.equal(shouldRedirectOn401({ ...link, message: 'Belum masuk' }), true);
});

test('loginRedirectUrl: next aman atau tanpa next', () => {
  assert.equal(loginRedirectUrl('/profil'), '/masuk?next=%2Fprofil');
  assert.equal(loginRedirectUrl('/catatan', '?a=1'), '/masuk?next=%2Fcatatan%3Fa%3D1');
  assert.equal(loginRedirectUrl('//evil.com'), '/masuk');
  assert.equal(loginRedirectUrl('/verify-email'), '/masuk');
});

test('shouldShowEmailBanner: aturan tampil dan ditutup', () => {
  assert.equal(shouldShowEmailBanner({ isGuest: false, email: null }, false), true);
  assert.equal(shouldShowEmailBanner({ isGuest: false, email: 'a@b.id', emailVerified: false }, false), true);
  assert.equal(shouldShowEmailBanner({ isGuest: false, email: 'a@b.id', emailVerified: true }, false), false);
  assert.equal(shouldShowEmailBanner({ isGuest: true, email: null }, false), false);
  assert.equal(shouldShowEmailBanner({ isGuest: false, email: null }, true), false);
  assert.equal(shouldShowEmailBanner({ email: null }, false), false);
  assert.equal(shouldShowEmailBanner(null, false), false);
});

test('emailErrorOutcome: peta status', () => {
  const v = SERVER_MSG.emailAlreadyVerified;
  assert.equal(emailErrorOutcome({ status: 400, message: v }, v), 'refresh');
  assert.equal(emailErrorOutcome({ status: 400, message: 'Format email tidak valid' }, v), 'server');
  assert.equal(emailErrorOutcome({ status: 403 }, v), 'hide');
  assert.equal(emailErrorOutcome({ status: 409 }, v), 'conflict');
  assert.equal(emailErrorOutcome({ status: 429 }, v), 'cooldown');
  assert.equal(emailErrorOutcome({ status: 502 }, v), 'sendFailed');
  assert.equal(emailErrorOutcome({ status: 503 }, v), 'unavailable');
  assert.equal(emailErrorOutcome(new Error('x'), v), 'server');
});

test('canLinkGoogle: syarat tombol tautkan', () => {
  assert.equal(canLinkGoogle({ isGuest: false, hasGoogle: false, hasPassword: true }), true);
  assert.equal(canLinkGoogle({ isGuest: true, hasGoogle: false, hasPassword: true }), false);
  assert.equal(canLinkGoogle({ isGuest: false, hasGoogle: true, hasPassword: true }), false);
  assert.equal(canLinkGoogle({ isGuest: false, hasGoogle: false, hasPassword: false }), false);
  assert.equal(canLinkGoogle({ isGuest: false }), false);
  assert.equal(canLinkGoogle(null), false);
});

test('linkErrorOutcome: peta status dan pesan', () => {
  const w = SERVER_MSG.wrongPassword;
  const t = SERVER_MSG.googleTokenInvalid;
  assert.equal(linkErrorOutcome({ status: 401, message: w }, w, t), 'wrongPassword');
  assert.equal(linkErrorOutcome({ status: 401, message: t }, w, t), 'tokenInvalid');
  assert.equal(linkErrorOutcome({ status: 401, message: 'Belum masuk' }, w, t), 'other');
  assert.equal(linkErrorOutcome({ status: 409, message: 'x' }, w, t), 'server');
  assert.equal(linkErrorOutcome({ status: 429 }, w, t), 'closeCooldown');
  assert.equal(linkErrorOutcome({ status: 403 }, w, t), 'hide');
  assert.equal(linkErrorOutcome({ status: 503 }, w, t), 'unavailable');
  assert.equal(linkErrorOutcome({ status: 400 }, w, t), 'other');
  assert.equal(linkErrorOutcome(null, w, t), 'other');
});

test('looksLikeEmail', () => {
  assert.equal(looksLikeEmail('budi@contoh.id'), true);
  assert.equal(looksLikeEmail(' budi@contoh.id '), true);
  assert.equal(looksLikeEmail('budi@'), false);
  assert.equal(looksLikeEmail('081234567890'), false);
  assert.equal(looksLikeEmail(''), false);
});


// [REVISI] A5: banner email ditutup per sesi tab, kunci per id akun.
const fakeStorage = () => { const m = new Map(); return { getItem: k => (m.has(k) ? m.get(k) : null), setItem: (k, v) => { m.set(k, v); }, _m: m }; };

test('bannerDismissKey: per id akun; id kosong -> null', () => {
  assert.equal(bannerDismissKey('u1'), 'agrochie:email-banner-dismissed:u1');
  assert.notEqual(bannerDismissKey('u1'), bannerDismissKey('u2'));
  for (const bad of ['', null, undefined]) assert.equal(bannerDismissKey(bad), null);
});

test('readBannerDismissed/writeBannerDismissed: bertahan per akun, tidak bocor ke akun lain', () => {
  const s = fakeStorage();
  assert.equal(readBannerDismissed(s, 'u1'), false);
  writeBannerDismissed(s, 'u1');
  assert.equal(readBannerDismissed(s, 'u1'), true);
  assert.equal(readBannerDismissed(s, 'u2'), false);
  assert.deepEqual([...s._m.values()], ['1']); // hanya penanda, tanpa data akun
});

test('banner email: storage null/diblokir tidak melempar galat dan banner tetap tampil', () => {
  const boom = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } };
  assert.equal(readBannerDismissed(boom, 'u1'), false);
  assert.doesNotThrow(() => writeBannerDismissed(boom, 'u1'));
  assert.equal(readBannerDismissed(null, 'u1'), false);
  assert.doesNotThrow(() => writeBannerDismissed(null, 'u1'));
  assert.equal(readBannerDismissed(fakeStorage(), null), false);
  assert.equal(shouldShowEmailBanner({ isGuest: false, email: null }, readBannerDismissed(boom, 'u1')), true);
});

// [REVISI] A4: focus trap modal tautkan Google.
test('trapFocusIndex: Tab di elemen terakhir membungkus ke pertama, Shift+Tab di pertama ke terakhir', () => {
  assert.equal(trapFocusIndex(3, 2, false), 0);
  assert.equal(trapFocusIndex(3, 0, true), 2);
  assert.equal(trapFocusIndex(1, 0, false), 0);
  assert.equal(trapFocusIndex(1, 0, true), 0);
});

test('trapFocusIndex: di tengah daftar dibiarkan ke perilaku bawaan browser (null)', () => {
  assert.equal(trapFocusIndex(3, 0, false), null);
  assert.equal(trapFocusIndex(3, 1, false), null);
  assert.equal(trapFocusIndex(3, 1, true), null);
  assert.equal(trapFocusIndex(3, 2, true), null);
});

test('trapFocusIndex: fokus di luar daftar ditarik masuk; daftar kosong menahan fokus di dialog (-1)', () => {
  assert.equal(trapFocusIndex(3, -1, false), 0);
  assert.equal(trapFocusIndex(3, -1, true), 2);
  assert.equal(trapFocusIndex(0, -1, false), -1);
  assert.equal(trapFocusIndex(0, -1, true), -1);
  assert.equal(trapFocusIndex(Number.NaN, 0, false), -1);
});

test('registerEmailFailure: peta status ke alasan', () => {
  assert.equal(registerEmailFailure({ status: 409 }), 'conflict');
  assert.equal(registerEmailFailure({ status: 429 }), 'tooMany');
  assert.equal(registerEmailFailure({ status: 502 }), 'sendFailed');
  assert.equal(registerEmailFailure({ status: 503 }), 'unavailable');
  assert.equal(registerEmailFailure({ status: 401 }), 'other');
  assert.equal(registerEmailFailure(new TypeError('network')), 'other');
});

test('shouldRedirectOn401: pengecualian skipGlobal401 hanya untuk /auth/email', () => {
  const base = { status: 401, message: 'Belum masuk', currentPath: '/daftar', redirecting: false, wrongPassword: SERVER_MSG.wrongPassword, googleTokenInvalid: SERVER_MSG.googleTokenInvalid };
  const prof = { ...base, currentPath: '/profil' };
  assert.equal(shouldRedirectOn401({ ...prof, requestPath: '/auth/email', skipGlobal401: true }), false);
  assert.equal(shouldRedirectOn401({ ...prof, requestPath: '/auth/email' }), true);
  assert.equal(shouldRedirectOn401({ ...prof, requestPath: '/auth/email', skipGlobal401: false }), true);
  assert.equal(shouldRedirectOn401({ ...prof, requestPath: '/lahan', skipGlobal401: true }), true);
});

test('isOptionalEmailValid: kosong valid, terisi harus berformat email', () => {
  assert.equal(isOptionalEmailValid(''), true);
  assert.equal(isOptionalEmailValid('   '), true);
  assert.equal(isOptionalEmailValid('budi@contoh.id'), true);
  assert.equal(isOptionalEmailValid('budi@'), false);
});


// [REVISI] B7-4: perubahan akun. Fixture = tabel keputusan docs/rencana-kelompok-b.md §2 (sama dengan tes backend).
const A = (o) => ({ isGuest: false, phone: null, email: null, hasPassword: false, hasGoogle: false, ...o });
const ROWS = [
  // [baris, akun, metode, hapusEmail, lepasGoogle, reauth]
  [1, A({ hasPassword: true, phone: '0811' }), 1, false, false, 'password'],
  [2, A({ hasPassword: true, phone: '0811', email: 'a@b.id' }), 1, true, false, 'password'],
  [3, A({ hasPassword: true, phone: '0811', email: 'a@b.id' }), 1, true, false, 'password'],
  [4, A({ hasPassword: true, phone: '0811', email: 'a@b.id', hasGoogle: true }), 2, true, true, 'password'],
  [5, A({ hasPassword: true, phone: '0811', hasGoogle: true }), 2, false, true, 'password'],
  [6, A({ email: 'a@b.id', hasGoogle: true }), 1, true, false, 'google'],
  [7, A({ phone: '0811', email: 'a@b.id', hasGoogle: true }), 1, true, false, 'google'],
  [8, A({ hasPassword: true, email: 'a@b.id', hasGoogle: true }), 2, true, true, 'password'],
  [9, A({ hasPassword: true, email: 'a@b.id' }), 1, false, false, 'password'],
  [10, A({ hasPassword: true, hasGoogle: true }), 1, false, false, 'password'],
  [11, A({ hasGoogle: true }), 1, false, false, 'google'],
];

test('tabel keputusan §2: loginMethodCount, canRemoveEmail, canUnlinkGoogle, reauthKind', () => {
  for (const [row, acc, count, rm, un, kind] of ROWS) {
    assert.equal(loginMethodCount(acc), count, `baris ${row} jumlah metode`);
    assert.equal(canRemoveEmail(acc), rm, `baris ${row} hapus email`);
    assert.equal(canUnlinkGoogle(acc), un, `baris ${row} lepas Google`);
    assert.equal(reauthKind(acc), kind, `baris ${row} re-auth`);
  }
});

test('tabel keputusan §2: tamu dan akun kosong tidak bisa hapus email/lepas Google', () => {
  const guest = { isGuest: true };
  assert.equal(canRemoveEmail(guest), false);
  assert.equal(canUnlinkGoogle(guest), false);
  assert.equal(canRemoveEmail(null), false);
  assert.equal(canUnlinkGoogle(undefined), false);
  assert.equal(loginMethodCount(A({})), 0); // baris 13
  assert.equal(canRemoveEmail(A({ email: 'a@b.id' })), false);
});

const REAUTH = ['/auth/phone', '/auth/email/remove', '/auth/google/unlink'];
const base401 = { status: 401, currentPath: '/profil', redirecting: false, wrongPassword: SERVER_MSG.wrongPassword, googleTokenInvalid: SERVER_MSG.googleTokenInvalid };

test('shouldRedirectOn401: tiga path baru tidak redirect untuk Kata sandi salah / Token Google tidak valid', () => {
  for (const requestPath of REAUTH) {
    for (const message of [SERVER_MSG.wrongPassword, SERVER_MSG.googleTokenInvalid]) {
      assert.equal(shouldRedirectOn401({ ...base401, requestPath, message }), false, `${requestPath} ${message}`);
      assert.equal(shouldRedirectOn401({ ...base401, requestPath: `${requestPath}?x=1`, message }), false);
    }
  }
});

test('shouldRedirectOn401: Belum masuk dan pesan lain pada tiga path baru tetap redirect', () => {
  for (const requestPath of REAUTH) {
    assert.equal(shouldRedirectOn401({ ...base401, requestPath, message: 'Belum masuk' }), true);
    assert.equal(shouldRedirectOn401({ ...base401, requestPath, message: 'Lainnya' }), true);
  }
});

test('shouldRedirectOn401: pesan re-auth pada path lain tetap redirect; aturan lama tidak berubah', () => {
  for (const requestPath of ['/lahan', '/auth/email', '/auth/phone/x', '/auth/email/remove/x']) {
    assert.equal(shouldRedirectOn401({ ...base401, requestPath, message: SERVER_MSG.wrongPassword }), true, requestPath);
  }
  assert.equal(shouldRedirectOn401({ ...base401, requestPath: '/auth/google/link', message: SERVER_MSG.wrongPassword }), false);
  assert.equal(shouldRedirectOn401({ ...base401, requestPath: '/auth/google/link', message: 'Belum masuk' }), true);
});


test('phoneProblem: kosong, terlalu pendek/panjang, format spasi/strip, sama dengan nomor sekarang', () => {
  assert.equal(phoneProblem(''), 'required');
  assert.equal(phoneProblem('   '), 'required');
  assert.equal(phoneProblem('1234567'), 'invalid');
  assert.equal(phoneProblem('abc'), 'invalid');
  assert.equal(phoneProblem('1'.repeat(16)), 'invalid');
  assert.equal(phoneProblem('12345678'), null);
  assert.equal(phoneProblem('1'.repeat(15)), null);
  assert.equal(phoneProblem('0812-3456 789'), null);
  assert.equal(phoneProblem('0812-3456 789', '08123456789'), 'same');
  assert.equal(phoneProblem('0812-3456 788', '08123456789'), null);
  assert.equal(phoneProblem('08123456789', null), null);
});

test('accountActionOutcome: peta status dan pesan ke tindakan UI', () => {
  const m = { wrongPassword: SERVER_MSG.wrongPassword, googleTokenInvalid: SERVER_MSG.googleTokenInvalid, lastLoginMethod: SERVER_MSG.lastLoginMethod, phoneUnavailable: SERVER_MSG.phoneUnavailable, accountBusy: SERVER_MSG.accountBusy };
  const o = (status, message = '') => accountActionOutcome({ status, message }, m);
  assert.equal(o(401, SERVER_MSG.wrongPassword), 'wrongPassword');
  assert.equal(o(401, SERVER_MSG.googleTokenInvalid), 'wrongGoogle');
  assert.equal(o(401, 'Belum masuk'), 'other');
  assert.equal(o(429, 'apa saja'), 'closeCooldown');
  assert.equal(o(409, SERVER_MSG.lastLoginMethod), 'lastMethod');
  assert.equal(o(409, SERVER_MSG.phoneUnavailable), 'phoneTaken');
  assert.equal(o(409, SERVER_MSG.accountBusy), 'busy');
  assert.equal(o(409, 'lain'), 'stale');
  assert.equal(o(400, 'Belum ada email di akun ini'), 'stale');
  assert.equal(o(403, 'Tidak diizinkan'), 'hide');
  assert.equal(o(503, 'Login Google belum dikonfigurasi'), 'unavailable');
  assert.equal(o(500, 'x'), 'other');
  assert.equal(accountActionOutcome(new TypeError('network'), m), 'other');
});

test('apiLang: zh dikirim sebagai en; id tetap id', () => {
  assert.equal(apiLang('id'), 'id');
  assert.equal(apiLang('en'), 'en');
  assert.equal(apiLang('zh'), 'en');
  assert.equal(apiLang(undefined), 'en');
});

test('SERVER_MSG B7 persis sama dengan API_AUTH.md', () => {
  assert.equal(SERVER_MSG.lastLoginMethod, 'Tidak bisa menghapus metode masuk terakhir.');
  assert.equal(SERVER_MSG.phoneUnavailable, 'Nomor HP tidak dapat digunakan.');
  assert.equal(SERVER_MSG.accountBusy, 'Akun sedang diproses. Coba lagi.');
});

