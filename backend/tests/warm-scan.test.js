import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { loadTypescript, scanSource, textsForTarget, normalizeKey, shouldSkipText, parseArgs } from "../scripts/warm-translation-cache.mjs";
import * as logic from "../../agrochie-web/src/features/i18n-auto/logic.ts";
import { cleanup, makeSrc } from "./helpers/warm-fixtures.js";

cleanup();
const ts = loadTypescript();

describe("pemindai", () => {
  const { occurrences, skippedByFile } = scanSource(ts, makeSrc());
  const keys = occurrences.map((o) => o.key);

  test("menemukan JsxText (dinormalkan), atribut, dan string di ekspresi JSX", () => {
    for (const k of ["Selamat datang petani", "Cari lahan", "Judul bantuan", "Label aksesibel", "Gambar panen",
      "Teks dalam ekspresi", "Pilihan satu", "Pilihan dua", "Opsi dengan value"]) assert.ok(keys.includes(k), k);
    assert.equal(occurrences.find((o) => o.key === "Cari lahan").line, 7);
  });

  test("melewati data-no-translate, translate=\"no\", dan option tanpa value", () => {
    for (const k of ["Nama Rahasia Budi", "Teks bertanda no", "Opsi tanpa value"]) assert.ok(!keys.includes(k), k);
    assert.equal(skippedByFile["a.tsx"], 2);
  });

  test("penyaring AutoTranslate diterapkan (angka dan merek tidak ikut)", () => {
    const en = [...textsForTarget(occurrences, "en").keys()];
    assert.ok(!en.includes("12345"));
    assert.ok(!en.includes("AgroChie Mobile"));
  });

  test("melewati berkas uji, translations.ts, node_modules, dan .next", () => {
    const dir = makeSrc({
      "x.test.tsx": "export const a = <p>Dari tes</p>;",
      "i18n/translations.ts": "export const t = <p>Kamus</p>;",
      "node_modules/m.tsx": "export const a = <p>Modul</p>;",
      ".next/n.tsx": "export const a = <p>Build</p>;",
      "ok.tsx": "export const a = <p>Dipindai</p>;",
    });
    assert.deepEqual(scanSource(ts, dir).occurrences.map((o) => o.key), ["Dipindai"]);
  });

  test("normalisasi dan penyaring identik dengan AutoTranslate (modul yang sama)", () => {
    assert.equal(normalizeKey, logic.normalizeKey);
    assert.equal(shouldSkipText, logic.shouldSkipText);
    assert.equal(normalizeKey("  a \n  b\t c "), "a b c");
  });

  test("parseArgs: opsi dan validasi", () => {
    const o = parseArgs(["--dry-run", "--target", "zh", "--limit", "5", "--batch", "10", "--model", "m", "--host", "http://h:1/"]);
    assert.deepEqual([o.dryRun, o.targets, o.limit, o.batch, o.model, o.host], [true, ["zh"], 5, 10, "m", "http://h:1"]);
    assert.throws(() => parseArgs(["--target", "fr"]), /Target tidak didukung/);
    assert.throws(() => parseArgs(["--batch", "0"]), /bilangan bulat/);
    assert.throws(() => parseArgs(["--x"]), /tidak dikenal/);
  });
});
