import { test } from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import { planAccountChange, maskPhone, MSG } from "../src/services/account-security.service.js";
import { parsePhoneChange, parseReauth } from "../src/validators/auth-account.validator.js";
import { accountChangeRateLimit, _resetForTests } from "../src/middleware/rate-limit.js";
import { createMailer } from "../src/services/mailer.service.js";
import { emailRemovedTemplate, googleUnlinkedTemplate, phoneChangedTemplate } from "../src/services/email-templates.js";

const PH = "081234567890";
const PH2 = "089999999999";
const u = (o) => ({ isGuest: false, passwordHash: null, phone: null, email: null, googleId: null, ...o });
const PW = "hash";

// Fixture = tabel keputusan §2 di docs/rencana-kelompok-b.md.
// Isi per aksi: [status, reauth]. add = tambah HP, change = ganti HP.
const ROWS = [
  { n: 1, user: u({ passwordHash: PW, phone: PH }), change: [200, "password"], remove: [400], unlink: [400] },
  { n: 2, user: u({ passwordHash: PW, phone: PH, email: "a@b.id" }), change: [200, "password"], remove: [200, "password"], unlink: [400] },
  { n: 3, user: u({ passwordHash: PW, phone: PH, email: "a@b.id" }), change: [200, "password"], remove: [200, "password"], unlink: [400] },
  { n: 4, user: u({ passwordHash: PW, phone: PH, email: "a@b.id", googleId: "g" }), change: [200, "password"], remove: [200, "password"], unlink: [200, "password"] },
  { n: 5, user: u({ passwordHash: PW, phone: PH, googleId: "g" }), change: [200, "password"], remove: [400], unlink: [200, "password"] },
  { n: 6, user: u({ email: "a@b.id", googleId: "g" }), add: [200, "none"], remove: [200, "google"], unlink: [409] },
  { n: 7, user: u({ phone: PH, email: "a@b.id", googleId: "g" }), change: [200, "google"], remove: [200, "google"], unlink: [409] },
  { n: 8, user: u({ passwordHash: PW, email: "a@b.id", googleId: "g" }), add: [200, "none"], remove: [200, "password"], unlink: [200, "password"] },
  { n: 9, user: u({ passwordHash: PW, email: "a@b.id" }), add: [200, "none"], remove: [409], unlink: [400] },
  { n: 10, user: u({ passwordHash: PW, googleId: "g" }), add: [200, "none"], remove: [400], unlink: [409] },
  { n: 11, user: u({ googleId: "g" }), add: [200, "none"], remove: [400], unlink: [409] },
  { n: 12, user: u({ isGuest: true, passwordHash: PW, phone: PH, email: "a@b.id" }), add: [403], change: [403], remove: [403], unlink: [403] },
  { n: 13, user: u({ phone: PH, email: "a@b.id" }), change: [403], remove: [409], unlink: [409] },
  { n: 13, user: u({}), add: [403] },
];

function check(row, label, plan, [status, reauth]) {
  const ctx = `baris ${row.n} ${label}`;
  assert.equal(plan.status, status, ctx);
  assert.equal(plan.allowed, status === 200, ctx);
  if (status === 200) assert.equal(plan.reauth, reauth, ctx);
  else assert.equal(plan.reauth, null, ctx);
}

test("planAccountChange: seluruh baris tabel keputusan x aksi", () => {
  for (const row of ROWS) {
    if (row.add) check(row, "tambah HP", planAccountChange(row.user, { type: "phone", phone: PH2 }), row.add);
    if (row.change) check(row, "ganti HP", planAccountChange(row.user, { type: "phone", phone: PH2 }), row.change);
    if (row.remove) check(row, "hapus email", planAccountChange(row.user, { type: "removeEmail" }), row.remove);
    if (row.unlink) check(row, "lepas Google", planAccountChange(row.user, { type: "unlinkGoogle" }), row.unlink);
  }
});

test("planAccountChange: pesan persis", () => {
  const p = (user, a) => planAccountChange(user, a).message;
  assert.equal(p(ROWS[11].user, { type: "phone", phone: PH2 }), "Akun tamu tidak dapat mengubah data akun");
  assert.equal(p(ROWS[0].user, { type: "removeEmail" }), "Belum ada email di akun ini");
  assert.equal(p(ROWS[0].user, { type: "unlinkGoogle" }), "Akun ini belum tertaut ke Google");
  assert.equal(p(ROWS[5].user, { type: "unlinkGoogle" }), "Tidak bisa menghapus metode masuk terakhir.");
  assert.equal(p(ROWS[12].user, { type: "phone", phone: PH2 }), "Tidak diizinkan");
  assert.equal(MSG.lastMethod, "Tidak bisa menghapus metode masuk terakhir.");
});

test("planAccountChange: nomor sama = no-op tanpa re-auth", () => {
  const plan = planAccountChange(ROWS[0].user, { type: "phone", phone: PH });
  assert.deepEqual({ allowed: plan.allowed, reauth: plan.reauth, noop: plan.noop }, { allowed: true, reauth: "none", noop: true });
});

test("planAccountChange: aksi tidak dikenal ditolak 400", () => {
  assert.equal(planAccountChange(ROWS[0].user, { type: "x" }).status, 400);
});

