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
