import "dotenv/config";
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { assertTestDatabase } from "./helpers/test-db.js";

// Tes ini membuat dan menghapus data. Hanya jalan di database ber-nama "_test";
// selain itu dilewati (bukan dianggap lulus palsu).
let skip = false;
try {
  assertTestDatabase();
} catch (e) {
  skip = e.message;
}

describe("auth (butuh database uji)", { skip }, () => {
  let server, base, prisma;
  const made = [];
  const rand = () => "0899" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
  const phone = rand();
  const password = "rahasia123";

  const post = (path, body, cookie) =>
    fetch(base + path, {
      method: "POST",
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body ?? {}),
    });
  const cookieOf = (res) => (res.headers.getSetCookie()[0] ?? "").split(";")[0];

  before(async () => {
    assertTestDatabase(); // jaga-jaga sebelum menyentuh DB
    const { app } = await import("../src/app.js");
    ({ prisma } = await import("../src/config/prisma.js"));
    await new Promise((r) => (server = app.listen(0, r)));
    base = `http://127.0.0.1:${server.address().port}/api`;
    made.push(phone);
  });

  after(async () => {
    if (prisma) {
      await prisma.user.deleteMany({ where: { phone: { in: made } } });
      await prisma.$disconnect();
    }
    server?.close();
  });

  test("register: 201, sesi dibuat, role selalu PETANI, tanpa passwordHash", async () => {
    const res = await post("/auth/register", { name: "Budi", phone: `${phone.slice(0, 4)}-${phone.slice(4)}`, password, role: "PETUGAS_BANK" });
    assert.equal(res.status, 201);
    const body = await res.json();
    assert.equal(body.role, "PETANI");
    assert.equal(body.isGuest, false);
    assert.equal(body.phone, phone);
    assert.ok(!("passwordHash" in body) && !JSON.stringify(body).includes(password));
    const set = res.headers.getSetCookie()[0];
    assert.match(set, /^agro_session=/);
    assert.match(set, /HttpOnly/i);
    const row = await prisma.user.findUnique({ where: { phone } });
    assert.notEqual(row.passwordHash, password);
  });

  test("register: HP kembar 409, sandi pendek 400", async () => {
    assert.equal((await post("/auth/register", { name: "B", phone, password })).status, 409);
    assert.equal((await post("/auth/register", { name: "B", phone: rand(), password: "pendek" })).status, 400);
  });

  test("login: benar -> 200 + cookie; sandi salah dan akun tak ada -> 401 dengan pesan sama", async () => {
    const good = await post("/auth/login", { phone, password });
    assert.equal(good.status, 200);
    assert.match(good.headers.getSetCookie()[0], /^agro_session=/);

    const wrong = await post("/auth/login", { phone, password: "salah-total" });
    const none = await post("/auth/login", { phone: rand(), password });
    assert.equal(wrong.status, 401);
    assert.equal(none.status, 401);
    assert.deepEqual(await wrong.json(), await none.json());
    assert.equal(wrong.headers.getSetCookie().length, 0);
  });

  test("me: tanpa sesi 401; dengan sesi 200 tanpa passwordHash", async () => {
    assert.equal((await fetch(base + "/auth/me")).status, 401);
    const cookie = cookieOf(await post("/auth/login", { phone, password }));
    const res = await fetch(base + "/auth/me", { headers: { cookie } });
    assert.equal(res.status, 200);
    const me = await res.json();
    assert.equal(me.phone, phone);
    assert.equal(me.role, "PETANI");
    assert.ok(!("passwordHash" in me));
  });

  test("logout: 204 dan cookie dihapus", async () => {
    const cookie = cookieOf(await post("/auth/login", { phone, password }));
    const res = await post("/auth/logout", {}, cookie);
    assert.equal(res.status, 204);
    const set = res.headers.getSetCookie()[0];
    assert.match(set, /^agro_session=;/);
    assert.match(set, /Expires=Thu, 01 Jan 1970/i);
  });
});
