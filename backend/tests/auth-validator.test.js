import { test } from "node:test";
import assert from "node:assert/strict";
import { normalizePhone, parseRegister, parseLogin } from "../src/validators/auth.validator.js";

const ok = { name: "Budi", phone: "0812-3456 7890", password: "rahasia123" };

test("HP dinormalisasi: non-angka dibuang", () => {
  assert.equal(normalizePhone("+62 (812) 3456-7890"), "6281234567890");
  assert.equal(parseRegister(ok).phone, "081234567890");
  assert.equal(parseLogin({ phone: "0812-3456-7890", password: "x" }).phone, "081234567890");
});

test("HP: batas 8 sampai 15 digit", () => {
  assert.equal(parseRegister({ ...ok, phone: "12345678" }).phone, "12345678");
  assert.equal(parseRegister({ ...ok, phone: "1".repeat(15) }).phone, "1".repeat(15));
  assert.throws(() => parseRegister({ ...ok, phone: "1234567" }), { status: 400 });
  assert.throws(() => parseRegister({ ...ok, phone: "1".repeat(16) }), { status: 400 });
  assert.throws(() => parseRegister({ ...ok, phone: "abc-def" }), { status: 400 });
  assert.throws(() => parseLogin({ phone: "123", password: "x" }), { status: 400 });
});

test("sandi pendek ditolak, 8 karakter diterima", () => {
  assert.throws(() => parseRegister({ ...ok, password: "1234567" }), /minimal 8/);
  assert.equal(parseRegister({ ...ok, password: "12345678" }).password, "12345678");
});

test("isian wajib dan tipe salah ditolak", () => {
  assert.throws(() => parseRegister({}), { status: 400 });
  assert.throws(() => parseRegister(undefined), { status: 400 });
  assert.throws(() => parseRegister({ ...ok, name: "   " }), { status: 400 });
  assert.throws(() => parseRegister({ ...ok, phone: 81234567890 }), { status: 400 });
  assert.throws(() => parseLogin({ phone: "081234567890" }), { status: 400 });
});

test("role dan kunci lain dari body diabaikan", () => {
  const r = parseRegister({ ...ok, role: "PETUGAS_BANK", isGuest: true, id: "x" });
  assert.deepEqual(Object.keys(r).sort(), ["name", "password", "phone"]);
  assert.equal("role" in r, false);
});

// [REVISI] D3: login dengan HP atau email
test("login: identifier HP dan phone lama menghasilkan HP ternormalisasi", () => {
  assert.deepEqual(parseLogin({ identifier: "0812-3456-7890", password: "x" }), { phone: "081234567890", password: "x" });
  assert.deepEqual(parseLogin({ phone: "0812-3456-7890", password: "x" }), { phone: "081234567890", password: "x" });
});

test("login: identifier berisi @ -> email trim + lowercase", () => {
  assert.deepEqual(parseLogin({ identifier: "  Budi@Contoh.COM ", password: "x" }), { email: "budi@contoh.com", password: "x" });
  assert.deepEqual(parseLogin({ phone: "Budi@Contoh.com", password: "x" }), { email: "budi@contoh.com", password: "x" });
});

test("login: identifier diutamakan; kosong/format salah -> 400", () => {
  assert.equal(parseLogin({ identifier: "a@b.co", phone: "081234567890", password: "x" }).email, "a@b.co");
  assert.throws(() => parseLogin({ password: "x" }), { status: 400 });
  assert.throws(() => parseLogin({ identifier: "   ", password: "x" }), { status: 400 });
  assert.throws(() => parseLogin({ identifier: "bukan@email", password: "x" }), { status: 400 });
  assert.throws(() => parseLogin({ identifier: "123", password: "x" }), { status: 400 });
  assert.throws(() => parseLogin({ identifier: 5, password: "x" }), { status: 400 });
});

