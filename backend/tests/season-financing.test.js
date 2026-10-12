import { test } from "node:test";
import assert from "node:assert/strict";
process.env.DATABASE_URL = "postgresql://x:y@localhost:5432/z";
process.env.ENGINE_INTERNAL_KEY = "kunci-uji";

const { startFinancing } = await import("../src/services/prediction.service.js");

// Validasi capitalJt terjadi sebelum akses DB, jadi tidak butuh database.
test("start-financing: capitalJt negatif, bukan angka, atau >2 desimal -> 400", async () => {
  for (const capitalJt of [-1, "abc", 1.234, "-0.5", true, {}]) {
    await assert.rejects(startFinancing("u", "s", { capitalJt }), (e) => e.status === 400, JSON.stringify(capitalJt));
  }
});
