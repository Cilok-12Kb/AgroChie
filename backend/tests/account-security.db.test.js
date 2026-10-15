import "dotenv/config";
import { describe, test, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import nodemailer from "nodemailer";
import { assertTestDatabase } from "./helpers/test-db.js";

// B7-2: POST /auth/phone, /auth/email/remove, /auth/google/unlink. Verifier Google dan mail diinjeksi.
// Hanya jalan di database ber-nama "_test".
let skip = false;
try {
  assertTestDatabase();
} catch (e) {
  skip = e.message;
}

describe("auth ubah metode login B7 (butuh database uji)", { skip }, () => {
  let server, base, prisma, gsvc, asvc, limits, mailerMod;
  const ids = [];
  const emails = [];
  const sent = [];
  const stamp = Date.now();
  const CLIENT = "klien-b7.apps.googleusercontent.com";
  const gcfg = { googleConfigured: true, googleClientId: CLIENT };
  const mailCfg = {
    mailConfigured: true, mailFrom: "AgroChie <no-reply@uji.test>", appBaseUrl: "https://app.uji.test",
    passwordResetTtlMinutes: 30, emailVerifyTtlHours: 24,
  };
  let n = 0;
  const mail = (tag = "b") => {
    const e = `b7-${tag}-${stamp}-${++n}@uji.test`;
    emails.push(e);
    return e;
  };
  const rand = () => "0896" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
  const password = "rahasia123";

  const json = nodemailer.createTransport({ jsonTransport: true });
  const capture = {
    sendMail: async (m) => {
      const info = await json.sendMail(m);
      sent.push(JSON.parse(info.message));
      return info;
    },
  };

  const tokens = new Map();
  const verifier = async (idToken) => {
    if (!tokens.has(idToken)) throw new Error("token tidak dikenal (rahasia)");
    return tokens.get(idToken);
  };
  const claims = (sub, email) => ({
    aud: CLIENT, iss: "https://accounts.google.com", email_verified: true, sub, email, name: "Uji B7",
  });
  const tok = (payload) => {
    const t = `tokb7-${++n}`;
    tokens.set(t, payload);
    return t;
  };

  const post = (path, body, cookie) =>
    fetch(base + path, {
      method: "POST",
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body ?? {}),
    });
  const get = (path, cookie) => fetch(base + path, { headers: cookie ? { cookie } : {} });
  const cookiesOf = (res) => res.headers.getSetCookie().filter((c) => c.startsWith("agro_session="));
  const cookieOf = (res) => (cookiesOf(res).at(-1) ?? "").split(";")[0];
  const row = (id) => prisma.user.findUnique({ where: { id } });

  // Akun HP + password (register). Email dan googleId diset langsung di DB uji bila diminta.
  async function user({ email = null, verified = true, googleId = null } = {}) {
    const p = rand();
    const reg = await post("/auth/register", { name: "Uji B7", phone: p, password });
    const body = await reg.json();
    ids.push(body.id);
    if (email || googleId) {
      if (email) emails.push(email);
      await prisma.user.update({
        where: { id: body.id },
        data: { email, emailVerifiedAt: email && verified ? new Date() : null, googleId },
      });
    }
    return { id: body.id, phone: p, cookie: cookieOf(reg) };
  }
  // Akun Google baru (tanpa password, tanpa HP) lewat POST /auth/google.
  async function googleOnly() {
    const email = mail("go");
    const c = claims(`subb7-${stamp}-${++n}`, email);
    const res = await post("/auth/google", { idToken: tok(c) });
    const body = await res.json();
    ids.push(body.id);
    return { id: body.id, email, sub: c.sub, cookie: cookieOf(res) };
  }

  before(async () => {
    assertTestDatabase();
    const { app } = await import("../src/app.js");
    ({ prisma } = await import("../src/config/prisma.js"));
    gsvc = await import("../src/services/google-auth.service.js");
    asvc = await import("../src/services/account-security.service.js");
    limits = await import("../src/middleware/rate-limit.js");
    mailerMod = await import("../src/services/mailer.service.js");
    await new Promise((r) => (server = app.listen(0, r)));
    base = `http://127.0.0.1:${server.address().port}/api`;
  });
  beforeEach(() => {
    limits._resetForTests();
    sent.length = 0;
    gsvc._setDepsForTests({ cfg: gcfg, verifier });
    asvc._setDepsForTests({ cfg: mailCfg, mailer: mailerMod.createMailer(mailCfg, capture) });
  });
  afterEach(() => {
    limits._resetForTests();
    gsvc._setDepsForTests(null);
    asvc._setDepsForTests(null);
  });
  after(async () => {
    if (prisma) {
      if (ids.length) await prisma.user.deleteMany({ where: { id: { in: ids } } });
      if (emails.length) await prisma.user.deleteMany({ where: { email: { in: emails } } });
      await prisma.$disconnect();
    }
    server?.close();
  });

  // ---------------------------------------------------------------- /auth/phone
  test("phone: tambah HP ke akun tanpa HP tanpa re-auth, tanpa bump, tanpa email", async () => {
    const u = await googleOnly();
    const before = (await row(u.id)).sessionVersion;
    const p = rand();
    const res = await post("/auth/phone", { phone: p }, u.cookie);
    assert.equal(res.status, 200);
    const b = await res.json();
    assert.equal(b.phone, p);
    assert.equal(b.id, u.id);
    assert.equal((await row(u.id)).sessionVersion, before);
    assert.equal(sent.length, 0);
  });

  test("phone: ganti HP butuh password; salah 401 dan tidak berubah", async () => {
    const u = await user();
    const bad = await post("/auth/phone", { phone: rand(), password: "salah-salah" }, u.cookie);
    assert.equal(bad.status, 401);
    assert.equal((await row(u.id)).phone, u.phone);
    assert.equal((await post("/auth/phone", { phone: rand() }, u.cookie)).status, 400);
  });

  test("phone: ganti HP sukses, bump, satu cookie baru, perangkat lain keluar, email pemberitahuan tersamar", async () => {
    const e = mail("ph");
    const u = await user({ email: e });
    const other = await post("/auth/login", { identifier: u.phone, password });
    const otherCookie = cookieOf(other);
    const p = rand();
    const res = await post("/auth/phone", { phone: p, password, lang: "en" }, u.cookie);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).phone, p);
    assert.equal(cookiesOf(res).length, 1);
    assert.equal((await get("/auth/me", cookieOf(res))).status, 200);
    assert.equal((await get("/auth/me", otherCookie)).status, 401);
    assert.equal((await get("/auth/me", u.cookie)).status, 401);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to[0].address, e);
    const txt = sent[0].text;
    assert.ok(txt.includes(`***${u.phone.slice(-3)}`) && txt.includes(`***${p.slice(-3)}`));
    assert.ok(!txt.includes(u.phone) && !txt.includes(p));
  });

  test("phone: nomor sama = 200 tanpa re-auth, tanpa bump, tanpa email", async () => {
    const u = await user({ email: mail("same") });
    const before = (await row(u.id)).sessionVersion;
    const res = await post("/auth/phone", { phone: u.phone }, u.cookie);
    assert.equal(res.status, 200);
    assert.equal((await row(u.id)).sessionVersion, before);
    assert.equal(sent.length, 0);
  });

  test("phone: nomor dipakai akun lain 409 seragam; 5 konflik lalu 429", async () => {
    const a = await user();
    const b = await user();
    for (let i = 0; i < 5; i++) {
      const res = await post("/auth/phone", { phone: a.phone, password }, b.cookie);
      assert.equal(res.status, 409);
      assert.equal((await res.json()).error, "Nomor HP tidak dapat digunakan.");
    }
    assert.equal((await post("/auth/phone", { phone: a.phone, password }, b.cookie)).status, 429);
    assert.equal((await row(b.id)).phone, b.phone);
  });

  test("phone: akun Google tanpa password mengganti HP dengan idToken; sub lain 401", async () => {
    const u = await googleOnly();
    await prisma.user.update({ where: { id: u.id }, data: { phone: rand() } });
    const bad = await post("/auth/phone", { phone: rand(), idToken: tok(claims("sub-orang-lain", u.email)) }, u.cookie);
    assert.equal(bad.status, 401);
    assert.equal((await bad.json()).error, "Token Google tidak valid");
    const p = rand();
    const ok = await post("/auth/phone", { phone: p, idToken: tok(claims(u.sub, u.email)) }, u.cookie);
    assert.equal(ok.status, 200);
    assert.equal((await ok.json()).phone, p);
  });

  // ---------------------------------------------------------------- /auth/email/remove
  test("email/remove: sukses, email kosong, token dicabut, bump, satu cookie baru, email pemberitahuan ke email lama", async () => {
    const e = mail("rm");
    const u = await user({ email: e });
    await prisma.passwordReset.create({
      data: { userId: u.id, tokenHash: `h-${stamp}-${++n}`, expiresAt: new Date(Date.now() + 600_000) },
    });
    const before = (await row(u.id)).sessionVersion;
    const res = await post("/auth/email/remove", { password }, u.cookie);
    assert.equal(res.status, 200);
    const b = await res.json();
    assert.equal(b.email, null);
    assert.equal(b.emailVerified, false);
    assert.equal(cookiesOf(res).length, 1);
    const r = await row(u.id);
    assert.equal(r.email, null);
    assert.equal(r.emailVerifiedAt, null);
    assert.equal(r.sessionVersion, before + 1);
    assert.equal(await prisma.passwordReset.count({ where: { userId: u.id, usedAt: null } }), 0);
    assert.equal((await get("/auth/me", u.cookie)).status, 401);
    assert.equal((await get("/auth/me", cookieOf(res))).status, 200);
    assert.equal(sent.length, 1);
    assert.equal(sent[0].to[0].address, e);
    assert.ok(!sent[0].text.includes(e)); // alamat tersamar di isi email
  });

  test("email/remove: email belum terverifikasi dihapus tanpa email pemberitahuan", async () => {
    const u = await user({ email: mail("unv"), verified: false });
    assert.equal((await post("/auth/email/remove", { password }, u.cookie)).status, 200);
    assert.equal(sent.length, 0);
  });

  test("email/remove: 400 tanpa email, 409 metode terakhir, 401 password salah, 400 password kosong", async () => {
    const a = await user();
    assert.equal((await post("/auth/email/remove", { password }, a.cookie)).status, 400);
    const last = await user({ email: mail("last") });
    await prisma.user.update({ where: { id: last.id }, data: { phone: null } });
    const l = await post("/auth/email/remove", { password }, last.cookie);
    assert.equal(l.status, 409);
    assert.equal((await l.json()).error, "Tidak bisa menghapus metode masuk terakhir.");
    const b = await user({ email: mail("pw") });
    assert.equal((await post("/auth/email/remove", { password: "salah-salah" }, b.cookie)).status, 401);
    assert.equal((await post("/auth/email/remove", {}, b.cookie)).status, 400);
    assert.ok((await row(b.id)).email);
  });

  test("email/remove: akun Google tanpa password memakai idToken", async () => {
    const g = await googleOnly();
    const bad = await post("/auth/email/remove", { idToken: tok(claims("sub-lain", g.email)) }, g.cookie);
    assert.equal(bad.status, 401);
    const ok = await post("/auth/email/remove", { idToken: tok(claims(g.sub, g.email)) }, g.cookie);
    assert.equal(ok.status, 200);
    assert.equal((await row(g.id)).email, null);
  });

  // ---------------------------------------------------------------- /auth/google/unlink
  test("unlink: sukses pada akun password+Google, bump, email pemberitahuan tanpa tautan", async () => {
    const e = mail("ul");
    const u = await user({ email: e, googleId: `subb7-${stamp}-ul` });
    const before = (await row(u.id)).sessionVersion;
    const res = await post("/auth/google/unlink", { password }, u.cookie);
    assert.equal(res.status, 200);
    const b = await res.json();
    assert.equal(b.hasGoogle, false);
    assert.equal(b.email, e);
    assert.equal((await row(u.id)).sessionVersion, before + 1);
    assert.equal(cookiesOf(res).length, 1);
    assert.equal((await get("/auth/me", u.cookie)).status, 401);
    assert.equal(sent.length, 1);
    assert.ok(!/https?:\/\//.test(sent[0].text));
  });

  test("unlink: 400 belum tertaut; 409 akun Google tanpa password (metode terakhir)", async () => {
    const a = await user();
    assert.equal((await post("/auth/google/unlink", { password }, a.cookie)).status, 400);
    const g = await googleOnly();
    const res = await post("/auth/google/unlink", { idToken: tok(claims(g.sub, g.email)) }, g.cookie);
    assert.equal(res.status, 409);
    assert.equal((await res.json()).error, "Tidak bisa menghapus metode masuk terakhir.");
    assert.ok((await row(g.id)).googleId);
  });

  test("unlink lalu POST /auth/google dengan sub sama tertaut kembali ke akun yang sama", async () => {
    const e = mail("relink");
    const sub = `subb7-${stamp}-relink`;
    const u = await user({ email: e, googleId: sub });
    assert.equal((await post("/auth/google/unlink", { password }, u.cookie)).status, 200);
    assert.equal((await row(u.id)).googleId, null);
    const res = await post("/auth/google", { idToken: tok(claims(sub, e)) });
    assert.equal(res.status, 200);
    assert.equal((await res.json()).id, u.id);
    assert.equal((await row(u.id)).googleId, sub);
    assert.equal(await prisma.user.count({ where: { email: e } }), 1);
  });

  // ---------------------------------------------------------------- umum
  test("401 tanpa sesi dan 403 untuk tamu pada ketiga route", async () => {
    const paths = ["/auth/phone", "/auth/email/remove", "/auth/google/unlink"];
    for (const path of paths) assert.equal((await post(path, { phone: rand(), password })).status, 401);
    const g = await post("/auth/guest", {});
    ids.push((await g.json()).user.id);
    for (const path of paths) assert.equal((await post(path, { phone: rand(), password }, cookieOf(g))).status, 403);
  });

  test("429 pembatas IP (10 per 15 menit) per route", async () => {
    let last;
    for (let i = 0; i < 11; i++) last = await post("/auth/email/remove", { password: "x" });
    assert.equal(last.status, 429);
  });

  test("503 saat Google belum dikonfigurasi dan re-auth Google dibutuhkan", async () => {
    const g = await googleOnly();
    await prisma.user.update({ where: { id: g.id }, data: { phone: rand() } });
    gsvc._setDepsForTests({ cfg: { googleConfigured: false, googleClientId: "" }, verifier });
    const res = await post("/auth/phone", { phone: rand(), idToken: "x" }, g.cookie);
    assert.equal(res.status, 503);
  });

  test("5 password salah lalu 429; password benar tetap ditolak sementara", async () => {
    const u = await user({ email: mail("brute") });
    for (let i = 0; i < 5; i++) {
      assert.equal((await post("/auth/email/remove", { password: "salah-salah" }, u.cookie)).status, 401);
    }
    assert.equal((await post("/auth/email/remove", { password }, u.cookie)).status, 429);
    assert.ok((await row(u.id)).email);
  });

  test("database tidak menyimpan password mentah atau ID token", async () => {
    const g = await user({ email: mail("simpan"), googleId: `subb7-${stamp}-sv` });
    const idToken = tok(claims(`subb7-${stamp}-sv`, "x@uji.test"));
    await post("/auth/google/unlink", { password, idToken }, g.cookie);
    const dump = JSON.stringify(await row(g.id));
    assert.ok(!dump.includes(password));
    assert.ok(!dump.includes(idToken));
  });
});
