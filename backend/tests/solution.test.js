import { test } from "node:test";
import assert from "node:assert/strict";
import { generateSolution, buildSolutionPrompt, solutionSchema, DISCLAIMER } from "../src/services/solution.service.js";

const silent = () => { const o = console.error; console.error = () => {}; return () => { console.error = o; }; };

const detOk = {
  kondisi: "Daun cabai bercak", kategori_kualitas: "sedang", skor_kepercayaan: 0.8,
  masalah_terdeteksi: [{ nama: "Bercak daun", jenis: "penyakit", tingkat_keparahan: "ringan", gejala_terlihat: "bercak cokelat" }],
};
const solOk = {
  ringkasan: "Bercak daun ringan.",
  kemungkinan_penyebab: ["Kelembapan tinggi"],
  langkah_penanganan: [
    { urutan: 2, langkah: "Perbaiki drainase", prioritas: "minggu_ini" },
    { urutan: 1, langkah: "Buang daun sakit", prioritas: "segera" },
  ],
  bahan_dan_alat: [
    { nama: "Fungisida berbahan aktif tembaga", dosis_atau_jumlah: "ikuti label", estimasi_biaya_min: 50000, estimasi_biaya_max: 90000 },
    { nama: "Sarung tangan", dosis_atau_jumlah: "1 pasang", estimasi_biaya_min: 10000, estimasi_biaya_max: 20000 },
  ],
  estimasi_total_biaya: { min: 1, max: 2, per_hektar_atau_per_lahan: "per lahan", asumsi: ["Harga pasar umum"] },
  risiko_jika_tidak_ditangani: "Menyebar.",
  pencegahan: ["Jaga jarak tanam"],
  kapan_konsultasi_ahli: "Bila meluas.",
};
const land = { komoditas: "cabai merah", luasHa: 0.5, lokasi: "Desa A, Jawa Barat", fase: "perawatan", mingguKe: 6 };

function fakeClient(replies) {
  const calls = [];
  return { calls, models: { async generateContent(args) { calls.push(args); return { text: replies.shift() }; } } };
}
const base = (client) => ({ client, retrieveFn: async () => [], weatherFn: async () => null });

test("solusi: total dihitung ulang server, langkah diurutkan, kategori Expense, disclaimer", async () => {
  const client = fakeClient([JSON.stringify(solOk)]);
  const r = await generateSolution(
    { detection: detOk, land, coords: { lat: -6.9, lon: 107.6 }, catatan: "daun bercak" },
    {
      client,
      retrieveFn: async () => [{ source: "penanganan-hama-penyakit.md", title: "Cabai", content: "isi" }],
      weatherFn: async () => ({ current: { condition: "Hujan ringan", tempC: 27 }, today: {}, forecast: [] }),
    },
  );
  assert.deepEqual([r.estimasi_total_biaya.min, r.estimasi_total_biaya.max], [60000, 110000]);
  assert.ok(r.estimasi_total_biaya.asumsi.some((a) => /dihitung ulang/.test(a)));
  assert.deepEqual(r.langkah_penanganan.map((l) => l.urutan), [1, 2]);
  assert.equal(r.langkah_penanganan[0].prioritas, "segera");
  assert.equal(r.kategori_expense, "OBAT");
  assert.equal(r.catatan_estimasi, DISCLAIMER);
  assert.equal(r.cuaca_tersedia, true);
  assert.deepEqual(r.sumber_rag, [{ source: "penanganan-hama-penyakit.md", title: "Cabai" }]);
  const prompt = client.calls[0].contents[0].parts[0].text;
  assert.match(prompt, /cabai merah/);
  assert.match(prompt, /Hujan ringan/);
  assert.match(prompt, /daun bercak/);
  assert.match(client.calls[0].config.systemInstruction, /merek dagang/);
});

test("solusi: cuaca dan RAG gagal -> lanjut, cuaca disebut di asumsi", async () => {
  const restore = silent();
  try {
    const client = fakeClient([JSON.stringify(solOk)]);
    const r = await generateSolution(
      { detection: detOk, land, coords: { lat: 1, lon: 2 } },
      { client, retrieveFn: async () => { throw new Error("rag mati"); }, weatherFn: async () => { throw new Error("offline"); } },
    );
    assert.equal(r.cuaca_tersedia, false);
    assert.ok(r.estimasi_total_biaya.asumsi.some((a) => /cuaca/i.test(a)));
    assert.deepEqual(r.sumber_rag, []);
    assert.match(client.calls[0].contents[0].parts[0].text, /Data cuaca tidak tersedia/);
  } finally { restore(); }
});

test("solusi: JSON rusak -> retry sekali; gagal terus -> error jelas, bukan simulasi", async () => {
  const restore = silent();
  try {
    const c1 = fakeClient(["bukan json", JSON.stringify(solOk)]);
    const r = await generateSolution({ detection: detOk, land }, base(c1));
    assert.equal(c1.calls.length, 2);
    assert.match(c1.calls[1].contents[0].parts[0].text, /PERHATIAN/);
    assert.ok(r.ringkasan);

    const badStep = { ...solOk, langkah_penanganan: [{ urutan: 1, langkah: "a", prioritas: "kapan_saja" }] };
    const c2 = fakeClient(["x", JSON.stringify(badStep)]);
    await assert.rejects(generateSolution({ detection: detOk, land }, base(c2)), (e) => e.code === "AI_INVALID_OUTPUT");
    assert.equal(c2.calls.length, 2);
  } finally { restore(); }
});

test("solusi: bahan min > max ditolak; biaya negatif ditolak skema", async () => {
  const restore = silent();
  try {
    const bad = { ...solOk, bahan_dan_alat: [{ nama: "A", dosis_atau_jumlah: "1", estimasi_biaya_min: 90, estimasi_biaya_max: 10 }] };
    const client = fakeClient([JSON.stringify(bad), JSON.stringify(bad)]);
    await assert.rejects(generateSolution({ detection: detOk, land }, base(client)), (e) => e.code === "AI_INVALID_OUTPUT");
    const neg = { ...solOk, bahan_dan_alat: [{ nama: "A", dosis_atau_jumlah: "1", estimasi_biaya_min: -5, estimasi_biaya_max: 10 }] };
    assert.equal(solutionSchema.safeParse(neg).success, false);
  } finally { restore(); }
});

test("prompt solusi: komoditas dari lahan; tanpa komoditas -> tidak diketahui", () => {
  assert.match(buildSolutionPrompt({ detection: detOk, land: { komoditas: "tomat" } }), /Komoditas: tomat/);
  assert.match(buildSolutionPrompt({ detection: detOk, land: {} }), /Komoditas: tidak diketahui/);
});