test("parsePhoneChange: normalisasi, batas digit, password tidak di-trim", () => {
  assert.equal(parsePhoneChange({ phone: "0812-3456 7890" }).phone, "081234567890");
  assert.throws(() => parsePhoneChange({}), { status: 400, message: "Nomor HP wajib diisi" });
  assert.throws(() => parsePhoneChange({ phone: "1234567" }), { status: 400, message: "Nomor HP harus 8 sampai 15 digit" });
  assert.throws(() => parsePhoneChange({ phone: "1".repeat(16) }), { status: 400 });
  assert.equal(parsePhoneChange({ phone: PH, password: "  sandi  " }).password, "  sandi  ");
});

test("parseReauth: batas panjang, lang hanya id/en", () => {
  assert.deepEqual(parseReauth({}), { lang: undefined });
  assert.equal(parseReauth({ password: "x".repeat(1024) }).password.length, 1024);
  assert.throws(() => parseReauth({ password: "x".repeat(1025) }), { status: 400, message: "Kata sandi terlalu panjang" });
  assert.throws(() => parseReauth({ password: "" }), { status: 400, message: "Kata sandi wajib diisi" });
  assert.throws(() => parseReauth({ idToken: "" }), { status: 400, message: "idToken wajib diisi" });
  assert.throws(() => parseReauth({ idToken: "t".repeat(4097) }), { status: 400, message: "idToken tidak valid" });
  assert.throws(() => parseReauth({ idToken: 5 }), { status: 400, message: "idToken tidak valid" });
  assert.equal(parseReauth({ lang: "en" }).lang, "en");
  assert.equal(parseReauth({ lang: "zh" }).lang, undefined);
  assert.equal(parseReauth(null).lang, undefined);
});

test("maskPhone: *** + 3 digit terakhir", () => {
  assert.equal(maskPhone("081234567890"), "***890");
  assert.equal(maskPhone(null), "***");
});

const when = new Date("2026-10-15T03:15:00Z");
const notices = [
  ["emailRemoved", (lang) => emailRemovedTemplate({ lang, name: "Bu<di>", masked: "a***@b.id", when })],
  ["googleUnlinked", (lang) => googleUnlinkedTemplate({ lang, name: "Bu<di>", when })],
  ["phoneChanged", (lang) => phoneChangedTemplate({ lang, name: "Bu<di>", oldMasked: "***890", newMasked: "***999", when })],
];

test("template pemberitahuan: subjek, escape, tanpa tautan, waktu, tanpa 'hubungi kami'", () => {
  for (const [name, make] of notices) {
    const id = make("id");
    const en = make("en");
    assert.notEqual(id.subject, en.subject, name);
    for (const t of [id, en]) {
      assert.doesNotMatch(t.text, /https?:\/\//, name);
      assert.doesNotMatch(t.html, /<a /, name);
      assert.doesNotMatch(t.html, /Bu<di>/, name);
      assert.match(t.html, /Bu&lt;di&gt;/, name);
      assert.doesNotMatch(t.text, /hubungi kami|contact us/i, name);
      assert.doesNotMatch(t.text, /081234567890|089999999999/, name);
    }
    assert.match(id.text, /15 Oktober 2026, 10\.15 WIB/, name);
    assert.match(en.text, /2026-10-15 03:15 UTC/, name);
    assert.match(id.text, /Lupa kata sandi/, name);
  }
  assert.equal(emailRemovedTemplate({ lang: "id", when }).subject, "Email dihapus dari akun AgroChie kamu");
  assert.equal(googleUnlinkedTemplate({ lang: "en", when }).subject, "A Google account was unlinked from your AgroChie account");
  assert.equal(phoneChangedTemplate({ lang: "id", when }).subject, "Nomor HP akun AgroChie kamu diganti");
  assert.match(phoneChangedTemplate({ lang: "id", oldMasked: "***890", newMasked: "***999", when }).text, /dari \*\*\*890 ke \*\*\*999/);
  assert.match(emailRemovedTemplate({ lang: "id", masked: "a***@b.id", when }).text, /tambahkan email kembali/);
});

test("accountChangeRateLimit: ke-11 ditolak 429 dengan pesan tepat", () => {
  _resetForTests();
  const mw = accountChangeRateLimit();
  const call = (ip) => { let e; mw({ ip }, {}, (x) => (e = x)); return e; };
  for (let i = 0; i < 10; i++) assert.equal(call("7.7.7.7"), undefined);
  const err = call("7.7.7.7");
  assert.equal(err.status, 429);
  assert.equal(err.message, "Terlalu banyak percobaan perubahan akun dari alamat ini. Coba lagi nanti.");
  assert.equal(call("7.7.7.8"), undefined);
});

test("mailer: tiga metode baru lewat jsonTransport", async () => {
  const transport = nodemailer.createTransport({ jsonTransport: true });
  const m = createMailer({ mailFrom: "AgroChie <no-reply@contoh.id>", appBaseUrl: "https://x.id" }, transport);
  const parse = (i) => JSON.parse(i.message);
  const a = parse(await m.sendEmailRemovedEmail({ to: "lama@contoh.id", name: "Budi", masked: "l***@contoh.id", when, lang: "id" }));
  assert.equal(a.to[0].address, "lama@contoh.id");
  assert.equal(a.subject, "Email dihapus dari akun AgroChie kamu");
  const b = parse(await m.sendGoogleUnlinkedEmail({ to: "a@b.id", name: "Budi", when, lang: "en" }));
  assert.equal(b.subject, "A Google account was unlinked from your AgroChie account");
  const c = parse(await m.sendPhoneChangedEmail({ to: "a@b.id", name: "Budi", oldMasked: "***890", newMasked: "***999", when, lang: "id" }));
  assert.equal(c.subject, "Nomor HP akun AgroChie kamu diganti");
  assert.match(c.text, /\*\*\*890/);
});
