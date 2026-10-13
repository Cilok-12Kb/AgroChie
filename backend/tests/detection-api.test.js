import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { Prisma } from "@prisma/client";
import { createPlantDetectionService, ALREADY_MESSAGE, NO_SEASON_MESSAGE } from "../src/services/plant-detection.service.js";
import { createDetectionService } from "../src/services/detection/index.js";
import { LlmError } from "../src/services/llm.service.js";
import { errorHandler } from "../src/middleware/error-handler.js";
import { parseDetectionList } from "../src/validators/detection.validator.js";
import { makeFakeDb } from "./helpers/fake-detection-db.js";

const silent = () => { const o = console.error; console.error = () => {}; return () => { console.error = o; }; };
const JPG = Buffer.concat([Buffer.from("ffd8ffe000104a46494600010100", "hex"), Buffer.alloc(64, 1)]);
const file = (buffer = JPG) => ({ buffer, size: buffer.length, mimetype: "image/jpeg" });

const detOk = {
  tanaman_terlihat: true, kondisi: "Daun cabai bercak", kategori_kualitas: "sedang", skor_kepercayaan: 0.8,
  masalah_terdeteksi: [{ nama: "Bercak daun", jenis: "penyakit", tingkat_keparahan: "ringan", gejala_terlihat: "bercak cokelat" }],
};
const solusi = (min = 150_000, max = 250_000) => ({
  ringkasan: "r", kemungkinan_penyebab: [], langkah_penanganan: [{ urutan: 1, langkah: "x", prioritas: "segera" }],
  bahan_dan_alat: [{ nama: "Fungisida berbahan aktif tembaga", dosis_atau_jumlah: "ikuti label", estimasi_biaya_min: min, estimasi_biaya_max: max }],
  estimasi_total_biaya: { min, max, per_hektar_atau_per_lahan: "per lahan", asumsi: ["a"] },
  risiko_jika_tidak_ditangani: "r", pencegahan: [], kapan_konsultasi_ahli: "k", catatan_estimasi: "d", cuaca_tersedia: false,
  kategori_expense: "OBAT", sumber_rag: [],
});

const ACTIVE = { id: "s1", farmId: "f1", crop: "CABAI", areaHa: new Prisma.Decimal(1), status: "TANAM", plantedOn: new Date("2026-09-01") };

function setup({ seasons = [ACTIVE], out = detOk, solver, detectorError, minConfidence = 0.5 } = {}) {
  const farms = [{ id: "f1", userId: "u1", areaHa: new Prisma.Decimal(1), village: "Desa A", province: "Jawa Tengah" }, { id: "f2", userId: "u2" }];
  const db = makeFakeDb({ farms, seasons });
  const calls = { detect: 0, solve: 0, saved: [], removed: [], solveArgs: null };
  const provider = { name: "uji", detect: async () => { calls.detect++; if (detectorError) throw detectorError; return out; } };
  const svc = createPlantDetectionService({
    db,
    detector: createDetectionService({ provider, minConfidence }),
    solver: solver ?? { generate: async (a) => { calls.solve++; calls.solveArgs = a; return solusi(); } },
    storage: {
      save: async (_b, ext) => { const k = `foto-${calls.saved.length}.${ext}`; calls.saved.push(k); return k; },
      read: async () => JPG,
      remove: async (k) => { calls.removed.push(k); },
    },
    config: { detectionMaxBytes: 1024 },
    now: () => new Date("2026-10-13T03:00:00Z"),
  });
  return { db, svc, calls };
}
const make = (svc, over = {}) => svc.create({ userId: "u1", file: file(), lahanId: "f1", catatan: null, ...over });

