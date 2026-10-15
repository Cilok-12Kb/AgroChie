import "dotenv/config";
import { describe, test, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import argon2 from "argon2";
import { assertTestDatabase } from "./helpers/test-db.js";

// Langkah 8: lupa dan reset password. Mail memakai jsonTransport; token mentah diambil dari isi email.
// Hanya jalan di database ber-nama "_test".
let skip = false;
try {
  assertTestDatabase();
} catch (e) {
  skip = e.message;
}

describe("auth lupa dan reset password (butuh database uji)", { skip }, () => {
  let server, base, prisma, svc, limits, mailerMod;
  const ids = [];
  const sent = [];
  const stamp = Date.now();
  const rand = () => "0898" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
  const password = "rahasia123";
  let n = 0;
  const mail = (tag = "u") => `e8-${tag}-${stamp}-${++n}@uji.test`;

  const baseCfg = {
    mailConfigured: true,
    mailFrom: "AgroChie <no-reply@uji.test>",
    appBaseUrl: "https://app.uji.test",
    passwordResetTtlMinutes: 30,
    emailVerifyTtlHours: 24,
  };
  const json = nodemailer.createTransport({ jsonTransport: true });
  let failWhen = null; // fungsi (message) => boolean; true = pengiriman gagal
  const capture = {
    sendMail: async (m) => {
      if (failWhen?.(m)) throw Object.assign(new Error("rahasia-smtp"), { code: "ECONNECTION" });
      const info = await json.sendMail(m);
      sent.push(JSON.parse(info.message));
      return info;
    },
  };

  const post = (path, body, cookie, headers = {}) =>
    fetch(base + path, {
      method: "POST",
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...headers },
      body: JSON.stringify(body ?? {}),
    });
  const cookieOf = (res) => (res.headers.getSetCookie()[0] ?? "").split(";")[0];
  const tokenOf = (msg) => msg.text.match(/token=([A-Za-z0-9_-]+)/)[1];
  const lastToken = () => tokenOf(sent[sent.length - 1]);
  const forgot = async (email, extra = {}) => {
    const res = await post("/auth/forgot-password", { email, ...extra });
    const body = await res.json();
    await svc._lastForgotJob;
    return { status: res.status, body };
  };

  // Akun terdaftar via register, lalu email diset (terverifikasi) langsung di DB uji.
  async function newUser({ verified = true } = {}) {
    const reg = await post("/auth/register", { name: "Uji Reset", phone: rand(), password });
    const body = await reg.json();
    ids.push(body.id);
    const email = mail();
    await prisma.user.update({
      where: { id: body.id },
      data: { email, emailVerifiedAt: verified ? new Date() : null },
    });
    return { id: body.id, email, cookie: cookieOf(reg) };
  }

  const useMail = (cfg = baseCfg, transport = capture) =>
    svc._setDepsForTests({ cfg, mailer: mailerMod.createMailer(cfg, transport) });

  before(async () => {
    assertTestDatabase();
    const { app } = await import("../src/app.js");
    ({ prisma } = await import("../src/config/prisma.js"));
    svc = await import("../src/services/password-reset.service.js");
    limits = await import("../src/middleware/rate-limit.js");
    mailerMod = await import("../src/services/mailer.service.js");
    await new Promise((r) => (server = app.listen(0, r)));
    base = `http://127.0.0.1:${server.address().port}/api`;
  });

  beforeEach(() => {
    limits._resetForTests();
    sent.length = 0;
    failWhen = null;
    useMail();
  });
  afterEach(() => {
    limits._resetForTests();
    svc._setDepsForTests(null);
  });

  after(async () => {
    if (prisma) {
      if (ids.length) await prisma.user.deleteMany({ where: { id: { in: ids } } });
      await prisma.$disconnect();
    }
    server?.close();
  });
  test("alur lengkap: forgot -> email -> reset -> login password baru; lama gagal; tanpa login otomatis", async () => {
    const u = await newUser();
    const f = await forgot(u.email, { lang: "en" });
    assert.equal(f.status, 202);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].subject, "Reset your AgroChie password");
    assert.match(sent[0].text, /https:\/\/app\.uji\.test\/reset-password\?token=/);

    const r = await post("/auth/reset-password", { token: lastToken(), passwordBaru: "sandibaru456" });
    assert.equal(r.status, 200);
    assert.deepEqual(await r.json(), { ok: true });
    assert.match(r.headers.getSetCookie().join(";"), /agro_session=;/); // cookie dibersihkan

    const user = await prisma.user.findUnique({ where: { id: u.id } });
    assert.ok(await argon2.verify(user.passwordHash, "sandibaru456"));
    assert.equal((await post("/auth/login", { identifier: u.email, password: "sandibaru456" })).status, 200);
    assert.equal((await post("/auth/login", { identifier: u.email, password })).status, 401);
  });

  test("setelah reset, sesi lama ditolak 401", async () => {
    const u = await newUser();
    assert.equal((await fetch(base + "/auth/me", { headers: { cookie: u.cookie } })).status, 200);
    await forgot(u.email);
    await post("/auth/reset-password", { token: lastToken(), passwordBaru: "sandibaru456" });
    assert.equal((await fetch(base + "/auth/me", { headers: { cookie: u.cookie } })).status, 401);
  });

  test("respons forgot identik untuk terdaftar, belum terverifikasi, tak terdaftar, tamu; hanya yang pertama kirim email", async () => {
    const ok = await newUser();
    const unverified = await newUser({ verified: false });
    const guestRes = await post("/auth/guest", {});
    const guestId = (await guestRes.json()).user.id;
    ids.push(guestId);
    const guestEmail = mail("guest");
    await prisma.user.update({ where: { id: guestId }, data: { email: guestEmail, emailVerifiedAt: new Date() } });

    const results = [];
    for (const email of [ok.email, unverified.email, mail("none"), guestEmail]) results.push(await forgot(email));
    for (const r of results) {
      assert.equal(r.status, 202);
      assert.deepEqual(r.body, results[0].body);
    }
    assert.equal(results[0].body.ok, true);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to[0].address, ok.email);
    assert.equal(await prisma.passwordReset.count({ where: { userId: { in: [unverified.id, guestId] } } }), 0);
  });

  test("batas 3 token per jam per email: permintaan ke-4 tetap 202 tanpa email", async () => {
    const u = await newUser();
    for (let i = 0; i < 3; i++) assert.equal((await forgot(u.email)).status, 202);
    assert.equal(sent.length, 3);
    assert.equal((await forgot(u.email)).status, 202);
    assert.equal(sent.length, 3);
    assert.equal(await prisma.passwordReset.count({ where: { userId: u.id } }), 3);
  });

  test("503 saat mail tidak dikonfigurasi; format email salah 400", async () => {
    useMail({ ...baseCfg, mailConfigured: false });
    const r = await post("/auth/forgot-password", { email: mail() });
    assert.equal(r.status, 503);
    assert.deepEqual(await r.json(), { error: "Layanan email belum dikonfigurasi" });
    useMail();
    assert.equal((await post("/auth/forgot-password", { email: "bukan-email" })).status, 400);
    assert.equal((await post("/auth/forgot-password", {})).status, 400);
  });

  test("pembatas IP: forgot 5 per 15 menit, reset 10 per 15 menit -> 429", async () => {
    let last;
    for (let i = 0; i < 6; i++) last = await post("/auth/forgot-password", { email: mail() });
    assert.equal(last.status, 429);
    limits._resetForTests();
    for (let i = 0; i < 11; i++) last = await post("/auth/reset-password", { token: "A".repeat(43), passwordBaru: "sandibaru456" });
    assert.equal(last.status, 429);
  });

  test("token kedaluwarsa, dipakai dua kali, ngawur: 400 dengan pesan seragam", async () => {
    const u = await newUser();
    await forgot(u.email);
    const t1 = lastToken();
    assert.equal((await post("/auth/reset-password", { token: t1, passwordBaru: "sandibaru456" })).status, 200);
    const twice = await post("/auth/reset-password", { token: t1, passwordBaru: "sandibaru789" });
    assert.equal(twice.status, 400);
    const twiceBody = await twice.json();

    await forgot(u.email);
    const t2 = lastToken();
    await prisma.passwordReset.updateMany({ where: { userId: u.id, usedAt: null }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const expired = await post("/auth/reset-password", { token: t2, passwordBaru: "sandibaru789" });
    const junk = await post("/auth/reset-password", { token: "A".repeat(43), passwordBaru: "sandibaru789" });
    assert.equal(expired.status, 400);
    assert.equal(junk.status, 400);
    assert.deepEqual(await expired.json(), twiceBody);
    assert.deepEqual(await junk.json(), twiceBody);
  });

  test("password baru mengikuti aturan register (8-128); token tetap berlaku bila ditolak", async () => {
    const u = await newUser();
    await forgot(u.email);
    const t = lastToken();
    assert.equal((await post("/auth/reset-password", { token: t, passwordBaru: "pendek" })).status, 400);
    assert.equal((await post("/auth/reset-password", { token: t, passwordBaru: "x".repeat(129) })).status, 400);
    assert.equal((await post("/auth/reset-password", { token: t, passwordBaru: "sandibaru456" })).status, 200);
  });

  test("token baru membuat token lama tidak berlaku", async () => {
    const u = await newUser();
    await forgot(u.email);
    const t1 = lastToken();
    await forgot(u.email);
    const t2 = lastToken();
    assert.notEqual(t1, t2);
    assert.equal((await post("/auth/reset-password", { token: t1, passwordBaru: "sandibaru456" })).status, 400);
    assert.equal((await post("/auth/reset-password", { token: t2, passwordBaru: "sandibaru456" })).status, 200);
  });

  test("reset mencabut token reset lain milik user yang belum terpakai", async () => {
    const u = await newUser();
    await forgot(u.email);
    const t = lastToken();
    await prisma.passwordReset.create({
      data: { userId: u.id, tokenHash: "f".repeat(64), expiresAt: new Date(Date.now() + 600_000) },
    });
    await post("/auth/reset-password", { token: t, passwordBaru: "sandibaru456" });
    assert.equal(await prisma.passwordReset.count({ where: { userId: u.id, usedAt: null } }), 0);
  });

  test("akun Google-only (tanpa password) bisa menetapkan password lalu login dengan email", async () => {
    const email = mail("g");
    const g = await prisma.user.create({
      data: { name: "Google Saja", email, emailVerifiedAt: new Date(), googleId: `g-${stamp}-${++n}`, passwordHash: null },
    });
    ids.push(g.id);
    assert.equal((await post("/auth/login", { identifier: email, password })).status, 401);
    await forgot(email);
    assert.equal(sent.length, 1);
    assert.equal((await post("/auth/reset-password", { token: lastToken(), passwordBaru: "sandibaru456" })).status, 200);
    const login = await post("/auth/login", { identifier: email, password: "sandibaru456" });
    assert.equal(login.status, 200);
    const meRes = await (await fetch(base + "/auth/me", { headers: { cookie: cookieOf(login) } })).json();
    assert.equal(meRes.hasPassword, true);
    assert.equal(meRes.hasGoogle, true);
  });

  test("email pemberitahuan terkirim setelah reset (tanpa tautan); kegagalannya tidak menggagalkan reset", async () => {
    const u = await newUser();
    await forgot(u.email);
    const r = await post("/auth/reset-password", { token: lastToken(), passwordBaru: "sandibaru456", lang: "en" });
    assert.equal(r.status, 200);
    assert.equal(sent.length, 2);
    assert.equal(sent[1].subject, "Your AgroChie password was changed");
    assert.ok(!/token=|https?:\/\//.test(sent[1].text));

    const u2 = await newUser();
    await forgot(u2.email);
    const t = lastToken();
    failWhen = (m) => /diganti|changed/.test(m.subject);
    const r2 = await post("/auth/reset-password", { token: t, passwordBaru: "sandibaru456" });
    assert.equal(r2.status, 200);
    assert.equal((await post("/auth/login", { identifier: u2.email, password: "sandibaru456" })).status, 200);
  });

  test("pengiriman email reset gagal: token ditandai terpakai, respons tetap 202", async () => {
    const u = await newUser();
    failWhen = () => true;
    const f = await forgot(u.email);
    assert.equal(f.status, 202);
    assert.equal(sent.length, 0);
    const rows = await prisma.passwordReset.findMany({ where: { userId: u.id } });
    assert.equal(rows.length, 1);
    assert.ok(rows[0].usedAt);
  });

  test("galat di proses latar tidak menyebabkan unhandled rejection", async () => {
    const u = await newUser();
    const seen = [];
    const onRej = (e) => seen.push(e);
    process.on("unhandledRejection", onRej);
    try {
      // TTL NaN membuat pembuatan token gagal di dalam proses latar
      useMail({ ...baseCfg, passwordResetTtlMinutes: Number.NaN });
      const f = await forgot(u.email);
      assert.equal(f.status, 202);
      await new Promise((r) => setTimeout(r, 50));
      assert.equal(seen.length, 0);
      assert.equal(sent.length, 0);
    } finally {
      process.off("unhandledRejection", onRej);
    }
  });

  test("database tidak menyimpan token mentah (hanya hash SHA-256)", async () => {
    const u = await newUser();
    await forgot(u.email);
    const raw = lastToken();
    const rows = await prisma.passwordReset.findMany({ where: { userId: u.id } });
    assert.equal(rows.length, 1);
    assert.notEqual(rows[0].tokenHash, raw);
    assert.match(rows[0].tokenHash, /^[0-9a-f]{64}$/);
    assert.ok(!JSON.stringify(rows).includes(raw));
  });
});
