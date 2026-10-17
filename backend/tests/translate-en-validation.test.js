import { describe, test } from "node:test";
import assert from "node:assert/strict";
import { createTranslateService, validationFailure, isValidTranslation } from "../src/services/translate.service.js";
import { newCache, cleanupTmp, cfg, noLog, fake } from "./helpers/translate-fakes.js";

cleanupTmp();

const SAMPLES = {
  "Kembali ke beranda": "Back to Home",
  "Halaman tidak ditemukan": "Page not found",
  "Masuk sebagai tamu sementara": "Sign in as temporary guest",
};

describe("validasi terjemahan en (regresi Ollama)", () => {
  test("jawaban Inggris yang wajar lolos; aksara Han hanya disyaratkan untuk zh", () => {
    for (const [src, out] of Object.entries(SAMPLES)) {
      assert.equal(validationFailure(src, out, "en"), null);
      assert.equal(isValidTranslation(src, out, "en"), true);
      assert.equal(validationFailure(src, out, "zh"), "notChinese");
    }
  });

  test("alasan gagal terpisah: kosong / angka hilang / bukan Mandarin", () => {
    assert.equal(validationFailure("Halo", "  ", "en"), "empty");
    assert.equal(validationFailure("Halo", undefined, "en"), "empty");
    assert.equal(validationFailure("Sisa 5 hari", "Days left", "en"), "numbers");
    assert.equal(validationFailure("Halo", "Hello", "zh"), "notChinese");
  });

  test("Qwen tiruan menjawab Inggris: tersimpan di cache en, tanpa penolakan", async () => {
    const cache = newCache();
    const rejected = [];
    const svc = createTranslateService({
      cache, cfg: cfg("ollama"), logError: noLog,
      providers: { ollama: fake((k) => SAMPLES[k]) },
      onReject: (t, text, why) => rejected.push([t, why]),
    });
    const out = await svc.translate("en", Object.keys(SAMPLES));
    assert.deepEqual(out, SAMPLES);
    assert.equal(cache.get("en", "Kembali ke beranda"), "Back to Home");
    assert.deepEqual(rejected, []);
  });

  test("onReject melaporkan sebab per teks, termasuk kunci tidak cocok", async () => {
    const cache = newCache();
    const rejected = {};
    const provider = async ({ user }) => {
      const src = Object.keys(JSON.parse(user));
      return JSON.stringify({ [src[0]]: "", [src[1]]: "Terjemahan 1", "kunci lain": "x" });
    };
    const svc = createTranslateService({
      cache, cfg: cfg("ollama"), logError: noLog, providers: { ollama: provider },
      onReject: (t, text, why) => { rejected[text] = why; },
    });
    await svc.translate("en", ["A", "Baris 2", "Tanpa jawaban"]);
    assert.deepEqual(rejected, { A: "empty", "Baris 2": "numbers", "Tanpa jawaban": "key" });
  });
});
