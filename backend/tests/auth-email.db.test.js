import "dotenv/config";
import { describe, test, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import { assertTestDatabase } from "./helpers/test-db.js";

// Langkah 6: tambah dan verifikasi email. Mail memakai jsonTransport (tanpa SMTP sungguhan);
// token mentah diambil dari isi email yang "terkirim". Hanya jalan di database ber-nama "_test".
let skip = false;
try {
  assertTestDatabase();
} catch (e) {
  skip = e.message;
}

describe("auth tambah dan verifikasi email (butuh database uji)", { skip }, () => {
  let server, base, prisma, svc, limits, mailerMod;
  const ids = [];
  const sent = []; // pesan terkirim (hasil parse JSON jsonTransport)
  const stamp = Date.now();
  const rand = () => "0899" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
  const password = "rahasia123";
  let n = 0;
  const mail = (tag = "u") => `e6-${tag}-${stamp}-${++n}@uji.test`;

  const baseCfg = {
    mailConfigured: true,
    mailFrom: "AgroChie <no-reply@uji.test>",
    appBaseUrl: "https://app.uji.test",
    passwordResetTtlMinutes: 30,
    emailVerifyTtlHours: 24,
  };
  const json = nodemailer.createTransport({ jsonTransport: true });
  const capture = {
    sendMail: async (m) => {
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
  const me = async (cookie) => (await fetch(base + "/auth/me", { headers: { cookie } })).json();
  const cookieOf = (res) => (res.headers.getSetCookie()[0] ?? "").split(";")[0];
  const tokenOf = (msg) => msg.text.match(/token=([A-Za-z0-9_-]+)/)[1];
  const lastToken = () => tokenOf(sent[sent.length - 1]);

  async function newUser() {
    const reg = await post("/auth/register", { name: "Uji Email", phone: rand(), password });
    const body = await reg.json();
    ids.push(body.id);
    return { id: body.id, cookie: cookieOf(reg) };
  }
  async function newGuest() {
    const res = await post("/auth/guest", {});
    const body = await res.json();
    ids.push(body.user.id);
    return { id: body.user.id, cookie: cookieOf(res) };
  }

  const useMail = (cfg = baseCfg, transport = capture) =>
    svc._setDepsForTests({ cfg, mailer: mailerMod.createMailer(cfg, transport) });

  before(async () => {
    assertTestDatabase();
    const { app } = await import("../src/app.js");
    ({ prisma } = await import("../src/config/prisma.js"));
    svc = await import("../src/services/email-verification.service.js");
    limits = await import("../src/middleware/rate-limit.js");
    mailerMod = await import("../src/services/mailer.service.js");
    await new Promise((r) => (server = app.listen(0, r)));
    base = `http://127.0.0.1:${server.address().port}/api`;
  });

  beforeEach(() => {
    limits._resetForTests();
    sent.length = 0;
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

  test("alur lengkap: tambah email -> email terkirim -> verifikasi -> /auth/me emailVerified true", async () => {
    const u = await newUser();
    const email = mail();
    const res = await post("/auth/email", { email: `  ${email.toUpperCase()} ` }, u.cookie);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.email, email); // dinormalisasi
    assert.equal(body.emailVerified, false);
    assert.equal(body.id, u.id);
    assert.deepEqual(await me(u.cookie), body); // bentuk sama dengan /auth/me
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to[0].address, email);
    assert.match(sent[0].text, /https:\/\/app\.uji\.test\/verify-email\?token=/);

    const v = await post("/auth/verify-email", { token: lastToken() });
    assert.equal(v.status, 200);
    assert.deepEqual(await v.json(), { ok: true });
    const after = await me(u.cookie);
    assert.equal(after.emailVerified, true);
    assert.equal(after.email, email);
  });

  test("token kedaluwarsa, dipakai dua kali, dan ngawur -> 400 dengan pesan sama", async () => {
    const u = await newUser();
    await post("/auth/email", { email: mail() }, u.cookie);
    const good = lastToken();

    await prisma.emailVerification.updateMany({ where: { userId: u.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const expired = await post("/auth/verify-email", { token: good });
    assert.equal(expired.status, 400);
    const msg = await expired.json();
    assert.equal((await me(u.cookie)).emailVerified, false);

    await prisma.emailVerification.updateMany({ where: { userId: u.id }, data: { expiresAt: new Date(Date.now() + 3600_000) } });
    assert.equal((await post("/auth/verify-email", { token: good })).status, 200);
    const twice = await post("/auth/verify-email", { token: good });
    assert.equal(twice.status, 400);
    assert.deepEqual(await twice.json(), msg);

    const bogus = await post("/auth/verify-email", { token: "A".repeat(43) });
    assert.equal(bogus.status, 400);
    assert.deepEqual(await bogus.json(), msg);
  });

  test("ganti email setelah meminta verifikasi: token lama tidak bisa dipakai, token baru bisa", async () => {
    const u = await newUser();
    await post("/auth/email", { email: mail("a") }, u.cookie);
    const oldToken = lastToken();
    const second = mail("b");
    assert.equal((await post("/auth/email", { email: second }, u.cookie)).status, 200);
    const newToken = lastToken();

    assert.equal((await post("/auth/verify-email", { token: oldToken })).status, 400);
    let state = await me(u.cookie);
    assert.equal(state.email, second);
    assert.equal(state.emailVerified, false);

    assert.equal((await post("/auth/verify-email", { token: newToken })).status, 200);
    state = await me(u.cookie);
    assert.equal(state.emailVerified, true);
    assert.equal(state.email, second);
  });

  test("ganti email mematikan token PasswordReset yang belum terpakai (dan tidak menyentuh user lain)", async () => {
    const u = await newUser();
    const other = await newUser();
    const mk = (userId, h) => prisma.passwordReset.create({ data: { userId, tokenHash: h, expiresAt: new Date(Date.now() + 3600_000) } });
    const mine = await mk(u.id, `uji-pr-${stamp}-mine`);
    const theirs = await mk(other.id, `uji-pr-${stamp}-other`);
    await post("/auth/email", { email: mail() }, u.cookie);
    assert.ok((await prisma.passwordReset.findUnique({ where: { id: mine.id } })).usedAt);
    assert.equal((await prisma.passwordReset.findUnique({ where: { id: theirs.id } })).usedAt, null);
  });

  test("email sama dan sudah terverifikasi -> 200 tanpa perubahan dan tanpa email baru", async () => {
    const u = await newUser();
    const email = mail();
    await post("/auth/email", { email }, u.cookie);
    await post("/auth/verify-email", { token: lastToken() });
    sent.length = 0;
    const count = await prisma.emailVerification.count({ where: { userId: u.id } });
    const res = await post("/auth/email", { email: email.toUpperCase() }, u.cookie);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).emailVerified, true);
    assert.equal(sent.length, 0);
    assert.equal(await prisma.emailVerification.count({ where: { userId: u.id } }), count);
  });

  test("409 untuk email milik akun lain (pesan umum); 400 format salah", async () => {
    const a = await newUser();
    const b = await newUser();
    const email = mail();
    await post("/auth/email", { email }, a.cookie);
    const res = await post("/auth/email", { email }, b.cookie);
    assert.equal(res.status, 409);
    assert.ok(!(await res.json()).error.includes(email));
    assert.equal((await me(b.cookie)).email, null);
    assert.equal((await post("/auth/email", { email: "bukan-email" }, b.cookie)).status, 400);
  });

  test("tamu -> 403 pada tambah dan kirim ulang; tanpa sesi -> 401", async () => {
    const g = await newGuest();
    assert.equal((await post("/auth/email", { email: mail() }, g.cookie)).status, 403);
    assert.equal((await post("/auth/email/resend-verification", {}, g.cookie)).status, 403);
    assert.equal((await post("/auth/email", { email: mail() })).status, 401);
    assert.equal(sent.length, 0);
  });


  test("mail tidak dikonfigurasi -> 503 dan email TIDAK disimpan", async () => {
    useMail({ ...baseCfg, mailConfigured: false });
    const u = await newUser();
    const res = await post("/auth/email", { email: mail() }, u.cookie);
    assert.equal(res.status, 503);
    assert.equal((await me(u.cookie)).email, null);
    assert.equal(await prisma.emailVerification.count({ where: { userId: u.id } }), 0);
    assert.equal(sent.length, 0);
  });

  test("pengiriman gagal -> 502; email baru tetap tersimpan (belum terverifikasi); token baru tidak bisa dipakai", async () => {
    const u = await newUser();
    const first = mail();
    await post("/auth/email", { email: first }, u.cookie);
    const firstToken = lastToken();
    const second = mail();
    let leaked;
    useMail(baseCfg, {
      sendMail: async (m) => {
        leaked = m.text.match(/token=([A-Za-z0-9_-]+)/)[1];
        throw new Error("smtp down");
      },
    });
    const res = await post("/auth/email", { email: second }, u.cookie);
    assert.equal(res.status, 502);
    const state = await me(u.cookie);
    assert.equal(state.email, second);
    assert.equal(state.emailVerified, false);
    const rows = await prisma.emailVerification.findMany({ where: { userId: u.id } });
    assert.equal(rows.length, 2); // kuota tetap menghitung token yang gagal terkirim
    assert.ok(rows.every((r) => r.usedAt)); // token lama dan token baru sama-sama mati
    assert.equal((await post("/auth/verify-email", { token: leaked })).status, 400);
    assert.equal((await post("/auth/verify-email", { token: firstToken })).status, 400);
    assert.equal((await me(u.cookie)).emailVerified, false);
  });

  test("pengiriman gagal pada resend -> 502, token baru mati, kuota terhitung, resend berikutnya jalan", async () => {
    const u = await newUser();
    await post("/auth/email", { email: mail() }, u.cookie); // token 1
    let leaked;
    useMail(baseCfg, {
      sendMail: async (m) => {
        leaked = m.text.match(/token=([A-Za-z0-9_-]+)/)[1];
        throw new Error("smtp down");
      },
    });
    assert.equal((await post("/auth/email/resend-verification", {}, u.cookie)).status, 502); // token 2
    assert.equal((await post("/auth/verify-email", { token: leaked })).status, 400);
    useMail();
    assert.equal((await post("/auth/email/resend-verification", {}, u.cookie)).status, 202); // token 3
    assert.equal((await post("/auth/verify-email", { token: lastToken() })).status, 200);
    assert.equal(await prisma.emailVerification.count({ where: { userId: u.id } }), 3);
  });

  test("email dikirim SETELAH transaksi commit: saat sendMail dipanggil, token sudah terlihat dari koneksi lain", async () => {
    const u = await newUser();
    let visibleDuringSend = null;
    useMail(baseCfg, {
      sendMail: async (m) => {
        const raw = m.text.match(/token=([A-Za-z0-9_-]+)/)[1];
        const { hashToken } = await import("../src/utils/token.js");
        // prisma biasa (bukan tx): hanya melihat baris bila transaksi sudah commit.
        visibleDuringSend = await prisma.emailVerification.findUnique({ where: { tokenHash: hashToken(raw) } });
        return capture.sendMail(m);
      },
    });
    const email = mail();
    assert.equal((await post("/auth/email", { email }, u.cookie)).status, 200);
    assert.ok(visibleDuringSend, "token harus sudah ter-commit sebelum email dikirim");
    assert.equal(visibleDuringSend.usedAt, null);
    assert.equal((await prisma.user.findUnique({ where: { id: u.id } })).email, email);
  });

  test("resend: 400 tanpa email; batas 3 token per jam -> 429; token lama dimatikan; 202", async () => {
    const u = await newUser();
    assert.equal((await post("/auth/email/resend-verification", {}, u.cookie)).status, 400);

    await post("/auth/email", { email: mail() }, u.cookie); // token 1
    const t1 = lastToken();
    const r2 = await post("/auth/email/resend-verification", { lang: "en" }, u.cookie); // token 2
    assert.equal(r2.status, 202);
    assert.deepEqual(await r2.json(), { ok: true });
    assert.equal(sent[sent.length - 1].subject, "Verify your AgroChie email");
    assert.equal((await post("/auth/verify-email", { token: t1 })).status, 400); // token lama mati
    assert.equal((await post("/auth/email/resend-verification", {}, u.cookie)).status, 202); // token 3
    assert.equal((await post("/auth/email/resend-verification", {}, u.cookie)).status, 429);
    assert.equal(await prisma.emailVerification.count({ where: { userId: u.id } }), 3);

    assert.equal((await post("/auth/verify-email", { token: lastToken() })).status, 200);
    assert.equal((await post("/auth/email/resend-verification", {}, u.cookie)).status, 400); // sudah terverifikasi
  });

  test("bahasa email: body lang menang atas Accept-Language; lalu header; bawaan id", async () => {
    const u = await newUser();
    await post("/auth/email", { email: mail(), lang: "en" }, u.cookie, { "accept-language": "id-ID" });
    assert.equal(sent[0].subject, "Verify your AgroChie email");
    const u2 = await newUser();
    await post("/auth/email", { email: mail() }, u2.cookie, { "accept-language": "en-US,en;q=0.9" });
    assert.equal(sent[1].subject, "Verify your AgroChie email");
    const u3 = await newUser();
    await post("/auth/email", { email: mail() }, u3.cookie, { "accept-language": "fr" });
    assert.equal(sent[2].subject, "Verifikasi email AgroChie Anda");
  });

  test("database tidak menyimpan token mentah (hanya hash SHA-256)", async () => {
    const u = await newUser();
    await post("/auth/email", { email: mail() }, u.cookie);
    const raw = lastToken();
    const rows = await prisma.emailVerification.findMany({ where: { userId: u.id } });
    assert.equal(rows.length, 1);
    assert.notEqual(rows[0].tokenHash, raw);
    assert.match(rows[0].tokenHash, /^[0-9a-f]{64}$/);
    assert.ok(!JSON.stringify(rows).includes(raw));
  });

  test("pembatas per IP terpasang pada ketiga endpoint", async () => {
    let last;
    for (let i = 0; i < 21; i++) last = await post("/auth/verify-email", { token: "A".repeat(43) });
    assert.equal(last.status, 429);
    limits._resetForTests();
    const g = await newGuest();
    for (let i = 0; i < 10; i++) assert.equal((await post("/auth/email", { email: mail() }, g.cookie)).status, 403);
    assert.equal((await post("/auth/email", { email: mail() }, g.cookie)).status, 429);
    for (let i = 0; i < 10; i++) assert.equal((await post("/auth/email/resend-verification", {}, g.cookie)).status, 403);
    assert.equal((await post("/auth/email/resend-verification", {}, g.cookie)).status, 429);
  });
});

