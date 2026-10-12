import "dotenv/config";
import { createHash } from "node:crypto";
import { describe, test, before, after } from "node:test";
import assert from "node:assert/strict";
import { assertTestDatabase } from "./helpers/test-db.js";

let skip = false;
try {
  assertTestDatabase();
} catch (e) {
  skip = e.message;
}
process.env.ENGINE_INTERNAL_KEY = "kunci-uji";

describe("Foto sampel dan tutup musim (butuh database uji)", { skip }, () => {
  let server, base, prisma, todayWib, n = 0;
  const tag = String(Math.floor(Math.random() * 1e7)).padStart(7, "0");
  const users = {};
  const farmIds = [];
  const FARM = { areaHa: 1, soilType: "Lempung", waterSource: "Irigasi teknis", province: "Jawa Tengah", ph: 6, phMeasuredOn: "2026-03-01",
    nitrogen: "SEDANG", phosphorus: "SEDANG", potassium: "TINGGI" };
  const FULL = { rainAvgMm: "92.5", heavyRainWks: 2, tempMaxAvg: "31.2", fertIndex: "100", wageIndex: "100", pestIndex: "100" };
  const ago = (d) => new Date(todayWib().getTime() - d * 86_400_000);
  const sha = () => createHash("sha256").update(`${tag}-${++n}`).digest("hex");

  const api = (method, path, cookie, body) =>
    fetch(base + path, {
      method,
      headers: { "content-type": "application/json", ...(cookie ? { cookie } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  const register = async (key, digit) => {
    const phone = `0898${digit}${tag}`;
    const res = await api("POST", "/auth/register", null, { name: "Uji Tutup " + key, phone, password: "rahasia123" });
    const b = await res.json();
    users[key] = { id: b.id, phone, cookie: (res.headers.getSetCookie()[0] ?? "").split(";")[0] };
  };
  const mkSeason = async (status = "PANEN", crop = "CABAI") => {
    const farm = await (await api("POST", "/farms", users.a.cookie, { name: "F", ...FARM })).json();
    farmIds.push(farm.id);
    const s = await (await api("POST", `/farms/${farm.id}/seasons`, users.a.cookie, { crop })).json();
    await prisma.season.update({ where: { id: s.id }, data: { status, plantedOn: ago(30) } });
    return s;
  };
  const addHv = (id, kg, price, day = 1) =>
    prisma.harvest.create({ data: { seasonId: id, harvestedOn: ago(day), grade: "A", weightKg: kg, pricePerKg: price } });
  const addSample = (id, kg = "10", m2 = "100") => prisma.harvestSample.create({ data: { seasonId: id, sampleKg: kg, sampleM2: m2 } });
  const photoBody = (over = {}) => ({ kind: "SAMPEL", objectKey: `sampel/${tag}/${n}.jpg`, sha256: sha(), takenAt: ago(1).toISOString(), ...over });
  const addPhoto = (id, over, cookie = users.a.cookie) => api("POST", `/seasons/${id}/photos`, cookie, photoBody(over));
  const close = (id, body, cookie = users.a.cookie) => api("POST", `/seasons/${id}/close`, cookie, body);
  const full = async () => { // musim PANEN lengkap: 1 panen, sampel, 1 foto
    const s = await mkSeason();
    await addHv(s.id, "1000", "20000");
    await addSample(s.id);
    assert.equal((await addPhoto(s.id)).status, 201);
    return s;
  };

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
          await prisma.photo.deleteMany({ where: { seasonId: { in: ids } } });
          await prisma.harvest.deleteMany({ where: { seasonId: { in: ids } } });
          await prisma.harvestSample.deleteMany({ where: { seasonId: { in: ids } } });
          await prisma.expense.deleteMany({ where: { seasonId: { in: ids } } });
          await prisma.seasonRecord.deleteMany({ where: { seasonId: { in: ids } } });
        }
        await prisma.season.deleteMany({ where: { farmId: { in: farmIds } } });
        await prisma.farm.deleteMany({ where: { id: { in: farmIds } } });
      }
      for (const u of Object.values(users)) await prisma.user.deleteMany({ where: { phone: u.phone } });
      await prisma.$disconnect();
    }
    server?.close();
  });

  const statusOf = async (id) => (await prisma.season.findUnique({ where: { id } })).status;
  const spend = (id, amt, day = 20, simulated = false) =>
    prisma.expense.create({ data: { seasonId: id, spentOn: ago(day), category: "PUPUK", amountJt: amt, simulated } });
  const text = async (r) => JSON.stringify(await r.json());

  // ---- Foto ----
  test("foto: tanpa sesi 401; milik orang lain 404; valid 201 dan daftar", async () => {
    const s = await mkSeason();
    assert.equal((await addPhoto(s.id, {}, null)).status, 401);
    assert.equal((await addPhoto(s.id, {}, users.b.cookie)).status, 404);
    assert.equal((await api("GET", `/seasons/${s.id}/photos`, users.b.cookie)).status, 404);
    const r = await addPhoto(s.id, { latitude: "-7.5", longitude: "110.25" });
    assert.equal(r.status, 201);
    const list = await (await api("GET", `/seasons/${s.id}/photos`, users.a.cookie)).json();
    assert.equal(list.length, 1);
    assert.equal(list[0].latitude, "-7.5");
  });

  test("foto: sha256 duplikat (global) 409; ke-7 409; SELESAI 409; body salah 400", async () => {
    const s = await mkSeason();
    const dup = sha();
    assert.equal((await addPhoto(s.id, { sha256: dup })).status, 201);
    assert.equal((await addPhoto(s.id, { sha256: dup })).status, 409);
    const s2 = await mkSeason();
    assert.equal((await addPhoto(s2.id, { sha256: dup })).status, 409, "unik global lintas musim");
    for (let i = 0; i < 5; i++) assert.equal((await addPhoto(s.id)).status, 201);
    assert.equal((await addPhoto(s.id)).status, 409);
    assert.equal(await prisma.photo.count({ where: { seasonId: s.id } }), 6);
    const done = await mkSeason("SELESAI");
    assert.equal((await addPhoto(done.id)).status, 409);
    assert.equal((await addPhoto(s2.id, { sha256: "xyz" })).status, 400);
  });

  // ---- Tutup musim: validasi berurutan ----
  test("tutup: tanpa sesi 401, milik orang lain 404, id tak ada 404 (bukan 500)", async () => {
    const s = await full();
    assert.equal((await close(s.id, { totalCostJt: "10" }, null)).status, 401);
    assert.equal((await close(s.id, { totalCostJt: "10" }, users.b.cookie)).status, 404);
    assert.equal((await close("tidak-ada", { totalCostJt: "10" })).status, 404);
    assert.equal(await statusOf(s.id), "PANEN");
  });

  test("urutan validasi docs/03: panen, sampel, foto, total biaya", async () => {
    const s = await mkSeason();
    let r = await close(s.id, {});
    assert.equal(r.status, 400);
    assert.match(await text(r), /Tambahkan minimal satu hasil panen/);
    await addHv(s.id, "1000", "20000");
    r = await close(s.id, {});
    assert.equal(r.status, 400);
    assert.match(await text(r), /Isi berat dan luas petak sampel panen/);
    await addSample(s.id);
    r = await close(s.id, {});
    assert.equal(r.status, 400);
    assert.match(await text(r), /Tambahkan minimal satu foto bukti sampel panen/);
    await addPhoto(s.id);
    for (const body of [{}, { totalCostJt: 0 }, { totalCostJt: "" }]) {
      r = await close(s.id, body);
      assert.equal(r.status, 400);
      assert.match(await text(r), /Isi total biaya musim/);
    }
    assert.equal(await statusOf(s.id), "PANEN");
    assert.equal(await prisma.seasonRecord.count({ where: { seasonId: s.id } }), 0);
  });

  test("foto PROGRES tidak dihitung sebagai foto bukti sampel", async () => {
    const s = await mkSeason();
    await addHv(s.id, "1000", "20000");
    await addSample(s.id);
    await addPhoto(s.id, { kind: "PROGRES" });
    const r = await close(s.id, { totalCostJt: "10" });
    assert.equal(r.status, 400);
    assert.match(await text(r), /foto bukti sampel/);
  });

  test("status salah 409 (DRAFT, PEMBIAYAAN, TANAM, SELESAI); tutup dua kali 409 tanpa 500", async () => {
    for (const st of ["DRAFT", "PEMBIAYAAN", "TANAM", "SELESAI"]) {
      const s = await mkSeason(st);
      assert.equal((await close(s.id, { totalCostJt: "10" })).status, 409, st);
      assert.equal(await statusOf(s.id), st);
    }
    const s = await full();
    assert.equal((await close(s.id, { totalCostJt: "10" })).status, 200);
    assert.equal((await close(s.id, { totalCostJt: "10" })).status, 409);
    assert.equal(await prisma.seasonRecord.count({ where: { seasonId: s.id } }), 1);
  });

  test("tutup dua kali bersamaan: satu 200, satu 409, tidak ada 500", async () => {
    const s = await full();
    const rs = await Promise.all([close(s.id, { totalCostJt: "10" }), close(s.id, { totalCostJt: "10" })]);
    assert.deepEqual(rs.map((r) => r.status).sort(), [200, 409]);
    assert.equal(await prisma.seasonRecord.count({ where: { seasonId: s.id } }), 1);
  });


  test("hasil: untung/rugi Decimal, yieldKg, pricePerKg tertimbang, label, note, status, closedAt", async () => {
    const s = await mkSeason();
    await addHv(s.id, "600", "20000", 3); // 12 jt
    await addHv(s.id, "400", "30000", 1); // 12 jt -> 24 jt, 1000 kg, rata-rata 24000
    await addSample(s.id);
    await addPhoto(s.id);
    const r = await close(s.id, { totalCostJt: "10.5", closingNote: "catatan akhir" });
    assert.equal(r.status, 200);
    const b = await r.json();
    assert.equal(b.summary.totalHarvestKg, "1000");
    assert.equal(b.summary.revenueJt, "24");
    assert.equal(b.summary.profitJt, "13.5");
    assert.equal(b.summary.isProfit, true);
    assert.equal(b.summary.pricePerKg, "24000");
    assert.equal(b.record.yieldKg, "1000");
    assert.equal(b.record.pricePerKg, "24000");
    assert.equal(b.record.note, "catatan akhir");
    assert.equal(b.record.label, `Cabai merah ${ago(1).toISOString().slice(0, 10)}`);
    const row = await prisma.season.findUnique({ where: { id: s.id } });
    assert.equal(row.status, "SELESAI");
    assert.ok(row.closedAt);
    assert.equal(row.totalCostJt.toString(), "10.5");
  });

  test("rugi: biaya melebihi pendapatan -> profit negatif, isProfit false", async () => {
    const s = await full(); // pendapatan 20 jt
    const b = await (await close(s.id, { totalCostJt: "25" })).json();
    assert.equal(b.summary.profitJt, "-5");
    assert.equal(b.summary.isProfit, false);
  });

  test("peringatan 30 persen: selaras -> false tanpa pesan; selisih -> true dengan pesan", async () => {
    const ok = await full(); // 1000 kg vs perkiraan 1000
    const a = await (await close(ok.id, { totalCostJt: "10" })).json();
    assert.equal(a.summary.mismatchOver30, false);
    assert.equal(a.summary.mismatchWarning, null);
    const s = await mkSeason();
    await addHv(s.id, "2000", "20000");
    await addSample(s.id);
    await addPhoto(s.id);
    const b = await (await close(s.id, { totalCostJt: "10" })).json();
    assert.equal(b.summary.mismatchOver30, true);
    assert.match(b.summary.mismatchWarning, /Selisih besar/);
  });

  test("90-110 persen: 11 dari 12 dipakai -> biaya = jumlah catatan, SIAP_DILATIH, 16 minggu", async () => {
    const s = await full();
    await spend(s.id, "11", 20);
    await spend(s.id, "5", 10, true); // simulasi tidak dihitung
    const b = await (await close(s.id, { totalCostJt: "12", ...FULL })).json();
    assert.equal(b.summary.weeklyCostUsed, true);
    assert.equal(b.summary.totalCostJt, "11");
    assert.equal(b.record.quality, "SIAP_DILATIH");
    const weeks = await prisma.weeklyCost.findMany({ where: { recordId: b.record.id } });
    assert.equal(weeks.length, 16);
    assert.equal(weeks.reduce((x, w) => x + Number(w.costJt), 0), 11);
  });

  test("di luar 90-110 persen (10 dari 12): total apa adanya, TOTAL_SAJA, tanpa minggu", async () => {
    const s = await full();
    await spend(s.id, "10", 20);
    const b = await (await close(s.id, { totalCostJt: "12", ...FULL })).json();
    assert.equal(b.summary.weeklyCostUsed, false);
    assert.equal(b.summary.totalCostJt, "12");
    assert.equal(b.record.quality, "TOTAL_SAJA");
    assert.equal(await prisma.weeklyCost.count({ where: { recordId: b.record.id } }), 0);
  });

  test("batas persis: 13,2 dari 12 (110%) dipakai; 13,3 tidak", async () => {
    const a = await full();
    await spend(a.id, "13.2", 20);
    assert.equal((await (await close(a.id, { totalCostJt: "12" })).json()).summary.weeklyCostUsed, true);
    const b = await full();
    await spend(b.id, "13.3", 20);
    assert.equal((await (await close(b.id, { totalCostJt: "12" })).json()).summary.weeklyCostUsed, false);
  });

  test("isian dataset kurang -> BELUM_LENGKAP (tidak ditebak, tetap null)", async () => {
    const s = await full();
    await spend(s.id, "12", 20);
    const b = await (await close(s.id, { totalCostJt: "12" })).json();
    assert.equal(b.record.quality, "BELUM_LENGKAP");
    assert.equal(b.record.rainAvgMm, null);
    assert.equal(b.record.consentTraining, false);
  });
});

