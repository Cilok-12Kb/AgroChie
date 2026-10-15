import "dotenv/config";
import { describe, test, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import argon2 from "argon2";
import { assertTestDatabase } from "./helpers/test-db.js";

// [REVISI] D3: login dengan HP atau email. File terpisah agar pembatas login (10 per IP per 10 menit,
// berlaku per proses tes) tidak berbagi hitungan dengan auth.db.test.js. Total login di file ini <= 9.
// Hanya jalan di database ber-nama "_test"; selain itu dilewati.
let skip = false;
try {
  assertTestDatabase();
} catch (e) {
  skip = e.message;
}

describe("auth login HP atau email (butuh database uji)", { skip }, () => {
  let server, base, prisma;
  const rand = () => "0899" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
  const phone = rand();
  const password = "rahasia123";
  const stamp = Date.now();
  const ids = [];

  const post = (path, body, cookie) =>
    fetch(base + path, {
      method: "POST",
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body ?? {}),
    });
  const cookieOf = (res) => (res.headers.getSetCookie()[0] ?? "").split(";")[0];

  const mkUser = async (data) => {
    const u = await prisma.user.create({ data: { name: "Uji D3", role: "PETANI", ...data } });
    ids.push(u.id);
    return u;
  };

  before(async () => {
    assertTestDatabase();
    const { app } = await import("../src/app.js");
    ({ prisma } = await import("../src/config/prisma.js"));
    await new Promise((r) => (server = app.listen(0, r)));
    base = `http://127.0.0.1:${server.address().port}/api`;
    await mkUser({ phone, passwordHash: await argon2.hash(password) });
  });

  // [REVISI] reset hitungan pembatas antar tes (tidak lagi bergantung pada batas 9 login per file)
  const resetLimits = async () => (await import("../src/middleware/rate-limit.js"))._resetForTests();
  beforeEach(resetLimits);
  afterEach(resetLimits);

  after(async () => {
    if (prisma) {
      if (ids.length) await prisma.user.deleteMany({ where: { id: { in: ids } } });
      await prisma.$disconnect();
    }
    server?.close();
  });

  test("HP cara lama ({phone}) dan identifier HP berhasil (2 login)", async () => {
    for (const body of [{ phone, password }, { identifier: `${phone.slice(0, 4)}-${phone.slice(4)}`, password }]) {
      const r = await post("/auth/login", body);
      assert.equal(r.status, 200);
      assert.match(r.headers.getSetCookie()[0], /^agro_session=/);
    }
  });

  test("email beda huruf besar/kecil, akun tanpa HP (2 login)", async () => {
    const email = `d3-${stamp}@uji.test`;
    const u = await mkUser({ email, passwordHash: await argon2.hash(password) });
    const r1 = await post("/auth/login", { identifier: email, password });
    const r2 = await post("/auth/login", { identifier: `  ${email.toUpperCase()} `, password });
    assert.equal(r1.status, 200);
    assert.equal(r2.status, 200);
    const body = await r2.json();
    assert.equal(body.id, u.id);
    assert.equal(body.email, email);
  });

  test("akun Google-only ditolak; pesan sama dengan sandi salah dan akun tak ada (4 login)", async () => {
    const gEmail = `d3g-${stamp}@uji.test`;
    const g = await mkUser({ email: gEmail, passwordHash: null });
    await prisma.user.update({ where: { id: g.id }, data: { googleId: `uji-google-${g.id}`, emailVerifiedAt: new Date() } });
    const pEmail = `d3p-${stamp}@uji.test`;
    await mkUser({ email: pEmail, passwordHash: await argon2.hash(password) });

    const gRes = await post("/auth/login", { identifier: gEmail, password });
    assert.equal(gRes.status, 401);
    assert.equal(gRes.headers.getSetCookie().length, 0);
    const msg = await gRes.json();
    const others = [
      await post("/auth/login", { identifier: pEmail, password: "salah-total" }), // sandi salah (email)
      await post("/auth/login", { identifier: `tidakada-${stamp}@uji.test`, password }), // email tak ada
      await post("/auth/login", { phone: rand(), password }), // HP tak ada
    ];
    for (const r of others) {
      assert.equal(r.status, 401);
      assert.deepEqual(await r.json(), msg);
    }
  });

  test("bentuk respons login dan register = /auth/me (1 login)", async () => {
    const p = rand();
    const reg = await post("/auth/register", { name: "Dewi", phone: p, password });
    const regBody = await reg.json();
    ids.push(regBody.id);
    const login = await post("/auth/login", { identifier: p, password });
    const loginBody = await login.json();
    const me = await (await fetch(base + "/auth/me", { headers: { cookie: cookieOf(login) } })).json();
    assert.deepEqual(loginBody, me);
    assert.deepEqual(regBody, me);
    for (const k of ["id", "name", "phone", "role", "isGuest"]) assert.ok(k in loginBody, k); // field lama tetap ada
    for (const k of ["passwordHash", "googleId", "sessionVersion", "emailVerifiedAt"]) assert.ok(!(k in loginBody), k);
    assert.ok(!JSON.stringify(loginBody).includes("argon2"));
  });
});
