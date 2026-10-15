import "dotenv/config";
import { describe, test, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import { assertTestDatabase } from "./helpers/test-db.js";

// Langkah 10: POST /auth/google/link. Verifier Google dan mail diinjeksi (tanpa jaringan/SMTP).
// Hanya jalan di database ber-nama "_test".
let skip = false;
try {
  assertTestDatabase();
} catch (e) {
  skip = e.message;
}

describe("auth tautkan Google (butuh database uji)", { skip }, () => {
  let server, base, prisma, svc, resetSvc, limits, mailerMod, tokenUtil;
  const ids = [];
  const emails = [];
  const sent = [];
  const stamp = Date.now();
  const CLIENT = "klien-uji.apps.googleusercontent.com";
  const cfgOn = { googleConfigured: true, googleClientId: CLIENT };
  const mailCfg = {
    mailConfigured: true, mailFrom: "AgroChie <no-reply@uji.test>", appBaseUrl: "https://app.uji.test",
    passwordResetTtlMinutes: 30, emailVerifyTtlHours: 24,
  };
  let n = 0;
  const mail = (tag = "g") => {
    const e = `g10-${tag}-${stamp}-${++n}@uji.test`;
    emails.push(e);
    return e;
  };
  const rand = () => "0897" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
  const password = "rahasia123";

  const json = nodemailer.createTransport({ jsonTransport: true });
  const capture = {
    sendMail: async (m) => {
      const info = await json.sendMail(m);
      sent.push(JSON.parse(info.message));
      return info;
    },
  };
  const failing = { sendMail: async () => { throw Object.assign(new Error("smtp-rahasia"), { code: "ECONNECTION" }); } };

  const tokens = new Map();
  let verifierCalls = 0;
  const verifier = async (idToken, audience) => {
    verifierCalls++;
    assert.equal(audience, CLIENT);
    if (!tokens.has(idToken)) throw new Error("token tidak dikenal (rahasia)");
    return tokens.get(idToken);
  };
  const claims = (o = {}) => ({
    aud: CLIENT, iss: "https://accounts.google.com", email_verified: true,
    sub: `sub10-${stamp}-${++n}`, email: mail("gmail"), name: "Pengguna Google", ...o,
  });
  const tok = (payload) => {
    const t = `tok10-${++n}`;
    tokens.set(t, payload);
    return t;
  };
  const useDeps = (transport = capture, cfg = cfgOn) =>
    svc._setDepsForTests({ cfg, verifier, mailer: mailerMod.createMailer(mailCfg, transport) });

  const post = (path, body, cookie, headers = {}) =>
    fetch(base + path, {
      method: "POST",
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}), ...headers },
      body: JSON.stringify(body ?? {}),
    });
  const get = (path, cookie) => fetch(base + path, { headers: cookie ? { cookie } : {} });
  const cookieOf = (res) => (res.headers.getSetCookie()[0] ?? "").split(";")[0];
  const link = (payload, pw, cookie, extra = {}) =>
    post("/auth/google/link", { idToken: tok(payload), password: pw, ...extra }, cookie);

  // Akun HP (register). Email diset langsung di DB uji bila diminta.
  async function user({ email = null, verified = true, googleId = null } = {}) {
    const reg = await post("/auth/register", { name: "Uji Tautan", phone: rand(), password });
    const body = await reg.json();
    ids.push(body.id);
    if (email || googleId) {
      if (email) emails.push(email);
      await prisma.user.update({
        where: { id: body.id },
        data: { email, emailVerifiedAt: email && verified ? new Date() : null, googleId },
      });
    }
    return { id: body.id, phone: body.phone, cookie: cookieOf(reg) };
  }
  const row = (id) => prisma.user.findUnique({ where: { id } });

  before(async () => {
    assertTestDatabase();
    const { app } = await import("../src/app.js");
    ({ prisma } = await import("../src/config/prisma.js"));
    svc = await import("../src/services/google-auth.service.js");
    resetSvc = await import("../src/services/password-reset.service.js");
    limits = await import("../src/middleware/rate-limit.js");
    mailerMod = await import("../src/services/mailer.service.js");
    tokenUtil = await import("../src/utils/token.js");
    await new Promise((r) => (server = app.listen(0, r)));
    base = `http://127.0.0.1:${server.address().port}/api`;
  });
  beforeEach(() => {
    limits._resetForTests();
    verifierCalls = 0;
    sent.length = 0;
    useDeps();
  });
  afterEach(() => {
    limits._resetForTests();
    svc._setDepsForTests(null);
    resetSvc._setDepsForTests(null);
  });
  after(async () => {
    if (prisma) {
      if (ids.length) await prisma.user.deleteMany({ where: { id: { in: ids } } });
      if (emails.length) await prisma.user.deleteMany({ where: { email: { in: emails } } });
      await prisma.$disconnect();
    }
    server?.close();
  });

  test("akun HP tanpa email: tertaut, email = email Google & terverifikasi, token verifikasi dicabut, tanpa email pemberitahuan", async () => {
    const u = await user();
    await prisma.emailVerification.create({
      data: { userId: u.id, email: "x@uji.test", tokenHash: tokenUtil.hashToken(`v-${stamp}-1`), expiresAt: new Date(Date.now() + 3600_000) },
    });
    const c = claims();
    const res = await link(c, password, u.cookie);
    assert.equal(res.status, 200);
    const b = await res.json();
    assert.equal(b.id, u.id);
    assert.equal(b.hasGoogle, true);
    assert.equal(b.hasPassword, true);
    assert.equal(b.email, c.email);
    assert.equal(b.emailVerified, true);
    assert.equal(b.phone, u.phone);
    assert.deepEqual(Object.keys(b).sort(), [
      "email", "emailVerified", "hasGoogle", "hasPassword", "id", "isGuest", "name", "needsProfileCompletion", "phone", "role",
    ]);
    const r = await row(u.id);
    assert.equal(r.googleId, c.sub);
    assert.ok(r.emailVerifiedAt);
    assert.equal(await prisma.emailVerification.count({ where: { userId: u.id, usedAt: null } }), 0);
    assert.equal(sent.length, 0); // tidak ada email terverifikasi sebelum penautan
  });

  test("akun dengan email berbeda tetap memakai emailnya; pemberitahuan ke email akun berisi Gmail tersamar", async () => {
    const own = mail("akun");
    const u = await user({ email: own });
    const c = claims({ email: `abc${stamp}@gmail.test` });
    emails.push(c.email);
    const res = await link(c, password, u.cookie, { lang: "en" });
    assert.equal(res.status, 200);
    const b = await res.json();
    assert.equal(b.email, own);
    assert.equal(b.hasGoogle, true);
    assert.equal((await row(u.id)).googleId, c.sub);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to[0].address, own);
    assert.match(sent[0].subject, /Google account was linked/);
    assert.ok(sent[0].text.includes("a***@gmail.test"));
    assert.ok(!sent[0].text.includes(c.email)); // alamat lengkap tidak muncul
    assert.match(sent[0].text, /UTC/);
    assert.match(sent[0].text, /reset your password/);
  });

  test("email pemberitahuan berbahasa Indonesia secara bawaan", async () => {
    const u = await user({ email: mail("akun") });
    await link(claims(), password, u.cookie);
    assert.equal(sent[0].subject, "Akun Google telah ditautkan ke akun AgroChie kamu");
    assert.match(sent[0].text, /atur ulang kata sandi/);
  });

  test("email Google milik akun LAIN: Google tetap tertaut, email akun tidak berubah", async () => {
    const other = await user({ email: mail("lain") });
    const u = await user();
    const c = claims({ email: (await row(other.id)).email });
    const res = await link(c, password, u.cookie);
    assert.equal(res.status, 200);
    const r = await row(u.id);
    assert.equal(r.googleId, c.sub);
    assert.equal(r.email, null);
    assert.equal((await row(other.id)).googleId, null);
  });

  test("email sama tapi belum terverifikasi -> menjadi terverifikasi; tidak ada pemberitahuan (belum terverifikasi sebelumnya)", async () => {
    const own = mail("belum");
    const u = await user({ email: own, verified: false });
    const res = await link(claims({ email: own }), password, u.cookie);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).emailVerified, true);
    assert.ok((await row(u.id)).emailVerifiedAt);
    assert.equal(sent.length, 0);
  });

  test("email sama & sudah terverifikasi: tidak ada perubahan email; pemberitahuan tetap terkirim", async () => {
    const own = mail("sama");
    const u = await user({ email: own });
    const sebelum = (await row(u.id)).emailVerifiedAt;
    const res = await link(claims({ email: own }), password, u.cookie);
    assert.equal(res.status, 200);
    assert.deepEqual((await row(u.id)).emailVerifiedAt, sebelum);
    assert.equal(sent.length, 1);
  });

  test("tidak menaikkan sessionVersion; sesi lama tetap berlaku", async () => {
    const u = await user({ email: mail("sv") });
    const sebelum = (await row(u.id)).sessionVersion;
    assert.equal((await link(claims(), password, u.cookie)).status, 200);
    assert.equal((await row(u.id)).sessionVersion, sebelum);
    assert.equal((await get("/auth/me", u.cookie)).status, 200);
  });

  test("googleId sudah tertaut ke akun INI -> 200 tanpa perubahan dan tanpa pemberitahuan", async () => {
    const u = await user({ email: mail("ini") });
    const c = claims();
    assert.equal((await link(c, password, u.cookie)).status, 200);
    sent.length = 0;
    const sebelum = await row(u.id);
    const res = await link(c, password, u.cookie);
    assert.equal(res.status, 200);
    assert.deepEqual(await row(u.id), sebelum);
    assert.equal(sent.length, 0);
  });

  test("409: akun ini sudah punya googleId LAIN; googleId lama tidak berubah", async () => {
    const lama = `lama10-${stamp}-${++n}`;
    const u = await user({ googleId: lama });
    const res = await link(claims(), password, u.cookie);
    assert.equal(res.status, 409);
    assert.deepEqual(await res.json(), { error: "Akun ini sudah tertaut ke akun Google lain." });
    assert.equal((await row(u.id)).googleId, lama);
  });

  test("409: googleId sudah dipakai akun lain; akun ini tidak berubah", async () => {
    const c = claims();
    await user({ googleId: c.sub });
    const u = await user();
    const res = await link(c, password, u.cookie);
    assert.equal(res.status, 409);
    assert.deepEqual(await res.json(), { error: "Akun Google ini sudah dipakai akun lain." });
    const r = await row(u.id);
    assert.equal(r.googleId, null);
    assert.equal(r.email, null);
  });

  test("balapan P2002 pada tautan: tidak 500", async () => {
    const u = await user();
    const c = claims();
    let raced = false;
    const db = {
      user: { findUnique: (a) => prisma.user.findUnique(a) },
      $transaction: (fn) => {
        if (!raced) {
          raced = true;
          return Promise.reject(Object.assign(new Error("duplikat"), { code: "P2002" }));
        }
        return prisma.$transaction(fn);
      },
    };
    svc._setDepsForTests({ cfg: cfgOn, verifier, db, mailer: mailerMod.createMailer(mailCfg, capture) });
    const res = await link(c, password, u.cookie);
    assert.equal(res.status, 200);
    assert.equal((await row(u.id)).googleId, c.sub);
  });

  // ---- Re-autentikasi ----
  test("password salah -> 401 'Kata sandi salah', akun tidak berubah, token Google TIDAK diverifikasi", async () => {
    const u = await user({ email: mail("salah") });
    const sebelum = await row(u.id);
    const res = await link(claims(), "salah-total", u.cookie);
    assert.equal(res.status, 401);
    assert.deepEqual(await res.json(), { error: "Kata sandi salah" });
    assert.equal(verifierCalls, 0);
    assert.deepEqual(await row(u.id), sebelum);
    assert.equal(sent.length, 0);
  });

  test("sesi saja tanpa password benar tidak bisa menautkan; password hilang -> 400 dan verifier tidak dipanggil", async () => {
    const u = await user();
    const res = await post("/auth/google/link", { idToken: tok(claims()) }, u.cookie);
    assert.equal(res.status, 400);
    assert.equal(verifierCalls, 0);
    assert.equal((await row(u.id)).googleId, null);
  });

  test("6 percobaan password gagal -> 429; percobaan benar setelah diblokir pun ditolak 429", async () => {
    const u = await user();
    for (let i = 0; i < 5; i++) assert.equal((await link(claims(), "salah-total", u.cookie)).status, 401);
    assert.equal((await link(claims(), "salah-total", u.cookie)).status, 429);
    assert.equal((await link(claims(), password, u.cookie)).status, 429);
    assert.equal(verifierCalls, 0);
    assert.equal((await row(u.id)).googleId, null);
  });

  test("pembatas password per user: user lain tidak ikut terblokir", async () => {
    const a = await user();
    const b = await user();
    for (let i = 0; i < 6; i++) await link(claims(), "salah-total", a.cookie);
    assert.equal((await link(claims(), password, b.cookie)).status, 200);
  });

  test("token Google tidak valid (password benar) -> 401 pesan sama dengan login Google; akun tidak berubah", async () => {
    const u = await user();
    const bad = await post("/auth/google/link", { idToken: "tidak-dikenal", password }, u.cookie);
    assert.equal(bad.status, 401);
    assert.deepEqual(await bad.json(), { error: "Token Google tidak valid" });
    const unver = await link(claims({ email_verified: false }), password, u.cookie);
    assert.equal(unver.status, 401);
    assert.equal((await row(u.id)).googleId, null);
  });

  test("kegagalan kirim pemberitahuan tidak menggagalkan penautan", async () => {
    useDeps(failing);
    const u = await user({ email: mail("gagal") });
    const c = claims();
    const res = await link(c, password, u.cookie);
    assert.equal(res.status, 200);
    assert.equal((await row(u.id)).googleId, c.sub);
  });

  test("setelah tertaut: POST /auth/google dengan token yang sama login ke akun ini (aturan a); password lama tetap bisa login", async () => {
    const u = await user({ email: mail("alur") });
    const c = claims();
    assert.equal((await link(c, password, u.cookie)).status, 200);
    const g = await post("/auth/google", { idToken: tok(c) });
    assert.equal(g.status, 200);
    assert.equal((await g.json()).id, u.id);
    assert.equal((await post("/auth/login", { identifier: u.phone, password })).status, 200);
  });

  test("setelah reset password, sesi dari POST /auth/google ditolak 401", async () => {
    resetSvc._setDepsForTests({ cfg: mailCfg, mailer: mailerMod.createMailer(mailCfg, capture) });
    const u = await user({ email: mail("reset") });
    const c = claims();
    await link(c, password, u.cookie);
    const g = await post("/auth/google", { idToken: tok(c) });
    const googleCookie = cookieOf(g);
    assert.equal((await get("/auth/me", googleCookie)).status, 200);
    const raw = `reset10-${stamp}-${++n}`;
    await prisma.passwordReset.create({
      data: { userId: u.id, tokenHash: tokenUtil.hashToken(raw), expiresAt: new Date(Date.now() + 600_000) },
    });
    const rs = await post("/auth/reset-password", { token: raw, passwordBaru: "sandibaru123" });
    assert.equal(rs.status, 200);
    assert.equal((await get("/auth/me", googleCookie)).status, 401);
    assert.equal((await get("/auth/me", u.cookie)).status, 401);
  });

  test("401 tanpa sesi; verifier tidak dipanggil", async () => {
    const res = await post("/auth/google/link", { idToken: tok(claims()), password });
    assert.equal(res.status, 401);
    assert.equal(verifierCalls, 0);
  });

  test("403 untuk akun tamu; akun tamu tidak berubah", async () => {
    const g = await post("/auth/guest", {});
    const body = await g.json();
    ids.push(body.user.id);
    const res = await link(claims(), password, cookieOf(g));
    assert.equal(res.status, 403);
    assert.equal(verifierCalls, 0);
    assert.equal((await row(body.user.id)).googleId, null);
  });

  test("503 saat Google tidak dikonfigurasi (verifier tidak dipanggil)", async () => {
    svc._setDepsForTests({ cfg: { googleConfigured: false, googleClientId: "" }, verifier });
    const u = await user();
    const res = await link(claims(), password, u.cookie);
    assert.equal(res.status, 503);
    assert.equal(verifierCalls, 0);
  });

  test("400: body kosong, idToken kosong, password bukan string", async () => {
    const u = await user();
    for (const body of [{}, { idToken: "", password }, { idToken: "x", password: 123 }, { idToken: "x", password: "" }]) {
      assert.equal((await post("/auth/google/link", body, u.cookie)).status, 400);
    }
    assert.equal(verifierCalls, 0);
  });

  test("429: pembatas per IP (10 per 15 menit)", async () => {
    let last;
    for (let i = 0; i < 11; i++) last = await post("/auth/google/link", { idToken: "x", password: "y" });
    assert.equal(last.status, 429);
  });

  test("database tidak menyimpan password mentah atau ID token", async () => {
    const u = await user({ email: mail("simpan") });
    const idToken = tok(claims());
    await post("/auth/google/link", { idToken, password }, u.cookie);
    const dump = JSON.stringify(await row(u.id)) +
      JSON.stringify(await prisma.emailVerification.findMany({ where: { userId: u.id } })) +
      JSON.stringify(await prisma.passwordReset.findMany({ where: { userId: u.id } }));
    assert.ok(!dump.includes(password));
    assert.ok(!dump.includes(idToken));
    assert.match((await row(u.id)).passwordHash, /^\$argon2/);
  });
});
