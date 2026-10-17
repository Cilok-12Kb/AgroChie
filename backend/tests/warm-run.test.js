import { test, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { loadTypescript, runWarm } from "../scripts/warm-translation-cache.mjs";
import { tmp, cleanup, makeSrc, cachePath, q, echo, baseOpts } from "./helpers/warm-fixtures.js";

cleanup();
const ts = loadTypescript();
const base = { ts, checkOllama: async () => {}, log: q, logError: q };

describe("runWarm", () => {
  test("teks yang sudah ada di cache tidak dikirim ulang", async () => {
    const srcDir = makeSrc({ "a.tsx": "export const a = <div><p>Halo dunia</p><p>Panen raya</p></div>;" });
    const file = cachePath();
    fs.writeFileSync(file, JSON.stringify({ en: { "Halo dunia": "Hello world" }, zh: {} }));
    const calls = [];
    const r = await runWarm(baseOpts(srcDir, file), { ...base, providers: { ollama: echo((k) => `EN:${k}`, calls) } });
    assert.deepEqual(calls, [["Panen raya"]]);
    assert.equal(r.stats.en.cached, 1);
    assert.equal(r.stats.en.translated, 1);
    const saved = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.equal(saved.en["Halo dunia"], "Hello world");
    assert.equal(saved.en["Panen raya"], "EN:Panen raya");
  });

  test("--dry-run tidak memanggil model dan tidak menulis cache atau laporan", async () => {
    const srcDir = makeSrc({ "a.tsx": "export const a = <p>Halo dunia</p>;" });
    const file = cachePath();
    const report = path.join(tmp, "dry-report.md");
    let called = 0;
    const r = await runWarm(baseOpts(srcDir, file, { dryRun: true, reportPath: report }), {
      ...base, providers: { ollama: async () => { called++; return "{}"; } }, checkOllama: async () => { called++; },
    });
    assert.equal(called, 0);
    assert.equal(r.stats.en.pending, 1);
    assert.equal(fs.existsSync(file), false);
    assert.equal(fs.existsSync(report), false);
  });

  test("hasil tidak valid tidak masuk cache dan dicatat sebagai gagal", async () => {
    const srcDir = makeSrc({ "a.tsx": "export const a = <div><p>Panen 25 hari</p><p>Selamat datang</p></div>;" });
    const file = cachePath();
    const bad = { "Panen 25 hari": "Harvest days", "Selamat datang": "Welcome" }; // angka 25 hilang
    const r = await runWarm(baseOpts(srcDir, file), { ...base, providers: { ollama: echo((k) => bad[k]) } });
    assert.equal(r.stats.en.failed, 1);
    assert.equal(r.failures[0].text, "Panen 25 hari");
    assert.equal(r.failures[0].locs[0], "a.tsx:1");
    const saved = JSON.parse(fs.readFileSync(file, "utf8"));
    assert.equal(saved.en["Panen 25 hari"], undefined);
    assert.equal(saved.en["Selamat datang"], "Welcome");
    assert.match(fs.readFileSync(path.join(tmp, "report.md"), "utf8"), /Panen 25 hari/);
  });

  test("batch dihormati", async () => {
    const words = ["Satu", "Dua", "Tiga", "Empat", "Lima"];
    const srcDir = makeSrc({ "a.tsx": `export const a = <div>${words.map((w) => `<p>${w} kata</p>`).join("")}</div>;` });
    const calls = [];
    await runWarm(baseOpts(srcDir, cachePath(), { batch: 2 }), { ...base, providers: { ollama: echo((k) => `EN:${k}`, calls) } });
    assert.deepEqual(calls.map((c) => c.length), [2, 2, 1]);
  });

  test("Ollama tidak bisa dihubungi: berhenti, cache tidak berubah", async () => {
    const srcDir = makeSrc({ "a.tsx": "export const a = <p>Halo dunia</p>;" });
    const file = cachePath();
    const original = JSON.stringify({ en: { Lama: "Old" }, zh: {} });
    fs.writeFileSync(file, original);
    const errors = [];
    const r = await runWarm(baseOpts(srcDir, file), {
      ...base,
      providers: { ollama: async () => { throw new Error("tidak boleh dipanggil"); } },
      checkOllama: async () => { throw Object.assign(new Error("x"), { name: "ECONNREFUSED" }); },
      logError: (m) => errors.push(m),
    });
    assert.equal(r.exitCode, 2);
    assert.match(errors[0], /Ollama tidak bisa dihubungi/);
    assert.equal(fs.readFileSync(file, "utf8"), original);
    assert.deepEqual(fs.readdirSync(tmp).filter((f) => f.endsWith(".tmp")), []);
  });
});
