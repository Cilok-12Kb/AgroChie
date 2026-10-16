import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after } from "node:test";
import { TranslationCache } from "../../src/services/translate.service.js";

// Penerjemah di tes WAJIB tiruan (tanpa jaringan) dan cache di folder sementara, bukan berkas asli.
export const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "agrochie-translate-"));
let n = 0;
export const newCache = () => new TranslationCache(path.join(tmpDir, `cache-${n++}.json`), { debounceMs: 5 });
export const cleanupTmp = () => after(() => fs.rmSync(tmpDir, { recursive: true, force: true }));
export const cfg = (main = "ollama", fb = "") => ({ translateProvider: main, translateFallbackProvider: fb });
export const noLog = () => {};

/** Penerjemah tiruan: menjawab JSON { teks: fn(teks) } dan mencatat panggilan. */
export const fake = (fn, calls = []) => async ({ system, user }) => {
  calls.push({ system, user });
  const src = JSON.parse(user);
  return JSON.stringify(Object.fromEntries(Object.keys(src).map((k) => [k, fn(k)])));
};
