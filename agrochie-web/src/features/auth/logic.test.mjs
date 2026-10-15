import test from 'node:test';
import assert from 'node:assert/strict';
import { registerEmailFailure, isOptionalEmailValid, safeNext, postLoginPath, isAuthPagePath, checkNewPassword, isApiMessage, isStatus, looksLikeEmail, googleLoginOutcome, googleButtonWidth, shouldRedirectOn401, loginRedirectUrl, shouldShowEmailBanner, emailErrorOutcome, canLinkGoogle, linkErrorOutcome } from './logic.ts';
import { SERVER_MSG } from './serverMessages.ts';

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
