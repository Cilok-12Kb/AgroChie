import { describe, test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { TranslationCache, createTranslateService } from "../src/services/translate.service.js";
import { tmpDir, newCache, cleanupTmp, cfg, noLog, fake } from "./helpers/translate-fakes.js";

cleanupTmp();

describe("layanan terjemahan", () => {
  test("hasil valid diterjemahkan dan disimpan ke cache (berkas ditulis atomik)", async () => {
    const cache = newCache();
    const svc = createTranslateService({ cache, providers: { ollama: fake((k) => `EN:${k}`) }, cfg: cfg(), logError: noLog });
    const out = await svc.translate("en", ["Halo", "Panen 3 kali"]);
    assert.deepEqual(out, { Halo: "EN:Halo", "Panen 3 kali": "EN:Panen 3 kali" });
    await cache.flush();
    const saved = JSON.parse(fs.readFileSync(cache.file, "utf8"));
    assert.equal(saved.en.Halo, "EN:Halo");
    assert.deepEqual(saved.zh, {});
    assert.deepEqual(fs.readdirSync(tmpDir).filter((f) => f.endsWith(".tmp")), []);
  });

  test("teks yang sudah ada di cache tidak memanggil penerjemah", async () => {
    const cache = newCache();
    cache.set("en", "Halo", "Hello");
    const calls = [];
    const svc = createTranslateService({ cache, providers: { ollama: fake((k) => `EN:${k}`, calls) }, cfg: cfg(), logError: noLog });
    assert.deepEqual(await svc.translate("en", ["Halo"]), { Halo: "Hello" });
    assert.equal(calls.length, 0);
    await svc.translate("en", ["Halo", "Baru"]);
    assert.equal(calls.length, 1);
    assert.deepEqual(Object.keys(JSON.parse(calls[0].user)), ["Baru"]);
  });

  test("cache dimuat dari berkas saat start", () => {
    const file = path.join(tmpDir, "preload.json");
    fs.writeFileSync(file, JSON.stringify({ en: { Halo: "Hi" }, zh: { Halo: "你好" } }));
    const cache = new TranslationCache(file);
    assert.equal(cache.get("en", "Halo"), "Hi");
    assert.equal(cache.get("zh", "Halo"), "你好");
  });

  test("penerjemah gagal: teks asli, tidak disimpan, log hanya jenis galat tanpa isi teks", async () => {
    const cache = newCache();
    const logs = [];
    const boom = async () => { throw Object.assign(new Error("RAHASIA Nama Petani"), { name: "ECONNREFUSED" }); };
    const svc = createTranslateService({ cache, providers: { ollama: boom }, cfg: cfg(), logError: (...a) => logs.push(a.join(" ")) });
    assert.deepEqual(await svc.translate("en", ["Nama Petani Budi"]), { "Nama Petani Budi": "Nama Petani Budi" });
    assert.equal(cache.get("en", "Nama Petani Budi"), undefined);
    assert.ok(logs.length > 0 && logs.every((l) => l.includes("ECONNREFUSED")));
    assert.ok(logs.every((l) => !l.includes("Budi") && !l.includes("RAHASIA")));
  });

  test("provider none: teks asli", async () => {
    const svc = createTranslateService({ cache: newCache(), providers: {}, cfg: cfg("none"), logError: noLog });
    assert.deepEqual(await svc.translate("zh", ["Halo"]), { Halo: "Halo" });
  });

  test("hasil tidak valid tidak disimpan: kosong, angka hilang, zh tanpa aksara Mandarin", async () => {
    const cache = newCache();
    const bad = { Satu: "", "Panen 25 hari": "Harvest days", "Selamat datang": "Welcome" };
    const svc = createTranslateService({ cache, providers: { ollama: fake((k) => bad[k]) }, cfg: cfg(), logError: noLog });
    const out = await svc.translate("zh", Object.keys(bad));
    assert.deepEqual(out, { Satu: "Satu", "Panen 25 hari": "Panen 25 hari", "Selamat datang": "Selamat datang" });
    for (const k of Object.keys(bad)) assert.equal(cache.get("zh", k), undefined);
  });

  test("fallback provider dipakai untuk teks yang gagal di provider utama", async () => {
    const cache = newCache();
    const mainCalls = [], fbCalls = [];
    const providers = {
      ollama: async (a) => { mainCalls.push(a); throw new Error("mati"); },
      gemini: fake((k) => `GEM:${k}`, fbCalls),
    };
    const svc = createTranslateService({ cache, providers, cfg: cfg("ollama", "gemini"), logError: noLog });
    assert.deepEqual(await svc.translate("en", ["Halo"]), { Halo: "GEM:Halo" });
    assert.equal(mainCalls.length, 1);
    assert.equal(fbCalls.length, 1);
    assert.equal(cache.get("en", "Halo"), "GEM:Halo");
  });

  test("fallback tidak dipanggil bila utama berhasil", async () => {
    const fbCalls = [];
    const providers = { ollama: fake((k) => `EN:${k}`), gemini: fake(() => "x", fbCalls) };
    const svc = createTranslateService({ cache: newCache(), providers, cfg: cfg("ollama", "gemini"), logError: noLog });
    await svc.translate("en", ["Halo"]);
    assert.equal(fbCalls.length, 0);
  });
});
