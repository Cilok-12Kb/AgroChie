import { test } from "node:test";
import assert from "node:assert/strict";
import { chunkMarkdown } from "../src/services/rag/chunker.js";
import { normalize, topK } from "../src/services/rag/similarity.js";
import { buildSystemPrompt, describeFarmer } from "../src/services/rag/prompt.js";
import { rateLimit } from "../src/middleware/rate-limit.js";

test("chunker memecah per judul dan menyertakan judul di isi", () => {
  const md = "# Cabai\nIntro cabai.\n\n## Fase\nPersiapan 2 minggu.\n\n## Panen\nPanen 4 minggu.";
  const c = chunkMarkdown(md);
  assert.deepEqual(c.map((x) => x.title), ["Cabai", "Fase", "Panen"]);
  assert.ok(c[1].content.startsWith("Fase\n"));
  assert.deepEqual(c.map((x) => x.position), [0, 1, 2]);
});

test("chunker memotong bagian panjang tanpa melewati batas", () => {
  const para = "Kalimat uji. ".repeat(30); // ~390 karakter
  const c = chunkMarkdown(`## Panjang\n${[para, para, para, para].join("\n\n")}`, { maxChars: 900 });
  assert.ok(c.length >= 2);
  assert.ok(c.every((x) => x.content.length <= 900 + "Panjang\n".length));
  const one = chunkMarkdown(`## Satu\n${"x".repeat(2000)}`, { maxChars: 900, overlap: 100 });
  assert.ok(one.length >= 3 && one.every((x) => x.content.length <= 900 + 5));
});

test("topK mengurutkan menurut kemiripan, menyaring skor rendah dan beda dimensi", () => {
  const items = [
    { id: "a", embedding: normalize([1, 0, 0]) },
    { id: "b", embedding: normalize([1, 1, 0]) },
    { id: "c", embedding: normalize([0, 0, 1]) },
    { id: "d", embedding: normalize([1, 0]) }, // dimensi lain: dilewati
  ];
  const r = topK(normalize([1, 0.1, 0]), items, { k: 2, minScore: 0.5 });
  assert.deepEqual(r.map((x) => x.id), ["a", "b"]);
  assert.ok(r[0].score > r[1].score);
  assert.equal(topK(normalize([0, 1, 0]), [items[2]], { minScore: 0.5 }).length, 0);
});

test("prompt memuat aturan, dokumen, dan data petani tanpa data pribadi", () => {
  const farmerText = describeFarmer({
    farm: { areaHa: "0.50", province: "Jawa Tengah", soilType: "Lempung", name: "RAHASIA", note: "RAHASIA" },
    season: { crop: "CABAI", status: "PEMBIAYAAN", capitalJt: "30" },
    plan: { totalJt: "24.1", p10Jt: "20.3", p90Jt: "28", shortfallJt: "0" },
  });
  assert.match(farmerText, /luas 0,5 ha/);
  assert.match(farmerText, /rentang 20,3 sampai 28 juta/);
  assert.doesNotMatch(farmerText, /RAHASIA|kekurangan/);
  const p = buildSystemPrompt({ chunks: [{ source: "fase.md", title: "Fase", content: "Fase\nIsi." }], farmerText });
  assert.match(p, /<dokumen sumber="fase.md" judul="Fase">/);
  assert.match(p, /<data_petani>[\s\S]*Jawa Tengah/);
  assert.match(buildSystemPrompt({ farmerText: "x" }), /tidak ada dokumen yang relevan/);
});

test("rate limit menolak setelah batas dan tidak mencampur pengguna", () => {
  const mw = rateLimit({ windowMs: 1000, max: 2 });
  const run = (userId) => { let err; mw({ userId }, {}, (e) => (err = e)); return err; };
  assert.equal(run("u1"), undefined);
  assert.equal(run("u1"), undefined);
  assert.equal(run("u1").status, 429);
  assert.equal(run("u2"), undefined);
});