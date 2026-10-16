import { describe, test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { createTranslateService, buildSystemPrompt, parseModelJson, isValidTranslation, loadGlossary } from "../src/services/translate.service.js";
import { tmpDir, newCache, cleanupTmp, cfg, noLog, fake } from "./helpers/translate-fakes.js";

cleanupTmp();

describe("glosarium", () => {
  test("glosarium masuk ke prompt sesuai bahasa target", async () => {
    const calls = [];
    const glossary = { Lahan: { en: "Field", zh: "田地" }, Panen: { en: "Harvest", zh: "收获" } };
    const svc = createTranslateService({ cache: newCache(), glossary, providers: { ollama: fake((k) => `田${k}`, calls) }, cfg: cfg(), logError: noLog });
    await svc.translate("zh", ["Lahan saya"]);
    assert.match(calls[0].system, /Lahan => 田地/);
    assert.match(calls[0].system, /Panen => 收获/);
    assert.doesNotMatch(calls[0].system, /Field/);
    assert.match(calls[0].system, /AgroChie/);
  });

  test("glosarium asli dapat dibaca; berkas hilang = kosong", () => {
    assert.equal(loadGlossary().Lahan.en, "Field");
    assert.deepEqual(loadGlossary(path.join(tmpDir, "tidak-ada.json")), {});
    assert.match(buildSystemPrompt("en", {}), /JSON/);
  });
});

describe("fungsi murni", () => {
  test("parseModelJson: abaikan <think> dan pagar kode", () => {
    assert.deepEqual(parseModelJson('<think>hmm {"a":1}</think>{"a":"b"}'), { a: "b" });
    assert.deepEqual(parseModelJson('```json\n{"a":"b"}\n```'), { a: "b" });
    assert.equal(parseModelJson("bukan json"), null);
    assert.equal(parseModelJson("[1]"), null);
  });

  test("isValidTranslation", () => {
    assert.equal(isValidTranslation("Halo", "Hello", "en"), true);
    assert.equal(isValidTranslation("Halo", "  ", "en"), false);
    assert.equal(isValidTranslation("Sisa 5 hari", "Days left", "en"), false);
    assert.equal(isValidTranslation("Sisa 5 hari", "剩余5天", "zh"), true);
    assert.equal(isValidTranslation("Halo", "Hello", "zh"), false);
    assert.equal(isValidTranslation("Rp", "Rp", "zh"), true);
  });
});
