import "dotenv/config";
import { describe, test, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { assertTestDatabase } from "./helpers/test-db.js";

// Langkah 9: POST /auth/google dengan verifier diinjeksi (tanpa jaringan ke Google).
// Hanya jalan di database ber-nama "_test".
let skip = false;
try {
  assertTestDatabase();
} catch (e) {
  skip = e.message;
}

describe("auth login Google (butuh database uji)", { skip }, () => {
  let server, base, prisma, svc, limits, authSvc;
  const ids = [];
  const emails = [];
  const stamp = Date.now();
  const CLIENT = "klien-uji.apps.googleusercontent.com";
  const cfgOn = { googleConfigured: true, googleClientId: CLIENT };
  let n = 0;
  const mail = (tag = "g") => {
    const e = `g9-${tag}-${stamp}-${++n}@uji.test`;
    emails.push(e);
    return e;
  };
  const rand = () => "0898" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
  const password = "rahasia123";

  // Token uji = kunci ke tabel payload; verifier meniru verifyIdToken (melempar bila token tak dikenal).
  const tokens = new Map();
  let verifierCalls = 0;
  const verifier = async (idToken, audience) => {
    verifierCalls++;
    assert.equal(audience, CLIENT);
    if (!tokens.has(idToken)) throw new Error("token tidak dikenal (rahasia)");
    const p = tokens.get(idToken);
    if (p instanceof Error) throw p;
    return p;
  };
  const claims = (o = {}) => ({
    aud: CLIENT, iss: "https://accounts.google.com", email_verified: true,
    sub: `sub-${stamp}-${++n}`, email: mail(), name: "Pengguna Google", ...o,
  });
  const tok = (payload) => {
    const t = `tok-${++n}`;
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
  const cookieOf = (res) => (res.headers.getSetCookie()[0] ?? "").split(";")[0];
  const google = (payload, cookie) => post("/auth/google", { idToken: tok(payload) }, cookie);
  const track = async (res) => {
    const body = await res.clone().json().catch(() => ({}));
    if (body.id) ids.push(body.id);
  };

  // Akun lama via register; email diset langsung di DB uji.
  async function legacyUser({ verified = true, googleId = null } = {}) {
    const reg = await post("/auth/register", { name: "Uji Lama", phone: rand(), password });
    const body = await reg.json();
    ids.push(body.id);
    const email = mail("lama");
    await prisma.user.update({
      where: { id: body.id },
      data: { email, emailVerifiedAt: verified ? new Date() : null, googleId },
    });
    return { id: body.id, phone: body.phone, email, cookie: cookieOf(reg) };
  }

  before(async () => {
    assertTestDatabase();
    const { app } = await import("../src/app.js");
    ({ prisma } = await import("../src/config/prisma.js"));
    svc = await import("../src/services/google-auth.service.js");
    authSvc = await import("../src/services/auth.service.js");
    limits = await import("../src/middleware/rate-limit.js");
    await new Promise((r) => (server = app.listen(0, r)));
    base = `http://127.0.0.1:${server.address().port}/api`;
  });
  beforeEach(() => {
    limits._resetForTests();
    verifierCalls = 0;
    svc._setDepsForTests({ cfg: cfgOn, verifier });
  });
  afterEach(() => {
    limits._resetForTests();
    svc._setDepsForTests(null);
  });
  after(async () => {
    if (prisma) {
      if (ids.length) await prisma.user.deleteMany({ where: { id: { in: ids } } });
      if (emails.length) await prisma.user.deleteMany({ where: { email: { in: emails } } });
      await prisma.$disconnect();
    }
    server?.close();
  });

  test("d: akun baru -> 201, bentuk public user, cookie sesi, tanpa googleId/sessionVersion", async () => {
    const c = claims({ name: "Siti Aminah" });
    const res = await google(c);
    await track(res);
    assert.equal(res.status, 201);
    const b = await res.json();
    assert.deepEqual(Object.keys(b).sort(), [
      "email", "emailVerified", "hasGoogle", "hasPassword", "id", "isGuest", "name", "needsProfileCompletion", "phone", "role",
    ]);
    assert.equal(b.name, "Siti Aminah");
    assert.equal(b.email, c.email);
    assert.equal(b.phone, null);
    assert.equal(b.role, "PETANI");
    assert.equal(b.isGuest, false);
    assert.equal(b.hasPassword, false);
    assert.equal(b.hasGoogle, true);
    assert.equal(b.emailVerified, true);
    assert.equal(b.needsProfileCompletion, true);
    const row = await prisma.user.findUnique({ where: { id: b.id } });
    assert.equal(row.googleId, c.sub);
    assert.equal(row.passwordHash, null);
    assert.ok(row.emailVerifiedAt);
    const me = await get("/auth/me", cookieOf(res));
    assert.equal(me.status, 200);
    assert.deepEqual(await me.json(), b);
  });

  test("d: name kosong -> fallback bagian sebelum @, email Google dinormalisasi lowercase", async () => {
    const local = `nama${stamp}${++n}`;
    emails.push(`${local}@uji.test`);
    const res = await google(claims({ name: undefined, email: `${local.toUpperCase()}@Uji.TEST` }));
    await track(res);
    assert.equal(res.status, 201);
    const b = await res.json();
    assert.equal(b.email, `${local}@uji.test`);
    assert.equal(b.name, local);
  });

  test("a: googleId sudah dikenal -> 200 dan akun yang sama (tanpa membuat baru)", async () => {
    const c = claims();
    const first = await google(c);
    await track(first);
    const second = await google(c);
    assert.equal(second.status, 200);
    assert.equal((await second.json()).id, (await first.json()).id);
    assert.equal(await prisma.user.count({ where: { googleId: c.sub } }), 1);
  });

  test("b: email cocok & terverifikasi -> googleId ditautkan, 200; password lama tetap bisa login", async () => {
    const u = await legacyUser();
    const c = claims({ email: u.email });
    const res = await google(c);
    assert.equal(res.status, 200);
    const b = await res.json();
    assert.equal(b.id, u.id);
    assert.equal(b.hasGoogle, true);
    assert.equal(b.hasPassword, true);
    assert.equal(b.phone, u.phone);
    assert.equal((await prisma.user.findUnique({ where: { id: u.id } })).googleId, c.sub);
    assert.equal((await post("/auth/login", { identifier: u.phone, password })).status, 200);
    assert.equal((await post("/auth/login", { identifier: u.email, password })).status, 200);
  });

  test("b: akun sudah punya googleId LAIN -> 409 dan googleId lama tidak berubah", async () => {
    const u = await legacyUser({ googleId: `lama-${stamp}-${++n}` });
    const lama = (await prisma.user.findUnique({ where: { id: u.id } })).googleId;
    const res = await google(claims({ email: u.email }));
    assert.equal(res.status, 409);
    assert.equal((await prisma.user.findUnique({ where: { id: u.id } })).googleId, lama);
    assert.equal(res.headers.getSetCookie().length, 0);
  });

  test("c: email cocok tapi belum terverifikasi -> 409 pesan persis, akun tidak diubah, tanpa cookie", async () => {
    const u = await legacyUser({ verified: false });
    const res = await google(claims({ email: u.email }));
    assert.equal(res.status, 409);
    assert.deepEqual(await res.json(), {
      error: "Email sudah terdaftar tetapi belum terverifikasi. Masuk dengan metode lain lalu verifikasi emailmu.",
    });
    const row = await prisma.user.findUnique({ where: { id: u.id } });
    assert.equal(row.googleId, null);
    assert.equal(row.emailVerifiedAt, null);
    assert.ok(row.passwordHash);
    assert.equal(res.headers.getSetCookie().length, 0);
  });

  test("401 seragam: email_verified false, iss salah, aud salah, email hilang, verifier melempar galat, token tak dikenal", async () => {
    const bad = [
      claims({ email_verified: false }),
      claims({ iss: "https://jahat.example" }),
      claims({ aud: "klien-lain" }),
      claims({ email: undefined }),
      new Error("galat-internal-rahasia"),
    ];
    const bodies = [];
    for (const p of bad) {
      const res = await google(p);
      assert.equal(res.status, 401);
      assert.equal(res.headers.getSetCookie().length, 0);
      bodies.push(JSON.stringify(await res.json()));
    }
    const unknown = await post("/auth/google", { idToken: "tidak-dikenal" });
    assert.equal(unknown.status, 401);
    bodies.push(JSON.stringify(await unknown.json()));
    assert.equal(new Set(bodies).size, 1);
    assert.ok(!bodies[0].includes("rahasia"));
    assert.equal(await prisma.user.count({ where: { email: bad[0].email } }), 0);
  });

  test("503 saat Google tidak dikonfigurasi (verifier tidak dipanggil)", async () => {
    svc._setDepsForTests({ cfg: { googleConfigured: false, googleClientId: "" }, verifier });
    const res = await post("/auth/google", { idToken: "apa-saja" });
    assert.equal(res.status, 503);
    assert.equal(verifierCalls, 0);
  });

  test("400: body kosong, idToken kosong/bukan string", async () => {
    for (const body of [{}, { idToken: "" }, { idToken: "   " }, { idToken: 123 }]) {
      assert.equal((await post("/auth/google", body)).status, 400);
    }
    assert.equal(verifierCalls, 0);
  });

  test("429: pembatas per IP (20 per 15 menit)", async () => {
    let last;
    for (let i = 0; i < 21; i++) last = await post("/auth/google", { idToken: "tidak-dikenal" });
    assert.equal(last.status, 429);
  });

  test("user hasil d: login password dengan email gagal 401 seragam dengan akun yang tidak ada", async () => {
    const c = claims();
    await track(await google(c));
    const g = await post("/auth/login", { identifier: c.email, password });
    const none = await post("/auth/login", { identifier: mail("tidak-ada"), password });
    assert.equal(g.status, 401);
    assert.equal(none.status, 401);
    assert.deepEqual(await g.json(), await none.json());
  });

  test("setelah bumpSessionVersion (reset password) sesi login Google lama ditolak 401", async () => {
    const c = claims();
    const res = await google(c);
    await track(res);
    const cookie = cookieOf(res);
    const { id } = await res.json();
    assert.equal((await get("/auth/me", cookie)).status, 200);
    await prisma.$transaction((tx) => authSvc.bumpSessionVersion(tx, id));
    assert.equal((await get("/auth/me", cookie)).status, 401);
    const again = await google(c); // masuk lagi: sesi baru dengan sv terbaru
    assert.equal(again.status, 200);
    assert.equal((await get("/auth/me", cookieOf(again))).status, 200);
  });

  test("balapan P2002 saat create: pencarian diulang, hasil 200 bukan 500", async () => {
    const c = claims();
    let raced = false;
    const db = {
      user: {
        findUnique: (a) => prisma.user.findUnique(a),
        findFirst: (a) => prisma.user.findFirst(a),
        updateMany: (a) => prisma.user.updateMany(a),
        // Meniru permintaan lain yang menang lebih dulu, lalu create kita bentrok.
        create: async (a) => {
          if (!raced) {
            raced = true;
            const winner = await prisma.user.create({ data: a.data, select: { id: true } });
            ids.push(winner.id);
            throw Object.assign(new Error("duplikat"), { code: "P2002" });
          }
          return prisma.user.create(a);
        },
      },
    };
    svc._setDepsForTests({ cfg: cfgOn, verifier, db });
    const res = await google(c);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).email, c.email);
    assert.equal(await prisma.user.count({ where: { googleId: c.sub } }), 1);
  });

  test("balapan P2002 pada tautan (b): googleId diambil permintaan lain -> tidak 500", async () => {
    const u = await legacyUser();
    const c = claims({ email: u.email });
    let raced = false;
    const db = {
      user: {
        findUnique: (a) => prisma.user.findUnique(a),
        findFirst: (a) => prisma.user.findFirst(a),
        updateMany: async (a) => {
          if (!raced) {
            raced = true;
            await prisma.user.update({ where: { id: u.id }, data: { googleId: c.sub } }); // pemenang
            throw Object.assign(new Error("duplikat"), { code: "P2002" });
          }
          return prisma.user.updateMany(a);
        },
        create: (a) => prisma.user.create(a),
      },
    };
    svc._setDepsForTests({ cfg: cfgOn, verifier, db });
    const res = await google(c);
    assert.equal(res.status, 200);
    assert.equal((await res.json()).id, u.id);
  });

  test("akun tamu (email kosong) tidak pernah dicocokkan atau diubah; sesi tamu digantikan", async () => {
    const g = await post("/auth/guest", {});
    const guestCookie = cookieOf(g);
    const guestId = (await g.json()).user.id;
    ids.push(guestId);
    const sebelum = await prisma.user.findUnique({ where: { id: guestId } });

    const res = await google(claims(), guestCookie);
    await track(res);
    assert.equal(res.status, 201);
    const b = await res.json();
    assert.notEqual(b.id, guestId);
    assert.equal(b.isGuest, false);
    const newCookie = cookieOf(res);
    assert.notEqual(newCookie, guestCookie);
    assert.equal((await (await get("/auth/me", newCookie)).json()).id, b.id);

    const sesudah = await prisma.user.findUnique({ where: { id: guestId } });
    assert.deepEqual(sesudah, sebelum);
    assert.equal(sesudah.googleId, null);
    assert.equal(sesudah.email, null);
  });

  test("sesi akun lain digantikan oleh akun Google yang masuk", async () => {
    const u = await legacyUser();
    const res = await google(claims(), u.cookie);
    await track(res);
    const me = await (await get("/auth/me", cookieOf(res))).json();
    assert.notEqual(me.id, u.id);
  });
});
