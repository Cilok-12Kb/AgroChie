import { test } from "node:test";
import assert from "node:assert/strict";
import {
  parseSetEmail, parseForgotPassword, parseVerifyEmail, parseResetPassword, parseGoogle,
} from "../src/validators/auth-email.validator.js";

test("email: trim + lowercase", () => {
  assert.equal(parseSetEmail({ email: "  Budi.Santoso@Contoh.ID  " }).email, "budi.santoso@contoh.id");
  assert.equal(parseForgotPassword({ email: "A@B.CO" }).email, "a@b.co");
});

test("email: format salah, kosong, tipe salah, terlalu panjang ditolak 400", () => {
  for (const email of ["", "   ", "tanpa-at", "a@", "@b.co", "a b@c.co", 123, null, undefined, "a@" + "b".repeat(260) + ".co"]) {
    assert.throws(() => parseForgotPassword({ email }), { status: 400 }, String(email));
  }
  assert.throws(() => parseForgotPassword(undefined), { status: 400 });
});

test("lang opsional: nilai aneh tidak menolak permintaan", () => {
  assert.equal(parseForgotPassword({ email: "a@b.co", lang: "EN" }).lang, "en");
  assert.equal(parseForgotPassword({ email: "a@b.co" }).lang, undefined);
  assert.equal(parseForgotPassword({ email: "a@b.co", lang: 5 }).lang, undefined);
});

test("token verifikasi: base64url diterima, karakter asing dan kosong ditolak", () => {
  assert.equal(parseVerifyEmail({ token: " abc_DEF-123 " }).token, "abc_DEF-123");
  for (const token of ["", "a b", "a/b", "a+b", "x".repeat(257), 5, undefined]) {
    assert.throws(() => parseVerifyEmail({ token }), { status: 400 }, String(token));
  }
});

test("reset password: sandi baru 8..128 karakter", () => {
  assert.deepEqual(parseResetPassword({ token: "abc", passwordBaru: "12345678" }), { token: "abc", passwordBaru: "12345678" });
  assert.equal(parseResetPassword({ token: "abc", passwordBaru: "x".repeat(128) }).passwordBaru.length, 128);
  assert.throws(() => parseResetPassword({ token: "abc", passwordBaru: "1234567" }), /minimal 8/);
  assert.throws(() => parseResetPassword({ token: "abc", passwordBaru: "x".repeat(129) }), { status: 400 });
  assert.throws(() => parseResetPassword({ token: "abc" }), { status: 400 });
});

test("reset password: sandi tidak di-trim dan kunci lain dibuang", () => {
  const r = parseResetPassword({ token: "abc", passwordBaru: "  spasi  ok  ", role: "ADMIN" });
  assert.equal(r.passwordBaru, "  spasi  ok  ");
  assert.deepEqual(Object.keys(r).sort(), ["passwordBaru", "token"]);
});

test("google: idToken wajib", () => {
  assert.equal(parseGoogle({ idToken: " eyJ.abc.def " }).idToken, "eyJ.abc.def");
  assert.throws(() => parseGoogle({}), { status: 400 });
  assert.throws(() => parseGoogle({ idToken: "" }), { status: 400 });
  assert.throws(() => parseGoogle({ idToken: 5 }), { status: 400 });
});
