import { test } from "node:test";
import assert from "node:assert/strict";
import { buildEnv } from "../src/config/env-parse.js";

const base = { DATABASE_URL: "postgresql://x", JWT_SECRET: "a".repeat(32) };

test("JWT_SECRET kosong ditolak", () => {
  assert.throws(() => buildEnv({ DATABASE_URL: "postgresql://x" }), /JWT_SECRET belum diisi/);
});

test("JWT_SECRET kurang dari 32 karakter ditolak", () => {
  assert.throws(() => buildEnv({ ...base, JWT_SECRET: "pendek" }), /minimal 32 karakter/);
});

test("nilai bawaan sesi", () => {
  const e = buildEnv(base);
  assert.equal(e.jwtTtlDays, 7);
  assert.equal(e.guestTtlHours, 24);
  assert.equal(e.cookieName, "agro_session");
  assert.equal(e.frontendOrigin, "http://localhost:3001");
  assert.equal(e.trustProxy, false);
  assert.equal(e.nodeEnv, "development");
});

test("masa berlaku bisa diganti lewat env", () => {
  const e = buildEnv({ ...base, JWT_TTL_DAYS: "3", GUEST_TTL_HOURS: "12", TRUST_PROXY: "true" });
  assert.equal(e.jwtTtlDays, 3);
  assert.equal(e.guestTtlHours, 12);
  assert.equal(e.trustProxy, true);
});

test("masa berlaku bukan angka positif ditolak", () => {
  assert.throws(() => buildEnv({ ...base, JWT_TTL_DAYS: "abc" }), /JWT_TTL_DAYS/);
  assert.throws(() => buildEnv({ ...base, GUEST_TTL_HOURS: "0" }), /GUEST_TTL_HOURS/);
});

test("DATABASE_URL tetap wajib", () => {
  assert.throws(() => buildEnv({ JWT_SECRET: "a".repeat(32) }), /DATABASE_URL belum diisi/);
});

// [REVISI] env auth email + Google (langkah 2)
test("env email/Google: bawaan, server tetap menyala tanpa SMTP/Google", () => {
  const e = buildEnv(base);
  assert.equal(e.smtpHost, "");
  assert.equal(e.smtpPort, 587);
  assert.equal(e.smtpSecure, false);
  assert.equal(e.passwordResetTtlMinutes, 30);
  assert.equal(e.emailVerifyTtlHours, 24);
  assert.equal(e.appBaseUrl, "http://localhost:3001");
  assert.equal(e.mailConfigured, false);
  assert.equal(e.googleConfigured, false);
});

test("env email/Google: nilai diisi dibaca, APP_BASE_URL tanpa garis miring akhir", () => {
  const e = buildEnv({
    ...base, SMTP_HOST: "smtp.contoh.id", SMTP_PORT: "465", SMTP_SECURE: "true", SMTP_USER: "u", SMTP_PASS: "p",
    MAIL_FROM: "AgroChie <no-reply@contoh.id>", APP_BASE_URL: "https://agrochie.id/", GOOGLE_CLIENT_ID: "abc.apps.googleusercontent.com",
    PASSWORD_RESET_TTL_MINUTES: "15", EMAIL_VERIFY_TTL_HOURS: "48",
  });
  assert.equal(e.smtpPort, 465);
  assert.equal(e.smtpSecure, true);
  assert.equal(e.appBaseUrl, "https://agrochie.id");
  assert.equal(e.passwordResetTtlMinutes, 15);
  assert.equal(e.emailVerifyTtlHours, 48);
  assert.equal(e.mailConfigured, true);
  assert.equal(e.googleConfigured, true);
});

test("env email/Google: APP_BASE_URL kosong mengikuti FRONTEND_ORIGIN", () => {
  assert.equal(buildEnv({ ...base, FRONTEND_ORIGIN: "http://localhost:4000" }).appBaseUrl, "http://localhost:4000");
});

test("env email/Google: nilai tidak valid ditolak", () => {
  assert.throws(() => buildEnv({ ...base, SMTP_PORT: "abc" }), /SMTP_PORT/);
  assert.throws(() => buildEnv({ ...base, SMTP_PORT: "70000" }), /SMTP_PORT/);
  assert.throws(() => buildEnv({ ...base, SMTP_SECURE: "ya" }), /SMTP_SECURE/);
  assert.throws(() => buildEnv({ ...base, APP_BASE_URL: "ftp://x" }), /APP_BASE_URL/);
  assert.throws(() => buildEnv({ ...base, PASSWORD_RESET_TTL_MINUTES: "0" }), /PASSWORD_RESET_TTL_MINUTES/);
  assert.throws(() => buildEnv({ ...base, EMAIL_VERIFY_TTL_HOURS: "x" }), /EMAIL_VERIFY_TTL_HOURS/);
});

test("env email/Google: SMTP butuh host dan MAIL_FROM untuk dianggap siap", () => {
  assert.equal(buildEnv({ ...base, SMTP_HOST: "h" }).mailConfigured, false);
  assert.equal(buildEnv({ ...base, MAIL_FROM: "a@b.c" }).mailConfigured, false);
});

