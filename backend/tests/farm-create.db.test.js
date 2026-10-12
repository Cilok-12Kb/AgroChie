import "dotenv/config";
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { assertTestDatabase } from "./helpers/test-db.js";

let skip = false;
try {
  assertTestDatabase();
} catch (e) {
  skip = e.message;
}

describe("POST /farms (butuh database uji)", { skip }, () => {
  let server, base, prisma, user;
  const phone = "0897" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
  const farmIds = [];

  const call = (body, cookie) =>
    fetch(base + "/farms", {
      method: "POST",
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: JSON.stringify(body),
    });

  before(async () => {
    assertTestDatabase();
    const { app } = await import("../src/app.js");
    ({ prisma } = await import("../src/config/prisma.js"));
    await new Promise((r) => (server = app.listen(0, r)));
    base = `http://127.0.0.1:${server.address().port}/api`;
    const res = await fetch(base + "/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "Uji Buat Lahan", phone, password: "rahasia123" }),
    });
    const body = await res.json();
    user = { id: body.id, cookie: (res.headers.getSetCookie()[0] ?? "").split(";")[0] };
  });

  after(async () => {
    if (prisma) {
      if (farmIds.length) await prisma.farm.deleteMany({ where: { id: { in: farmIds } } });
      await prisma.user.deleteMany({ where: { phone } });
      await prisma.$disconnect();
    }
    server?.close();
  });

  test("tanpa sesi -> 401", async () => {
    assert.equal((await call({ name: "X", areaHa: 1 })).status, 401);
  });

  test("201 memuat kelengkapan dan rentang_latih; userId dari sesi; Decimal tersimpan", async () => {
    const res = await call(
      { name: "Lahan Baru", areaHa: 4, ph: 3.5, phMeasuredOn: "2026-03-01", capitalJt: 12.5, sellPricePerKg: 30000, profitTargetJt: 5 },
      user.cookie,
    );
    assert.equal(res.status, 201);
    const body = await res.json();
    farmIds.push(body.id);
    assert.equal(body.userId, user.id);
    assert.ok(body.kelengkapan && typeof body.kelengkapan.percent === "number");
    assert.deepEqual(body.rentang_latih, { di_luar_rentang_latih: true, alasan: ["luas", "ph"] });
    const row = await prisma.farm.findUnique({ where: { id: body.id } });
    assert.equal(row.userId, user.id);
    assert.equal(row.capitalJt.toString(), "12.5");
    assert.equal(row.sellPricePerKg.toString(), "30000");
    assert.equal(row.profitTargetJt.toString(), "5");
    assert.equal(row.ph.toString(), "3.5");
  });

  test("userId/id di body ditolak 400 dan tidak ada lahan dibuat", async () => {
    const before = await prisma.farm.count({ where: { userId: user.id } });
    assert.equal((await call({ name: "X", areaHa: 1, userId: "orang-lain" }, user.cookie)).status, 400);
    assert.equal((await call({ name: "X", areaHa: 1, id: "paksa" }, user.cookie)).status, 400);
    assert.equal(await prisma.farm.count({ where: { userId: user.id } }), before);
  });

  test("luas hilang atau koordinat tertukar -> 400", async () => {
    assert.equal((await call({ name: "X" }, user.cookie)).status, 400);
    assert.equal((await call({ name: "X", areaHa: 1, latitude: 107, longitude: -6 }, user.cookie)).status, 400);
  });
});
