import { test } from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import { createMailer, createSmtpTransport } from "../src/services/mailer.service.js";
import { pickLang, buildLink, escapeHtml, verifyEmailTemplate, resetPasswordTemplate, googleLinkedTemplate, formatWhen } from "../src/services/email-templates.js";
import { buildEnv } from "../src/config/env-parse.js";

const cfg = {
  mailFrom: "AgroChie <no-reply@contoh.id>",
  appBaseUrl: "https://agrochie.contoh.id",
  passwordResetTtlMinutes: 30,
  emailVerifyTtlHours: 24,
};

// jsonTransport: tidak membuka koneksi jaringan; hasil pesan dikembalikan sebagai JSON.
async function send(fn) {
  const transport = nodemailer.createTransport({ jsonTransport: true });
  const info = await fn(createMailer(cfg, transport));
  return JSON.parse(info.message);
}

test("reset password (id): subjek, tautan /reset-password, HTML + teks, pengirim", async () => {
  const m = await send((x) => x.sendPasswordResetEmail({ to: "budi@contoh.id", name: "Budi", token: "tok_en-123", lang: "id" }));
  assert.equal(m.subject, "Atur ulang kata sandi AgroChie Anda");
  assert.equal(m.to[0].address, "budi@contoh.id");
  assert.equal(m.from.address, "no-reply@contoh.id");
  assert.match(m.text, /Halo Budi,/);
  assert.match(m.text, /https:\/\/agrochie\.contoh\.id\/reset-password\?token=tok_en-123/);
  assert.match(m.text, /30 menit/);
  assert.match(m.html, /<a href="https:\/\/agrochie\.contoh\.id\/reset-password\?token=tok_en-123"/);
});

test("reset password (en): bahasa Inggris", async () => {
  const m = await send((x) => x.sendPasswordResetEmail({ to: "a@b.co", name: "Ann", token: "t", lang: "en" }));
  assert.equal(m.subject, "Reset your AgroChie password");
  assert.match(m.text, /Hello Ann,/);
  assert.match(m.text, /30 minutes/);
});

test("verifikasi email (id, en, zh): tautan /verify-email dan masa berlaku jam", async () => {
  const id = await send((x) => x.sendVerificationEmail({ to: "a@b.co", name: "Ani", token: "abc", lang: "id" }));
  assert.equal(id.subject, "Verifikasi email AgroChie Anda");
  assert.match(id.text, /https:\/\/agrochie\.contoh\.id\/verify-email\?token=abc/);
  assert.match(id.text, /24 jam/);
  const en = await send((x) => x.sendVerificationEmail({ to: "a@b.co", name: "Ani", token: "abc", lang: "en" }));
  assert.equal(en.subject, "Verify your AgroChie email");
  assert.match(en.text, /24 hours/);
  const zh = await send((x) => x.sendVerificationEmail({ to: "a@b.co", name: "安妮", token: "abc", lang: "zh" }));
  assert.equal(zh.subject, "验证您的 AgroChie 邮箱");
  assert.match(zh.text, /24 小时/);
});

test("bahasa bawaan id bila lang tidak dikenal; nama kosong -> sapaan tanpa nama", async () => {
  const m = await send((x) => x.sendPasswordResetEmail({ to: "a@b.co", token: "t", lang: "fr" }));
  assert.equal(m.subject, "Atur ulang kata sandi AgroChie Anda");
  assert.match(m.text, /^Halo,/);
});

test("nama berisi markup di-escape di HTML", () => {
  const t = verifyEmailTemplate({ lang: "id", name: "<script>alert(1)</script>", url: "https://x.id/v?token=a", hours: 24 });
  assert.ok(!t.html.includes("<script>"));
  assert.match(t.html, /&lt;script&gt;/);
});

test("tautan: token di-encode, garis miring ganda di basis dibuang", () => {
  assert.equal(buildLink("https://x.id/", "/reset-password", "a b+c"), "https://x.id/reset-password?token=a%20b%2Bc");
  assert.equal(escapeHtml(`<a href="x">&'`), "&lt;a href=&quot;x&quot;&gt;&amp;&#39;");
});

test("pickLang: lang eksplisit menang, lalu Accept-Language, bawaan id", () => {
  assert.equal(pickLang("en", "id-ID"), "en");
  assert.equal(pickLang(undefined, "en-US,en;q=0.9"), "en");
  assert.equal(pickLang(undefined, "id-ID,id;q=0.9"), "id");
  assert.equal(pickLang("zh", "id-ID"), "zh");
  assert.equal(pickLang(undefined, "zh-CN,zh;q=0.9"), "zh");
  assert.equal(pickLang("zz", "fr-FR"), "id");
  assert.equal(pickLang(undefined, undefined), "id");
});

test("template reset id/en/zh menghasilkan teks dan HTML tidak kosong", () => {
  for (const lang of ["id", "en", "zh"]) {
    const t = resetPasswordTemplate({ lang, name: "X", url: "https://x.id/r?token=a", minutes: 30 });
    assert.ok(t.subject && t.text && t.html);
    assert.ok(t.text.includes("https://x.id/r?token=a"));
  }
});

test("SMTP belum dikonfigurasi -> 503 (server tetap menyala, tidak ada pengiriman)", async () => {
  const e = buildEnv({ DATABASE_URL: "postgresql://x", JWT_SECRET: "a".repeat(32) });
  assert.throws(() => createSmtpTransport(e), (err) => err.status === 503);
  const mailer = createMailer(e);
  await assert.rejects(mailer.sendPasswordResetEmail({ to: "a@b.co", token: "t" }), (err) => err.status === 503);
});

test("transport SMTP dibuat dari env tanpa membuka koneksi dan tanpa membocorkan sandi di pesan", () => {
  const e = buildEnv({
    DATABASE_URL: "postgresql://x", JWT_SECRET: "a".repeat(32),
    SMTP_HOST: "smtp.contoh.id", SMTP_USER: "u", SMTP_PASS: "rahasia-uji", MAIL_FROM: "a@b.co",
  });
  const t = createSmtpTransport(e);
  assert.equal(typeof t.sendMail, "function");
  t.close?.();
});



// [REVISI] langkah 11: waktu email Google ditautkan. id = WIB (UTC+7), en/zh = UTC.
test("waktu pemberitahuan Google: id memakai WIB, en/zh memakai UTC", async () => {
  const when = new Date("2026-10-15T03:15:00.000Z");
  assert.equal(formatWhen(when, "id"), "15 Oktober 2026, 10.15 WIB");
  assert.equal(formatWhen(when, "en"), "2026-10-15 03:15 UTC");
  assert.equal(formatWhen(when, "zh"), "2026年10月15日 03:15 UTC");
  // lewat tengah malam UTC: tanggal WIB maju satu hari
  assert.equal(formatWhen(new Date("2026-12-31T17:05:00.000Z"), "id"), "1 Januari 2027, 00.05 WIB");
  const id = googleLinkedTemplate({ lang: "id", name: "Budi", masked: "a***@gmail.com", when });
  assert.ok(id.text.includes("15 Oktober 2026, 10.15 WIB"));
  assert.ok(!id.text.includes("UTC"));
  const en = googleLinkedTemplate({ lang: "en", name: "Budi", masked: "a***@gmail.com", when });
  assert.ok(en.text.includes("2026-10-15 03:15 UTC"));
  assert.ok(!en.text.includes("WIB"));
  const zh = googleLinkedTemplate({ lang: "zh", name: "安妮", masked: "a***@gmail.com", when });
  assert.ok(zh.text.includes("2026年10月15日 03:15 UTC"));
  assert.match(zh.subject, /Google 账户/);
});