describe("POST deteksi: alur, kepemilikan, dan konversi biaya", () => {
  test("SELESAI: simpan foto -> deteksi -> solusi -> simpan; Rupiah penuh menjadi juta Rupiah (Decimal)", async () => {
    const { svc, db, calls } = setup();
    const r = await make(svc, { catatan: "daun bercak" });
    assert.equal(r.status, "SELESAI");
    assert.equal(calls.detect, 1);
    assert.equal(calls.solve, 1);
    assert.equal(db.detections.length, 1);
    assert.ok(db.detections[0].costMinJt instanceof Prisma.Decimal);
    assert.equal(db.detections[0].costMinJt.toString(), "0.15"); // 150.000 Rp = 0,15 juta
    assert.equal(db.detections[0].costMaxJt.toString(), "0.25");
    assert.equal(r.foto_url, `/api/deteksi-tanaman/${r.id}/foto`);
    assert.equal(JSON.stringify(r).includes("photoKey"), false);
    assert.equal(r.ke_catatan.tersedia, true);
  });

  test("konteks lahan ke AI hanya berisi yang diketahui (tanpa tebakan)", async () => {
    const { svc, calls } = setup();
    await make(svc);
    assert.equal(calls.solveArgs.land.komoditas, "cabai");
    assert.equal(calls.solveArgs.land.lokasi, "Desa A, Jawa Tengah");
    assert.equal(calls.solveArgs.land.fase, "tanam");
    const none = setup({ seasons: [] });
    await make(none.svc);
    assert.equal(none.calls.solveArgs.land.komoditas, null);
    assert.equal(none.calls.solveArgs.land.fase, null);
  });

  test("lahan milik orang lain / tidak ada -> 404 tanpa menyimpan foto atau memanggil AI", async () => {
    const { svc, db, calls } = setup();
    for (const lahanId of ["f2", "tidak-ada"]) {
      await assert.rejects(make(svc, { lahanId }), (e) => e.status === 404 && /Lahan tidak ditemukan/.test(e.message));
    }
    assert.equal(calls.saved.length, 0);
    assert.equal(calls.detect, 0);
    assert.equal(db.detections.length, 0);
  });

  test("file tidak sah ditolak lebih dulu: bukan gambar 415, kosong 400, tanpa file 400, terlalu besar 413", async () => {
    const { svc, calls } = setup();
    const bad = [[file(Buffer.alloc(64, 7)), 415], [{ buffer: Buffer.alloc(0), size: 0 }, 400], [undefined, 400], [file(Buffer.concat([JPG, Buffer.alloc(2000)])), 413]];
    for (const [f, status] of bad) {
      await assert.rejects(make(svc, { file: f }), (e) => e.status === status);
    }
    assert.equal(calls.saved.length, 0);
  });
});

describe("status tidak yakin", () => {
  for (const [label, out, alasan] of [
    ["keyakinan rendah", { ...detOk, skor_kepercayaan: 0.2 }, "keyakinan_rendah"],
    ["bukan tanaman", { ...detOk, tanaman_terlihat: false }, "bukan_tanaman"],
  ]) {
    test(`${label}: minta foto lebih jelas, solutionService tidak dipanggil, tanpa biaya`, async () => {
      const { svc, db, calls } = setup({ out });
      const r = await make(svc);
      assert.equal(r.status, "TIDAK_YAKIN");
      assert.equal(r.alasan, alasan);
      assert.match(r.pesan, /foto/i);
      assert.equal(calls.solve, 0);
      assert.equal(r.solusi, null);
      assert.equal(r.biaya_jt, null);
      assert.equal(db.detections[0].costMinJt, null);
      assert.equal(r.ke_catatan.tersedia, false);
      await assert.rejects(svc.toNote({ userId: "u1", id: r.id }), (e) => e.status === 409);
    });
  }
});

describe("galat AI: pesan Indonesia, tanpa hasil simulasi, foto dibersihkan", () => {
  const cases = [
    ["kuota habis", new LlmError(503, "LLM_QUOTA", "Kuota layanan AI sedang habis atau penuh. Coba lagi nanti."), 503, /Kuota/],
    ["timeout", new LlmError(504, "LLM_TIMEOUT", "Analisis AI melewati batas waktu. Coba lagi sebentar lagi."), 504, /batas waktu/],
  ];
  for (const [label, err, status, re] of cases) {
    test(label, async () => {
      const { svc, db, calls } = setup({ detectorError: err });
      const restore = silent();
      try {
        await assert.rejects(make(svc), (e) => e.status === status && re.test(e.message));
      } finally { restore(); }
      assert.equal(db.detections.length, 0);
      assert.deepEqual(calls.removed, calls.saved);
    });
  }

  test("solusi gagal setelah deteksi -> galat diteruskan, tidak ada baris tersimpan", async () => {
    const solver = { generate: async () => { throw new LlmError(503, "LLM_QUOTA", "Kuota layanan AI sedang habis atau penuh. Coba lagi nanti."); } };
    const { svc, db, calls } = setup({ solver });
    await assert.rejects(make(svc), (e) => e.status === 503);
    assert.equal(db.detections.length, 0);
    assert.equal(calls.removed.length, 1);
  });

  test("errorHandler menjawab { error } dengan status dan pesan Indonesia", () => {
    const res = { status(s) { this.s = s; return this; }, json(b) { this.b = b; } };
    const restore = silent();
    try {
      errorHandler(new LlmError(504, "LLM_TIMEOUT", "Analisis AI melewati batas waktu. Coba lagi sebentar lagi."), {}, res, () => {});
    } finally { restore(); }
    assert.equal(res.s, 504);
    assert.match(res.b.error, /batas waktu/);
  });
});

