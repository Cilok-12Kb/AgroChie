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

  // =================================================================================================
  // Langkah 1 (pelengkap cakupan): tabel keputusan lewat HTTP, re-auth, cookie, atomik, token, kepemilikan, email.
  // Akun dibuat langsung di database uji (make) agar kombinasi password/HP/email/Google bebas.
  // =================================================================================================
  let hashed;
  const pwHash = () => (hashed ??= import("argon2").then((m) => m.default.hash(password)));
  async function make({ pw = false, phone = null, email = null, verified = true, g = null, guest = false } = {}) {
    const r = await prisma.user.create({
      data: {
        name: "Uji B7", phone, email, emailVerifiedAt: email && verified ? new Date() : null,
        passwordHash: pw ? await pwHash() : null, googleId: g, isGuest: guest,
      },
    });
    ids.push(r.id);
    if (email) emails.push(email);
    const tools = await (await import("../src/utils/session.js")).getSessionTools();
    const token = await tools.createToken({ id: r.id, role: r.role, isGuest: guest, sessionVersion: r.sessionVersion });
    return { id: r.id, role: r.role, phone, email, g, tools, cookie: `agro_session=${token}` };
  }
  const sub = () => `subb7-${stamp}-${++n}`;
  const snap = async (id) => {
    const r = await row(id);
    return {
      phone: r.phone, email: r.email, emailVerifiedAt: r.emailVerifiedAt?.getTime() ?? null,
      googleId: r.googleId, passwordHash: r.passwordHash, sessionVersion: r.sessionVersion,
    };
  };

  const M = {
    guest: "Akun tamu tidak dapat mengubah data akun",
    noEmail: "Belum ada email di akun ini",
    noGoogle: "Akun ini belum tertaut ke Google",
    last: "Tidak bisa menghapus metode masuk terakhir.",
    forbidden: "Tidak diizinkan",
  };
  // Fixture = tabel keputusan §2 di docs/rencana-kelompok-b.md. a: pw, phone, email ("V"/"U"), g, guest.
  const TABLE = [
    { n: 1, a: { pw: 1, phone: 1 }, change: [200], remove: [400, M.noEmail], unlink: [400, M.noGoogle] },
    { n: 2, a: { pw: 1, phone: 1, email: "V" }, change: [200], remove: [200], unlink: [400, M.noGoogle] },
    { n: 3, a: { pw: 1, phone: 1, email: "U" }, change: [200], remove: [200], unlink: [400, M.noGoogle] },
    { n: 4, a: { pw: 1, phone: 1, email: "V", g: 1 }, change: [200], remove: [200], unlink: [200] },
    { n: 5, a: { pw: 1, phone: 1, g: 1 }, change: [200], remove: [400, M.noEmail], unlink: [200] },
    { n: 6, a: { email: "V", g: 1 }, add: [200], remove: [200], unlink: [409, M.last] },
    { n: 7, a: { phone: 1, email: "V", g: 1 }, change: [200], remove: [200], unlink: [409, M.last] },
    { n: 8, a: { pw: 1, email: "V", g: 1 }, add: [200], remove: [200], unlink: [200] },
    { n: 9, a: { pw: 1, email: "V" }, add: [200], remove: [409, M.last], unlink: [400, M.noGoogle] },
    { n: 10, a: { pw: 1, g: 1 }, add: [200], remove: [400, M.noEmail], unlink: [409, M.last] },
    { n: 11, a: { g: 1 }, add: [200], remove: [400, M.noEmail], unlink: [409, M.last] },
    { n: 12, a: { guest: 1, pw: 1, phone: 1, email: "V" }, change: [403, M.guest], remove: [403, M.guest], unlink: [403, M.guest] },
    { n: 13, a: { phone: 1, email: "V" }, change: [403, M.forbidden], remove: [409, M.last], unlink: [409, M.last] },
    { n: 13, a: {}, add: [403, M.forbidden] },
  ];
  const PATHS = { add: "/auth/phone", change: "/auth/phone", remove: "/auth/email/remove", unlink: "/auth/google/unlink" };

  for (const spec of TABLE) {
    for (const act of Object.keys(PATHS)) {
      if (!spec[act]) continue;
      test(`tabel keputusan: baris ${spec.n} x ${act}`, async () => {
        const a = spec.a;
        const u = await make({
          pw: Boolean(a.pw), phone: a.phone ? rand() : null, email: a.email ? mail("tb") : null,
          verified: a.email === "V", g: a.g ? sub() : null, guest: Boolean(a.guest),
        });
        const body = {};
        const newPhone = rand();
        if (act === "add" || act === "change") body.phone = newPhone;
        if (act !== "add") {
          if (a.pw) body.password = password;
          else if (a.g) body.idToken = tok(claims(u.g, u.email ?? `g${n}@uji.test`));
        }
        const before = await snap(u.id);
        const res = await post(PATHS[act], body, u.cookie);
        const [status, msg] = spec[act];
        assert.equal(res.status, status);
        const b = await res.json();
        const after = await snap(u.id);
        if (status !== 200) {
          assert.equal(b.error, msg);
          assert.deepEqual(after, before); // penolakan tidak mengubah apa pun
          return;
        }
        assert.ok(!("user" in b) && !("passwordHash" in b) && !("googleId" in b) && !("sessionVersion" in b));
        assert.equal(b.id, u.id);
        if (act === "add" || act === "change") {
          assert.equal(after.phone, newPhone);
          assert.equal(after.sessionVersion, before.sessionVersion + (act === "change" ? 1 : 0));
        } else if (act === "remove") {
          assert.equal(after.email, null);
          assert.equal(after.emailVerifiedAt, null);
          assert.equal(after.sessionVersion, before.sessionVersion + 1);
        } else {
          assert.equal(after.googleId, null);
          assert.equal(after.email, before.email);
          assert.equal(after.sessionVersion, before.sessionVersion + 1);
        }
      });
    }
  }

  // ---------------------------------------------------------------- re-auth
  test("re-auth Google: token rusak, sub akun lain, aud, iss, email belum terverifikasi -> 401 dengan badan identik", async () => {
    for (const [path, mk] of [
      ["/auth/phone", (t) => ({ phone: rand(), idToken: t })],
      ["/auth/email/remove", (t) => ({ idToken: t })],
    ]) {
      limits._resetForTests();
      const g = sub();
      const e = mail("gi");
      const u = await make({ phone: rand(), email: e, g });
      const before = await snap(u.id);
      const c = claims(g, e);
      const variants = [
        "token-tidak-dikenal",
        tok(claims("sub-akun-lain", e)),
        tok({ ...c, aud: "klien-lain.apps.googleusercontent.com" }),
        tok({ ...c, iss: "https://evil.test" }),
        tok({ ...c, email_verified: false }),
      ];
      for (const t of variants) {
        const res = await post(path, mk(t), u.cookie);
        assert.equal(res.status, 401);
        assert.deepEqual(await res.json(), { error: "Token Google tidak valid" });
      }
      assert.deepEqual(await snap(u.id), before);
    }
  });

  test("re-auth: jenis kredensial salah -> 400; Google tidak dikonfigurasi -> 503 tanpa memanggil verifier; password salah tidak mengubah apa pun", async () => {
    const pwUser = await make({ pw: true, phone: rand(), email: mail("ra") });
    const before = await snap(pwUser.id);
    const onlyToken = await post("/auth/email/remove", { idToken: tok(claims("x", "x@uji.test")) }, pwUser.cookie);
    assert.equal(onlyToken.status, 400);
    assert.equal((await onlyToken.json()).error, "Kata sandi wajib diisi");
    const bad = await post("/auth/email/remove", { password: "salah-salah" }, pwUser.cookie);
    assert.equal(bad.status, 401);
    assert.equal((await bad.json()).error, "Kata sandi salah");
    assert.equal(cookiesOf(bad).length, 0);
    assert.deepEqual(await snap(pwUser.id), before);

    const g = await make({ phone: rand(), email: mail("rb"), g: sub() });
    const onlyPw = await post("/auth/email/remove", { password }, g.cookie);
    assert.equal(onlyPw.status, 400);
    assert.equal((await onlyPw.json()).error, "idToken wajib diisi");

    let calls = 0;
    gsvc._setDepsForTests({ cfg: { googleConfigured: false, googleClientId: "" }, verifier: async () => { calls++; return {}; } });
    const off = await post("/auth/email/remove", { idToken: "x" }, g.cookie);
    assert.equal(off.status, 503);
    assert.equal(calls, 0);
  });

  test("5 re-auth gagal (dibagi dengan google/link): ke-6 dengan kredensial benar tetap 429; user lain tidak terblokir", async () => {
    const a = await make({ pw: true, phone: rand(), email: mail("sh"), g: sub() });
    const b = await make({ pw: true, phone: rand() });
    for (let i = 0; i < 3; i++) {
      assert.equal((await post("/auth/google/link", { idToken: "x", password: "salah-salah" }, a.cookie)).status, 401);
    }
    for (let i = 0; i < 2; i++) {
      assert.equal((await post("/auth/email/remove", { password: "salah-salah" }, a.cookie)).status, 401);
    }
    const blocked = await post("/auth/phone", { phone: rand(), password }, a.cookie);
    assert.equal(blocked.status, 429);
    assert.equal((await blocked.json()).error, "Terlalu banyak percobaan verifikasi gagal. Coba lagi nanti.");
    assert.equal((await post("/auth/google/link", { idToken: "x", password }, a.cookie)).status, 429); // jatah yang sama
    assert.equal((await post("/auth/google/unlink", { password }, a.cookie)).status, 429);
    assert.ok((await row(a.id)).googleId);
    assert.equal((await post("/auth/phone", { phone: rand(), password }, b.cookie)).status, 200); // user lain bebas
  });

  test("re-auth sukses mengosongkan hitungan gagal", async () => {
    const u = await make({ pw: true, phone: rand() });
    for (let i = 0; i < 4; i++) assert.equal((await post("/auth/phone", { phone: rand(), password: "salah-salah" }, u.cookie)).status, 401);
    const ok = await post("/auth/phone", { phone: rand(), password }, u.cookie);
    assert.equal(ok.status, 200);
    const c = cookieOf(ok);
    for (let i = 0; i < 4; i++) assert.equal((await post("/auth/phone", { phone: rand(), password: "salah-salah" }, c)).status, 401);
  });

  // ---------------------------------------------------------------- sessionVersion dan cookie
  test("Set-Cookie TERAKHIR membawa sv baru saat refreshSession ikut jalan", async () => {
    const { env } = await import("../src/config/env.js");
    const u = await make({ pw: true, phone: rand() });
    const before = (await row(u.id)).sessionVersion;
    // Token terbit 75% dari masa berlaku yang lalu -> sisa < separuh -> requireUser memperbarui cookie.
    const issued = Math.floor(Date.now() / 1000) - Math.floor(env.jwtTtlDays * 86400 * 0.75);
    const old = await u.tools.createToken({ id: u.id, role: u.role, isGuest: false, sessionVersion: before }, issued);
    const res = await post("/auth/phone", { phone: rand(), password }, `agro_session=${old}`);
    assert.equal(res.status, 200);
    const cs = cookiesOf(res);
    assert.equal(cs.length, 2);
    const val = (c) => c.split(";")[0].slice("agro_session=".length);
    assert.equal((await u.tools.verifyToken(val(cs[0]))).sv, before);
    const last = await u.tools.verifyToken(val(cs.at(-1)));
    assert.equal(last.sv, before + 1);
    assert.equal(last.sv, (await row(u.id)).sessionVersion);
    assert.equal((await get("/auth/me", cookieOf(res))).status, 200);
  });

  test("tambah HP dan nomor sama tidak menaikkan versi; cookie lama tetap sah", async () => {
    const g = await make({ email: mail("nb"), g: sub() });
    const before = (await row(g.id)).sessionVersion;
    assert.equal((await post("/auth/phone", { phone: rand() }, g.cookie)).status, 200);
    assert.equal((await get("/auth/me", g.cookie)).status, 200);
    assert.equal((await row(g.id)).sessionVersion, before);
    const p = await make({ pw: true, phone: rand() });
    assert.equal((await post("/auth/phone", { phone: p.phone }, p.cookie)).status, 200);
    assert.equal((await get("/auth/me", p.cookie)).status, 200);
  });

  test("P2002 saat commit: 409 seragam, sessionVersion dan nomor tidak berubah", async () => {
    const holder = await make({ phone: rand() });
    const u = await make({ pw: true, phone: rand() });
    const before = await snap(u.id);
    const bind = (t, k) => (typeof t[k] === "function" ? t[k].bind(t) : t[k]);
    // Pembungkus: pengecekan pemegang nomor di dalam transaksi "tidak melihat" pemegangnya, jadi updateMany menabrak unique.
    const racing = new Proxy(prisma, {
      get(t, k) {
        if (k !== "$transaction") return bind(t, k);
        return (fn, ...rest) => t.$transaction((tx) => fn(new Proxy(tx, {
          get(tt, kk) {
            if (kk !== "user") return bind(tt, kk);
            return new Proxy(tt.user, {
              get(uu, m) {
                if (m === "findUnique") return (args) => (args?.where?.phone ? Promise.resolve(null) : uu.findUnique(args));
                return bind(uu, m);
              },
            });
          },
        })), ...rest);
      },
    });
    asvc._setDepsForTests({ db: racing, cfg: mailCfg, mailer: mailerMod.createMailer(mailCfg, capture) });
    const res = await post("/auth/phone", { phone: holder.phone, password }, u.cookie);
    assert.equal(res.status, 409);
    assert.equal((await res.json()).error, "Nomor HP tidak dapat digunakan.");
    assert.deepEqual(await snap(u.id), before);
    assert.equal((await row(holder.id)).phone, holder.phone);
  });

  test("dua unlink bersamaan: satu 200, satu ditolak (bukan 500); versi naik tepat 1", async () => {
    const u = await make({ pw: true, phone: rand(), email: mail("cc"), g: sub() });
    const before = (await row(u.id)).sessionVersion;
    const rs = await Promise.all([
      post("/auth/google/unlink", { password }, u.cookie),
      post("/auth/google/unlink", { password }, u.cookie),
    ]);
    const codes = rs.map((r) => r.status).sort();
    assert.equal(codes.filter((c) => c === 200).length, 1, `status: ${codes}`);
    assert.ok([400, 401, 409].includes(codes.find((c) => c !== 200)), `status: ${codes}`);
    const after = await row(u.id);
    assert.equal(after.googleId, null);
    assert.equal(after.sessionVersion, before + 1);
  });

  // ---------------------------------------------------------------- hapus email: token
  test("hapus email: token belum terpakai dicabut; yang sudah terpakai dan milik user lain tidak tersentuh", async () => {
    const e = mail("tk");
    const u = await make({ pw: true, phone: rand(), email: e });
    const other = await make({ pw: true, phone: rand(), email: mail("tk2") });
    const future = new Date(Date.now() + 600_000);
    const past = new Date(Date.now() - 86_400_000);
    const h = (k) => `h-${stamp}-${++n}-${k}`;
    const ev = (userId, email, usedAt = null) =>
      prisma.emailVerification.create({ data: { userId, email, tokenHash: h("ev"), expiresAt: future, usedAt } });
    const pr = (userId, usedAt = null) =>
      prisma.passwordReset.create({ data: { userId, tokenHash: h("pr"), expiresAt: future, usedAt } });
    const evOpen = await ev(u.id, e);
    const evUsed = await ev(u.id, e, past);
    const prOpen = await pr(u.id);
    const prUsed = await pr(u.id, past);
    const oEv = await ev(other.id, "tk2@uji.test");
    const oPr = await pr(other.id);

    assert.equal((await post("/auth/email/remove", { password }, u.cookie)).status, 200);

    assert.ok((await prisma.emailVerification.findUnique({ where: { id: evOpen.id } })).usedAt);
    assert.ok((await prisma.passwordReset.findUnique({ where: { id: prOpen.id } })).usedAt);
    assert.equal((await prisma.emailVerification.findUnique({ where: { id: evUsed.id } })).usedAt.getTime(), past.getTime());
    assert.equal((await prisma.passwordReset.findUnique({ where: { id: prUsed.id } })).usedAt.getTime(), past.getTime());
    assert.equal((await prisma.emailVerification.findUnique({ where: { id: oEv.id } })).usedAt, null);
    assert.equal((await prisma.passwordReset.findUnique({ where: { id: oPr.id } })).usedAt, null);
  });

  // ---------------------------------------------------------------- kepemilikan
  test("kepemilikan: aksi user A tidak mengubah user B", async () => {
    const a = await make({ pw: true, phone: rand(), email: mail("oa"), g: sub() });
    const b = await make({ pw: true, phone: rand(), email: mail("ob"), g: sub() });
    const before = await snap(b.id);
    let res = await post("/auth/phone", { phone: rand(), password }, a.cookie);
    assert.equal(res.status, 200);
    res = await post("/auth/google/unlink", { password }, cookieOf(res));
    assert.equal(res.status, 200);
    res = await post("/auth/email/remove", { password }, cookieOf(res));
    assert.equal(res.status, 200);
    assert.deepEqual(await snap(b.id), before);
    assert.equal((await get("/auth/me", b.cookie)).status, 200);
  });

  // ---------------------------------------------------------------- email pemberitahuan
  test("email pemberitahuan dikirim SETELAH commit (pengirim melihat perubahan sudah tersimpan)", async () => {
    const seen = [];
    const u = await make({ pw: true, phone: rand(), email: mail("af"), g: sub() });
    const rec = (kind) => async () => {
      const r = await row(u.id);
      seen.push({ kind, phone: r.phone, email: r.email, googleId: r.googleId, sv: r.sessionVersion });
    };
    asvc._setDepsForTests({
      cfg: mailCfg,
      mailer: { sendPhoneChangedEmail: rec("phone"), sendGoogleUnlinkedEmail: rec("google"), sendEmailRemovedEmail: rec("email") },
    });
    const v0 = (await row(u.id)).sessionVersion;
    const p = rand();
    let res = await post("/auth/phone", { phone: p, password }, u.cookie);
    assert.equal(res.status, 200);
    res = await post("/auth/google/unlink", { password }, cookieOf(res));
    assert.equal(res.status, 200);
    res = await post("/auth/email/remove", { password }, cookieOf(res));
    assert.equal(res.status, 200);
    assert.deepEqual(seen.map((s) => s.kind), ["phone", "google", "email"]);
    assert.equal(seen[0].phone, p);
    assert.equal(seen[0].sv, v0 + 1);
    assert.equal(seen[1].googleId, null);
    assert.equal(seen[1].sv, v0 + 2);
    assert.equal(seen[2].email, null);
    assert.equal(seen[2].sv, v0 + 3);
  });

  test("ganti HP dan lepas Google: tanpa email pemberitahuan bila email akun null atau belum terverifikasi", async () => {
    const noEmail = await make({ pw: true, phone: rand(), g: sub() });
    const unverified = await make({ pw: true, phone: rand(), email: mail("uv"), verified: false, g: sub() });
    for (const u of [noEmail, unverified]) {
      let res = await post("/auth/phone", { phone: rand(), password }, u.cookie);
      assert.equal(res.status, 200);
      res = await post("/auth/google/unlink", { password }, cookieOf(res));
      assert.equal(res.status, 200);
    }
    assert.equal(sent.length, 0);
  });

  test("kegagalan kirim: respons tetap 200, database berubah, log tanpa alamat email maupun nomor HP", async (t) => {
    const logs = [];
    t.mock.method(console, "error", (...args) => logs.push(args.join(" ")));
    const e = mail("fail");
    const u = await make({ pw: true, phone: rand(), email: e });
    const boom = async () => {
      throw Object.assign(new Error(`SMTP menolak ${e}`), { code: "ESOCKET" });
    };
    asvc._setDepsForTests({ cfg: mailCfg, mailer: { sendEmailRemovedEmail: boom } });
    const res = await post("/auth/email/remove", { password }, u.cookie);
    assert.equal(res.status, 200);
    assert.equal((await row(u.id)).email, null);
    assert.ok(logs.length >= 1 && logs.every((l) => l.includes("[mail]")));
    assert.ok(logs.every((l) => !l.includes(e) && !l.includes(u.phone)));
  });

  test("mailConfigured false: tidak ada percobaan kirim dan respons tetap 200", async () => {
    let calls = 0;
    const count = async () => { calls++; };
    asvc._setDepsForTests({
      cfg: { ...mailCfg, mailConfigured: false },
      mailer: { sendEmailRemovedEmail: count, sendGoogleUnlinkedEmail: count, sendPhoneChangedEmail: count },
    });
    const u = await make({ pw: true, phone: rand(), email: mail("nm"), g: sub() });
    let res = await post("/auth/phone", { phone: rand(), password }, u.cookie);
    assert.equal(res.status, 200);
    res = await post("/auth/google/unlink", { password }, cookieOf(res));
    assert.equal(res.status, 200);
    res = await post("/auth/email/remove", { password }, cookieOf(res));
    assert.equal(res.status, 200);
    assert.equal(calls, 0);
  });

});
