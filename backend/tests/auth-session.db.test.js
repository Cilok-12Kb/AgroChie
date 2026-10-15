import "dotenv/config";
import { describe, test, before, after, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { SignJWT } from "jose";
import { assertTestDatabase } from "./helpers/test-db.js";

// Langkah 7: sessionVersion (D1) end-to-end. Hanya jalan di database ber-nama "_test".
let skip = false;
try {
  assertTestDatabase();
} catch (e) {
  skip = e.message;
}

describe("auth sessionVersion (butuh database uji)", { skip }, () => {
  let server, base, prisma, authSvc, limits, env;
  const ids = [];
  const rand = () => "0898" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
  const password = "rahasia123";

  const post = (path, body, cookie) =>
    fetch(base + path, {
      method: "POST",
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body ?? {}),
    });
  const get = (path, cookie) => fetch(base + path, { headers: cookie ? { cookie } : {} });
  const cookieOf = (res) => (res.headers.getSetCookie()[0] ?? "").split(";")[0];
  const clearedCookie = (res) =>
    res.headers.getSetCookie().some((c) => /^agro_session=;/.test(c) && /Expires=Thu, 01 Jan 1970/i.test(c));
  const claims = (cookie) => JSON.parse(Buffer.from(cookie.split("=")[1].split(".")[1], "base64url").toString());

  async function newUser() {
    const phone = rand();
    const reg = await post("/auth/register", { name: "Uji Sesi", phone, password });
    const body = await reg.json();
    ids.push(body.id);
    return { id: body.id, phone, cookie: cookieOf(reg), regBody: body };
  }
  const bump = (id) => prisma.$transaction((tx) => authSvc.bumpSessionVersion(tx, id));
  const legacyToken = (id, extra = {}, iat = Math.floor(Date.now() / 1000), exp = iat + 7 * 86400) =>
    new SignJWT({ role: "PETANI", isGuest: false, ...extra })
      .setProtectedHeader({ alg: "HS256" }).setSubject(id).setIssuedAt(iat).setExpirationTime(exp)
      .sign(new TextEncoder().encode(env.jwtSecret));

  before(async () => {
    assertTestDatabase();
    const { app } = await import("../src/app.js");
    ({ prisma } = await import("../src/config/prisma.js"));
    authSvc = await import("../src/services/auth.service.js");
    limits = await import("../src/middleware/rate-limit.js");
    ({ env } = await import("../src/config/env.js"));
    await new Promise((r) => (server = app.listen(0, r)));
    base = `http://127.0.0.1:${server.address().port}/api`;
  });
  beforeEach(() => limits._resetForTests());
  afterEach(() => limits._resetForTests());
  after(async () => {
    if (prisma) {
      if (ids.length) await prisma.user.deleteMany({ where: { id: { in: ids } } });
      await prisma.$disconnect();
    }
    server?.close();
  });

  test("register/login/guest menerbitkan klaim sv = sessionVersion; sessionVersion tidak bocor ke klien", async () => {
    const u = await newUser();
    assert.equal(claims(u.cookie).sv, 0);
    assert.ok(!("sessionVersion" in u.regBody));
    await bump(u.id);
    const login = await post("/auth/login", { identifier: u.phone, password });
    assert.equal(login.status, 200);
    assert.equal(claims(cookieOf(login)).sv, 1);
    assert.ok(!JSON.stringify(await login.json()).includes("sessionVersion"));
    assert.ok(!JSON.stringify(await (await get("/auth/me", cookieOf(login))).json()).includes("sessionVersion"));

    const g = await post("/auth/guest", {});
    const gb = await g.json();
    ids.push(gb.user.id);
    assert.equal(claims(cookieOf(g)).sv, 0);
    assert.ok(!("sessionVersion" in gb.user));
  });

  test("token lama tanpa sv tetap valid selama sessionVersion = 0", async () => {
    const u = await newUser();
    const legacy = await legacyToken(u.id);
    assert.equal((await get("/auth/me", `agro_session=${legacy}`)).status, 200);
    await bump(u.id);
    assert.equal((await get("/auth/me", `agro_session=${legacy}`)).status, 401);
  });

  test("setelah bumpSessionVersion token lama 401 + cookie dihapus; login ulang menghasilkan token valid", async () => {
    const u = await newUser();
    assert.equal((await get("/auth/me", u.cookie)).status, 200);
    await bump(u.id);
    const res = await get("/auth/me", u.cookie);
    assert.equal(res.status, 401);
    assert.ok(clearedCookie(res), "cookie sesi harus dihapus");
    const login = await post("/auth/login", { phone: u.phone, password });
    const fresh = cookieOf(login);
    assert.equal((await get("/auth/me", fresh)).status, 200);
    assert.equal((await get("/auth/me", u.cookie)).status, 401); // token lama tetap mati
  });

  test("bumpSessionVersion atomik: increment bersamaan tidak ada yang hilang", async () => {
    const u = await newUser();
    await Promise.all([bump(u.id), bump(u.id), bump(u.id)]);
    assert.equal((await prisma.user.findUnique({ where: { id: u.id } })).sessionVersion, 3);
  });

  test("user dihapus -> token lama 401", async () => {
    const u = await newUser();
    await prisma.user.deleteMany({ where: { id: u.id } });
    const res = await get("/auth/me", u.cookie);
    assert.equal(res.status, 401);
    assert.ok(clearedCookie(res));
  });

  test("akun tamu mengikuti aturan yang sama", async () => {
    const g = await post("/auth/guest", {});
    const gb = await g.json();
    ids.push(gb.user.id);
    const cookie = cookieOf(g);
    assert.equal((await get("/auth/me", cookie)).status, 200);
    await bump(gb.user.id);
    assert.equal((await get("/auth/me", cookie)).status, 401);
  });

  test("logout (optionalUser) dengan sesi dicabut: 204 tanpa galat, cookie dihapus; baris tamu tidak ikut terhapus", async () => {
    const u = await newUser();
    await bump(u.id);
    const res = await post("/auth/logout", {}, u.cookie);
    assert.equal(res.status, 204);
    assert.ok(clearedCookie(res));

    const g = await post("/auth/guest", {});
    const gb = await g.json();
    ids.push(gb.user.id);
    await bump(gb.user.id);
    assert.equal((await post("/auth/logout", {}, cookieOf(g))).status, 204);
    assert.ok(await prisma.user.findUnique({ where: { id: gb.user.id } }));
  });

  test("pembaruan otomatis mempertahankan sv dari DB (end-to-end)", async () => {
    const u = await newUser();
    await bump(u.id);
    await bump(u.id); // DB = 2
    const now = Math.floor(Date.now() / 1000);
    const tua = await legacyToken(u.id, { sv: 2 }, now - 5 * 86400, now + 2 * 86400);
    const res = await get("/auth/me", `agro_session=${tua}`);
    assert.equal(res.status, 200);
    const renewed = cookieOf(res);
    assert.ok(renewed, "token harus diperbarui");
    assert.equal(claims(renewed).sv, 2);
    assert.equal((await get("/auth/me", renewed)).status, 200);
  });
});
