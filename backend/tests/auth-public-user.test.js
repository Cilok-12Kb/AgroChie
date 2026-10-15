import { test } from "node:test";
import assert from "node:assert/strict";

// auth.service.js mengimpor prisma; DATABASE_URL palsu cukup karena toPublicUser tidak menyentuh DB.
process.env.DATABASE_URL ??= "postgresql://x:x@127.0.0.1:5432/x_test";
const { toPublicUser } = await import("../src/services/auth.service.js");

const row = {
  id: "u1", name: "Budi", phone: "081234567890", email: "budi@contoh.id", emailVerifiedAt: new Date(),
  passwordHash: "$argon2id$rahasia", googleId: "google-sub-123", sessionVersion: 4,
  role: "PETANI", isGuest: false, _count: { farms: 1 },
};

test("respons publik: kunci persis, flag turunan benar", () => {
  const u = toPublicUser(row);
  assert.deepEqual(Object.keys(u).sort(), [
    "email", "emailVerified", "hasGoogle", "hasPassword", "id", "isGuest", "name", "needsProfileCompletion", "phone", "role",
  ]);
  assert.equal(u.emailVerified, true);
  assert.equal(u.hasPassword, true);
  assert.equal(u.hasGoogle, true);
  assert.equal(u.needsProfileCompletion, false);
});

test("passwordHash, googleId, sessionVersion TIDAK pernah bocor ke respons", () => {
  const json = JSON.stringify(toPublicUser(row));
  for (const bad of ["passwordHash", "googleId", "sessionVersion", "argon2", "google-sub-123", "emailVerifiedAt", "_count"]) {
    assert.ok(!json.includes(bad), bad);
  }
});

test("akun lama tanpa email: email null, emailVerified false", () => {
  const u = toPublicUser({ ...row, email: null, emailVerifiedAt: null, googleId: null });
  assert.equal(u.email, null);
  assert.equal(u.emailVerified, false);
  assert.equal(u.hasGoogle, false);
});

test("akun Google-only: hasPassword false, phone null", () => {
  const u = toPublicUser({ ...row, passwordHash: null, phone: null });
  assert.equal(u.hasPassword, false);
  assert.equal(u.phone, null);
  assert.equal(u.hasGoogle, true);
});

test("needsProfileCompletion (D8): phone kosong ATAU belum punya lahan", () => {
  assert.equal(toPublicUser({ ...row, phone: null }).needsProfileCompletion, true);
  assert.equal(toPublicUser({ ...row, _count: { farms: 0 } }).needsProfileCompletion, true);
  assert.equal(toPublicUser({ ...row, phone: null, _count: { farms: 0 } }).needsProfileCompletion, true);
  assert.equal(toPublicUser({ ...row, phone: "", _count: { farms: 2 } }).needsProfileCompletion, true);
  assert.equal(toPublicUser({ ...row, _count: { farms: 2 } }).needsProfileCompletion, false);
});

test("tamu tidak diminta melengkapi profil", () => {
  const u = toPublicUser({ ...row, isGuest: true, phone: null, email: null, emailVerifiedAt: null, googleId: null, _count: { farms: 0 } });
  assert.equal(u.needsProfileCompletion, false);
  assert.equal(u.isGuest, true);
});
