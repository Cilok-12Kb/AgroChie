import test from 'node:test';
import assert from 'node:assert/strict';
import { safeNext, postLoginPath, isAuthPagePath, checkNewPassword, isApiMessage, looksLikeEmail } from './logic.ts';
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

test('looksLikeEmail', () => {
  assert.equal(looksLikeEmail('budi@contoh.id'), true);
  assert.equal(looksLikeEmail(' budi@contoh.id '), true);
  assert.equal(looksLikeEmail('budi@'), false);
  assert.equal(looksLikeEmail('081234567890'), false);
  assert.equal(looksLikeEmail(''), false);
});
