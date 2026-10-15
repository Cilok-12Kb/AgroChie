import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { validateGooglePayload, pickName, GOOGLE_INVALID } from "../src/services/google-auth.service.js";

// Aturan murni verifikasi klaim Google (tanpa DB, tanpa jaringan).
const CLIENT = "klien-uji.apps.googleusercontent.com";
const ok = (o = {}) => ({
  aud: CLIENT, iss: "https://accounts.google.com", email_verified: true,
  sub: "sub-1", email: "  Budi@Contoh.COM ", name: "Budi", ...o,
});
const rejects = (p) => assert.throws(() => validateGooglePayload(p, CLIENT), (e) => e.status === 401 && e.message === GOOGLE_INVALID);

describe("validateGooglePayload", () => {
  test("klaim sah: email di-trim + lowercase", () => {
    assert.deepEqual(validateGooglePayload(ok(), CLIENT), { sub: "sub-1", email: "budi@contoh.com", name: "Budi" });
  });
  test("iss tanpa skema juga sah", () => {
    assert.equal(validateGooglePayload(ok({ iss: "accounts.google.com" }), CLIENT).sub, "sub-1");
  });
  test("iss salah, aud salah, email_verified bukan true, sub/email hilang -> 401 seragam", () => {
    rejects(ok({ iss: "https://jahat.example" }));
    rejects(ok({ aud: "klien-lain" }));
    rejects(ok({ email_verified: false }));
    rejects(ok({ email_verified: "true" }));
    rejects(ok({ email: undefined }));
    rejects(ok({ email: "bukan-email" }));
    rejects(ok({ sub: "" }));
    rejects(null);
  });
  test("pickName: klaim name, fallback bagian sebelum @, dipotong 100", () => {
    assert.equal(pickName("Budi", "x@y.com"), "Budi");
    assert.equal(pickName("  ", "budi.s@y.com"), "budi.s");
    assert.equal(pickName(undefined, "budi@y.com"), "budi");
    assert.equal(pickName("a".repeat(150), "x@y.com").length, 100);
  });
});