describe("riwayat dan detail", () => {
  test("riwayat per lahan: terbaru dulu, pagination, hanya milik pengguna", async () => {
    const { svc } = setup();
    const ids = [];
    for (let i = 0; i < 3; i++) ids.push((await make(svc)).id);
    const p1 = await svc.list({ userId: "u1", lahanId: "f1", page: 1, limit: 2 });
    assert.deepEqual(p1.data.map((d) => d.id), [ids[2], ids[1]]);
    assert.equal(p1.total, 3);
    assert.equal(p1.total_halaman, 2);
    const p2 = await svc.list({ userId: "u1", lahanId: "f1", page: 2, limit: 2 });
    assert.deepEqual(p2.data.map((d) => d.id), [ids[0]]);
    await assert.rejects(svc.list({ userId: "u2", lahanId: "f1" }), (e) => e.status === 404);
  });

  test("detail dan foto: pemilik boleh, orang lain 404", async () => {
    const { svc } = setup();
    const r = await make(svc);
    assert.equal((await svc.get({ userId: "u1", id: r.id })).id, r.id);
    const ph = await svc.photo({ userId: "u1", id: r.id });
    assert.equal(ph.mime, "image/jpeg");
    assert.ok(Buffer.isBuffer(ph.buffer));
    await assert.rejects(svc.get({ userId: "u2", id: r.id }), (e) => e.status === 404);
    await assert.rejects(svc.photo({ userId: "u2", id: r.id }), (e) => e.status === 404);
    await assert.rejects(svc.get({ userId: "u1", id: "tidak-ada" }), (e) => e.status === 404);
  });

  test("parseDetectionList: lahan_id wajib, page/limit dibatasi", () => {
    assert.deepEqual(parseDetectionList({ lahan_id: "abc" }), { lahanId: "abc", page: 1, limit: 10 });
    assert.equal(parseDetectionList({ lahan_id: "abc", page: "3", limit: "50" }).limit, 50);
    for (const bad of [{}, { lahan_id: "../x" }, { lahan_id: "a", page: "0" }, { lahan_id: "a", limit: "51" }, { lahan_id: "a", page: "x" }, { lahan_id: ["a"] }]) {
      assert.throws(() => parseDetectionList(bad), (e) => e.status === 400);
    }
  });
});


describe("ke-catatan: Expense pada musim aktif", () => {
  test("membuat Expense: kategori dari jenis bahan, nilai tengah rentang (juta Rupiah, Decimal)", async () => {
    const { svc, db } = setup();
    const r = await make(svc);
    const out = await svc.toNote({ userId: "u1", id: r.id });
    assert.equal(db.expenses.length, 1);
    assert.equal(out.kategori, "OBAT");
    assert.equal(out.jumlah_jt.toString(), "0.2");
    assert.ok(db.expenses[0].amountJt instanceof Prisma.Decimal);
    assert.equal(db.expenses[0].seasonId, "s1");
    assert.equal(db.detections[0].expenseId, out.expense_id);
  });

  test("tanpa musim aktif -> 409 berpesan jelas; tombol nonaktif dengan alasan", async () => {
    const { svc, db } = setup({ seasons: [{ id: "s0", farmId: "f1", crop: "CABAI", status: "SELESAI" }] });
    const r = await make(svc);
    assert.equal(r.ke_catatan.tersedia, false);
    assert.equal(r.ke_catatan.alasan, NO_SEASON_MESSAGE);
    await assert.rejects(svc.toNote({ userId: "u1", id: r.id }), (e) => e.status === 409 && e.message === NO_SEASON_MESSAGE);
    assert.equal(db.expenses.length, 0);
  });

  test("tidak bisa dikirim dua kali (409), hanya satu Expense", async () => {
    const { svc, db } = setup();
    const r = await make(svc);
    await svc.toNote({ userId: "u1", id: r.id });
    await assert.rejects(svc.toNote({ userId: "u1", id: r.id }), (e) => e.status === 409 && e.message === ALREADY_MESSAGE);
    assert.equal(db.expenses.length, 1);
    const view = await svc.get({ userId: "u1", id: r.id });
    assert.equal(view.ke_catatan.sudah_disimpan, true);
    assert.equal(view.ke_catatan.tersedia, false);
  });

  test("balapan: klaim yang kalah membatalkan Expense", async () => {
    const { svc, db } = setup();
    const r = await make(svc);
    db.plantDetection.updateMany = async () => ({ count: 0 });
    await assert.rejects(svc.toNote({ userId: "u1", id: r.id }), (e) => e.status === 409);
    assert.equal(db.expenses.length, 0);
  });

  test("milik orang lain -> 404", async () => {
    const { svc } = setup();
    const r = await make(svc);
    await assert.rejects(svc.toNote({ userId: "u2", id: r.id }), (e) => e.status === 404);
  });
});

