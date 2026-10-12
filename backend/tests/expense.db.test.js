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
process.env.ENGINE_INTERNAL_KEY = "kunci-uji"; // engine tidak dipanggil di tes ini

describe("Catatan pengeluaran (butuh database uji)", { skip }, () => {
  let server, base, prisma, todayWib;
  const tag = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  const users = {};
  const farmIds = [];
  const FARM = { areaHa: 1, soilType: "Lempung", waterSource: "Irigasi teknis", province: "Jawa Tengah", ph: 6, phMeasuredOn: "2026-03-01",
    nitrogen: "SEDANG", phosphorus: "SEDANG", potassium: "TINGGI" };
  const iso = (d) => new Date(d).toISOString().slice(0, 10);
  const ago = (n) => new Date(todayWib().getTime() - n * 86_400_000);

  const api = (method, path, cookie, body) =>
    fetch(base + path, {
      method,
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const register = async (key, digit) => {
    const phone = `0898${digit}${tag}`;
    const res = await api("POST", "/auth/register", null, { name: "Uji Biaya " + key, phone, password: "rahasia123" });
    const b = await res.json();
    users[key] = { id: b.id, phone, cookie: (res.headers.getSetCookie()[0] ?? "").split(";")[0] };
  };
  // opts: status, plantedDaysAgo, weekly (array -> CostPlan)
  const mkSeason = async ({ status = "TANAM", plantedDaysAgo = 0, weekly } = {}) => {
    const farm = await (await api("POST", "/farms", users.a.cookie, { name: "F", ...FARM })).json();
    farmIds.push(farm.id);
    const s = await (await api("POST", `/farms/${farm.id}/seasons`, users.a.cookie, { crop: "CABAI" })).json();
    await prisma.season.update({
      where: { id: s.id },
      data: { status, ...(plantedDaysAgo === null ? {} : { plantedOn: ago(plantedDaysAgo) }) },
    });
    if (weekly) {
      await prisma.costPlan.create({
        data: { seasonId: s.id, totalJt: 100, p10Jt: 90, p50Jt: 100, p90Jt: 110, weeklyJt: weekly, modelVersion: "uji" },
      });
    }
    return s;
  };
  const add = (id, body, cookie = users.a.cookie) => api("POST", `/seasons/${id}/expenses`, cookie, body);
  const summary = async (id, cookie = users.a.cookie) => (await api("GET", `/seasons/${id}/expenses/summary`, cookie)).json();
  const exp = (over = {}) => ({ category: "PUPUK", amountJt: "1.5", spentOn: iso(ago(1)), ...over });
  const cat = (sum, c) => sum.categories.find((x) => x.category === c);

  before(async () => {
    assertTestDatabase();
    const { app } = await import("../src/app.js");
    ({ prisma } = await import("../src/config/prisma.js"));
    ({ todayWib } = await import("../src/validators/season.validator.js"));
    await new Promise((r) => (server = app.listen(0, r)));
    base = `http://127.0.0.1:${server.address().port}/api`;
    await register("a", "1");
    await register("b", "2");
  });

  after(async () => {
    if (prisma) {
      if (farmIds.length) {
        const ids = (await prisma.season.findMany({ where: { farmId: { in: farmIds } }, select: { id: true } })).map((s) => s.id);
        if (ids.length) {
          await prisma.expense.deleteMany({ where: { seasonId: { in: ids } } });
          await prisma.costPlan.deleteMany({ where: { seasonId: { in: ids } } });
        }
        await prisma.season.deleteMany({ where: { farmId: { in: farmIds } } });
        await prisma.farm.deleteMany({ where: { id: { in: farmIds } } });
      }
      for (const u of Object.values(users)) await prisma.user.deleteMany({ where: { phone: u.phone } });
      await prisma.$disconnect();
    }
    server?.close();
  });

  test("tanpa sesi 401", async () => {
    assert.equal((await add("x", exp(), null)).status, 401);
    assert.equal((await api("GET", "/seasons/x/expenses", null)).status, 401);
    assert.equal((await api("GET", "/seasons/x/expenses/summary", null)).status, 401);
    assert.equal((await api("DELETE", "/seasons/x/expenses/y", null)).status, 401);
  });

  test("POST valid: 201, jumlah string Decimal; GET urut tanggal; status DRAFT juga boleh", async () => {
    const s = await mkSeason({ status: "DRAFT", plantedDaysAgo: null });
    const r = await add(s.id, exp({ amountJt: 2.125, spentOn: iso(ago(2)), note: "pupuk" }));
    assert.equal(r.status, 201);
    const b = await r.json();
    assert.equal(b.amountJt, "2.125");
    assert.equal(b.category, "PUPUK");
    assert.equal(b.simulated, false);
    await add(s.id, exp({ category: "BENIH", spentOn: iso(ago(5)) }));
    const list = await (await api("GET", `/seasons/${s.id}/expenses`, users.a.cookie)).json();
    assert.deepEqual(list.map((e) => e.category), ["BENIH", "PUPUK"]);
  });

  test("validasi 400 dan tidak ada yang tersimpan", async () => {
    const s = await mkSeason();
    const future = iso(new Date(todayWib().getTime() + 2 * 86_400_000));
    for (const body of [
      exp({ category: "X" }), exp({ amountJt: 0 }), exp({ amountJt: -2 }), exp({ amountJt: "1.2345" }),
      exp({ spentOn: future }), exp({ spentOn: "2026-02-31" }), { ...exp(), foo: 1 }, { ...exp(), simulated: true },
    ]) {
      assert.equal((await add(s.id, body)).status, 400, JSON.stringify(body));
    }
    assert.equal(await prisma.expense.count({ where: { seasonId: s.id } }), 0);
  });

  test("SELESAI: tambah dan hapus 409", async () => {
    const s = await mkSeason();
    const e = await (await add(s.id, exp())).json();
    await prisma.season.update({ where: { id: s.id }, data: { status: "SELESAI" } });
    assert.equal((await add(s.id, exp())).status, 409);
    assert.equal((await api("DELETE", `/seasons/${s.id}/expenses/${e.id}`, users.a.cookie)).status, 409);
    assert.equal(await prisma.expense.count({ where: { seasonId: s.id } }), 1);
  });

  test("DELETE hanya milik Season itu; Season lain atau id tak ada 404", async () => {
    const s1 = await mkSeason();
    const s2 = await mkSeason();
    const e1 = await (await add(s1.id, exp())).json();
    assert.equal((await api("DELETE", `/seasons/${s2.id}/expenses/${e1.id}`, users.a.cookie)).status, 404);
    assert.equal((await api("DELETE", `/seasons/${s1.id}/expenses/tidak-ada`, users.a.cookie)).status, 404);
    assert.equal(await prisma.expense.count({ where: { seasonId: s1.id } }), 1);
    assert.equal((await api("DELETE", `/seasons/${s1.id}/expenses/${e1.id}`, users.b.cookie)).status, 404);
    assert.equal((await api("DELETE", `/seasons/${s1.id}/expenses/${e1.id}`, users.a.cookie)).status, 200);
    assert.equal(await prisma.expense.count({ where: { seasonId: s1.id } }), 0);
  });

  test("milik orang lain 404 untuk tambah, daftar, ringkasan", async () => {
    const s = await mkSeason();
    assert.equal((await add(s.id, exp(), users.b.cookie)).status, 404);
    assert.equal((await api("GET", `/seasons/${s.id}/expenses`, users.b.cookie)).status, 404);
    assert.equal((await api("GET", `/seasons/${s.id}/expenses/summary`, users.b.cookie)).status, 404);
    assert.equal(await prisma.expense.count({ where: { seasonId: s.id } }), 0);
  });


  test("ringkasan: rencana null sebelum TANAM atau tanpa CostPlan; kenyataan tetap dihitung", async () => {
    const s = await mkSeason({ status: "PEMBIAYAAN", plantedDaysAgo: null, weekly: new Array(16).fill(100) });
    await add(s.id, exp({ category: "BENIH", amountJt: "2" }));
    const a = await summary(s.id);
    assert.equal(a.currentWeek, null);
    assert.equal(a.total.planJt, null);
    assert.equal(cat(a, "BENIH").planJt, null);
    assert.equal(cat(a, "BENIH").warning, false);
    assert.equal(cat(a, "BENIH").actualJt, "2");
    const noPlan = await mkSeason();
    const b = await summary(noPlan.id);
    assert.equal(b.currentWeek, 1);
    assert.equal(b.total.planJt, null);
  });

  test("ringkasan: rencana = kumulatif mingguan x catFrac; simulasi diabaikan", async () => {
    const s = await mkSeason({ plantedDaysAgo: 15, weekly: new Array(16).fill(100) }); // minggu 3 -> kumulatif 300
    await add(s.id, exp({ category: "BENIH", amountJt: "10" }));
    await prisma.expense.create({ data: { seasonId: s.id, category: "BENIH", amountJt: "500", spentOn: ago(1), simulated: true } });
    const r = await summary(s.id);
    assert.equal(r.currentWeek, 3);
    assert.equal(cat(r, "BENIH").planJt, "54.9"); // 300 x 0.183
    assert.equal(cat(r, "PUPUK").planJt, "92.7"); // 300 x 0.309
    assert.equal(cat(r, "BENIH").actualJt, "10");
    assert.equal(r.total.actualJt, "10");
    assert.equal(r.total.planJt, "300");
    assert.equal(cat(r, "BENIH").warning, false);
  });

  test("ambang 15 persen: tepat 15 tidak, di atasnya ya (kategori dan total)", async () => {
    // minggu 1, kumulatif 100 -> rencana BENIH 18.3; 115% = 21.045
    const s = await mkSeason({ plantedDaysAgo: 0, weekly: new Array(16).fill(100) });
    await add(s.id, exp({ category: "BENIH", amountJt: "21.045" }));
    let r = await summary(s.id);
    assert.equal(cat(r, "BENIH").warning, false);
    await add(s.id, exp({ category: "BENIH", amountJt: "0.001" }));
    r = await summary(s.id);
    assert.equal(cat(r, "BENIH").actualJt, "21.046");
    assert.equal(cat(r, "BENIH").warning, true);
    assert.equal(cat(r, "PUPUK").warning, false);
    assert.equal(r.total.warning, false); // 21.046 jauh di bawah 115
    await add(s.id, exp({ category: "LAIN", amountJt: "100" }));
    r = await summary(s.id);
    assert.equal(r.total.warning, true); // 121.046 > 115
  });

  test("jepit minggu: tanam sangat lama -> minggu durasi-1 (15)", async () => {
    const s = await mkSeason({ plantedDaysAgo: 300, weekly: new Array(16).fill(1) });
    const r = await summary(s.id);
    assert.equal(r.currentWeek, 15);
    assert.equal(r.total.planJt, "15");
  });
});

