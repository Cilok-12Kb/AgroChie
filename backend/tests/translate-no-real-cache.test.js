import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";

// Mengimpor rute terjemahan tidak boleh memuat layanan bawaan (yang membaca cache asli).
test("impor translate.routes tidak menyentuh cache asli", async () => {
  const { DEFAULT_CACHE_PATH } = await import("../src/services/translate.service.js");
  const before = fs.existsSync(DEFAULT_CACHE_PATH) ? fs.statSync(DEFAULT_CACHE_PATH).mtimeMs : null;
  const { translateRoutes } = await import("../src/routes/translate.routes.js");
  assert.equal(typeof translateRoutes, "function");
  const after = fs.existsSync(DEFAULT_CACHE_PATH) ? fs.statSync(DEFAULT_CACHE_PATH).mtimeMs : null;
  assert.equal(after, before);
});
