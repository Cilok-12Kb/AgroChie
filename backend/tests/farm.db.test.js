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

describe("GET/PATCH /farms/:id (butuh database uji)", { skip }, () => {
  let server, base, prisma;
  const rand = () => "0898" + String(Math.floor(Math.random() * 1e8)).padStart(8, "0");
  const phones = [rand(), rand()];
  const users = []; // { id, cookie }
  let farmA;

  const call = (method, path, body, cookie) =>
    fetch(base + path, {
      method,
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  before(async () => {
    assertTestDatabase();
    const { app } = await import("../src/app.js");
    ({ prisma } = await import("../src/config/prisma.js"));
    await new Promise((r) => (server = app.listen(0, r)));
    base = `http://127.0.0.1:${server.address().port}/api`;
    for (const phone of phones) {
      const res = await call("POST", "/auth/register", { name: "Uji Lahan", phone, password: "rahasia123" });
      const body = await res.json();
      users.push({ id: body.id, cookie: (res.headers.getSetCookie()[0] ?? "").split(";")[0] });
    }
    farmA = await prisma.farm.create({
      data: { userId: users[0].id, name: "Lahan A", areaHa: "1.5", village: "Desa Awal", province: "Jawa Barat", nitrogen: "SEDANG" },
    });
  });

  after(async () => {
    if (prisma) {
      if (farmA) await prisma.farm.deleteMany({ where: { id: farmA.id } });
      await prisma.user.deleteMany({ where: { phone: { in: phones } } });
      await prisma.$disconnect();
    }
    server?.close();
  });

  test("tanpa sesi -> 401", async () => {
    assert.equal((await call("GET", `/farms/${farmA.id}`)).status, 401);
    assert.equal((await call("PATCH", `/farms/${farmA.id}`, { village: "x" })).status, 401);
  });

  test("pemilik GET -> 200", async () => {
    const res = await call("GET", `/farms/${farmA.id}`, undefined, users[0].cookie);
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.id, farmA.id);
    assert.equal(body.village, "Desa Awal");
  });
  test("GET memuat kelengkapan dan rentang_latih (dihitung saat dibaca)", async () => {
    const body = await (await call("GET", `/farms/${farmA.id}`, undefined, users[0].cookie)).json();
    assert.equal(body.kelengkapan.percent, 25); // village, province, nitrogen = 3 dari 12
    assert.deepEqual(body.kelengkapan.missing, [
      "subdistrict", "soilType", "waterSource", "ph", "phosphorus", "potassium", "lokasi", "capitalJt", "sellPricePerKg",
    ]);
    assert.deepEqual(body.rentang_latih, { di_luar_rentang_latih: false, alasan: [] });
  });

  test("PATCH memuat kelengkapan dan rentang_latih terbaru; tidak disimpan di database", async () => {
    const farmB = await prisma.farm.create({ data: { userId: users[0].id, name: "Lahan B", areaHa: "1" } });
    try {
      const res = await call(
        "PATCH",
        `/farms/${farmB.id}`,
        { areaHa: 4, ph: 3.5, phMeasuredOn: "2026-03-01", latitude: -6.9, longitude: 107.6 },
        users[0].cookie,
      );
      assert.equal(res.status, 200);
      const body = await res.json();
      assert.deepEqual(body.kelengkapan.missing.includes("ph") || body.kelengkapan.missing.includes("lokasi"), false);
      assert.equal(body.kelengkapan.percent, 17); // ph + lokasi = 2 dari 12
      assert.deepEqual(body.rentang_latih, { di_luar_rentang_latih: true, alasan: ["luas", "ph"] });
      const row = await prisma.farm.findUnique({ where: { id: farmB.id } });
      assert.equal("kelengkapan" in row || "rentang_latih" in row, false);
    } finally {
      await prisma.farm.deleteMany({ where: { id: farmB.id } });
    }
  });



  test("milik orang lain -> 404 untuk GET dan PATCH, data tidak berubah; id tak ada -> 404", async () => {
    assert.equal((await call("GET", `/farms/${farmA.id}`, undefined, users[1].cookie)).status, 404);
    assert.equal((await call("PATCH", `/farms/${farmA.id}`, { village: "Dibajak" }, users[1].cookie)).status, 404);
    assert.equal((await call("GET", "/farms/tidak-ada", undefined, users[0].cookie)).status, 404);
    const row = await prisma.farm.findUnique({ where: { id: farmA.id } });
    assert.equal(row.village, "Desa Awal");
  });

  test("PATCH parsial: hanya kolom yang dikirim berubah; Decimal tersimpan akurat", async () => {
    const before = await prisma.farm.findUnique({ where: { id: farmA.id } });
    const res = await call(
      "PATCH",
      `/farms/${farmA.id}`,
      { ph: 6.5, phMeasuredOn: "2026-03-01", capitalJt: 12.5, sellPricePerKg: 30000 },
      users[0].cookie,
    );
    assert.equal(res.status, 200);
    const after = await prisma.farm.findUnique({ where: { id: farmA.id } });
    assert.equal(after.ph.toString(), "6.5");
    assert.equal(after.phMeasuredOn.toISOString().slice(0, 10), "2026-03-01");
    assert.equal(after.capitalJt.toString(), "12.5");
    assert.equal(after.sellPricePerKg.toString(), "30000");
    for (const k of ["name", "village", "province", "nitrogen", "areaHa", "userId", "soilType", "latitude", "profitTargetJt"]) {
      assert.equal(String(after[k]), String(before[k]), `kolom ${k} berubah`);
    }
  });

  // [REVISI] kolom country: default "ID", PATCH negara dan provinsi teks bebas
  test("country default ID; PATCH country + provinsi bebas tersimpan; country salah ditolak", async () => {
    const before = await prisma.farm.findUnique({ where: { id: farmA.id } });
    assert.equal(before.country, "ID");
    const res = await call("PATCH", `/farms/${farmA.id}`, { country: "my", province: "Selangor" }, users[0].cookie);
    assert.equal(res.status, 200);
    const after = await prisma.farm.findUnique({ where: { id: farmA.id } });
    assert.equal(after.country, "MY");
    assert.equal(after.province, "Selangor");
    assert.equal((await call("PATCH", `/farms/${farmA.id}`, { country: "IDN" }, users[0].cookie)).status, 400);
    await prisma.farm.update({ where: { id: farmA.id }, data: { country: "ID", province: "Jawa Barat" } });
  });

  test("isian dikosongkan dengan null", async () => {
    const res = await call("PATCH", `/farms/${farmA.id}`, { village: null, nitrogen: null }, users[0].cookie);
    assert.equal(res.status, 200);
    const row = await prisma.farm.findUnique({ where: { id: farmA.id } });
    assert.equal(row.village, null);
    assert.equal(row.nitrogen, null);
    assert.equal(row.province, "Jawa Barat");
  });

  test("userId dan id tidak bisa diubah lewat body (ditolak 400, tidak ditulis)", async () => {
    const r1 = await call("PATCH", `/farms/${farmA.id}`, { userId: users[1].id, village: "X" }, users[0].cookie);
    assert.equal(r1.status, 400);
    const r2 = await call("PATCH", `/farms/${farmA.id}`, { id: "lain" }, users[0].cookie);
    assert.equal(r2.status, 400);
    const row = await prisma.farm.findUnique({ where: { id: farmA.id } });
    assert.equal(row.userId, users[0].id);
    assert.notEqual(row.village, "X");
  });

  test("nilai tidak valid -> 400 dan data tidak berubah", async () => {
    const res = await call("PATCH", `/farms/${farmA.id}`, { areaHa: 9 }, users[0].cookie);
    assert.equal(res.status, 400);
    const row = await prisma.farm.findUnique({ where: { id: farmA.id } });
    assert.equal(row.areaHa.toString(), "1.5");
  });
});
