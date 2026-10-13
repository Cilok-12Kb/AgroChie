import { test } from "node:test";
import assert from "node:assert/strict";
import { generateAnswer, LlmError } from "../src/services/llm.service.js";

const input = { system: "s", history: [], userText: "halo" };
const failing = (err) => ({ models: { generateContent: async () => { throw err; } } });

async function run(err) {
  const logs = [];
  const orig = console.error;
  console.error = (...a) => logs.push(a.join(" "));
  try {
    const e = await generateAnswer(input, failing(err)).then(() => null, (x) => x);
    return { e, logs };
  } finally {
    console.error = orig;
  }
}

test("generateAnswer: kuota Gemini (429) menjadi LLM_QUOTA, bukan ReferenceError", async () => {
  const { e } = await run(Object.assign(new Error("RESOURCE_EXHAUSTED"), { status: 429 }));
  assert.ok(e instanceof LlmError);
  assert.equal(e.code, "LLM_QUOTA");
  assert.equal(e.status, 503);
});

test("generateAnswer: timeout menjadi LLM_TIMEOUT", async () => {
  const { e } = await run(Object.assign(new Error("habis waktu"), { name: "TimeoutError" }));
  assert.equal(e.code, "LLM_TIMEOUT");
  assert.equal(e.status, 504);
});

test("generateAnswer: galat lain menjadi LLM_ERROR; log memuat status, maks 300 karakter, tanpa API key", async () => {
  const msg = "gagal key=AIzaSySECRET123 " + "x".repeat(500);
  const { e, logs } = await run(Object.assign(new Error(msg), { status: 500 }));
  assert.ok(!(e instanceof ReferenceError));
  assert.equal(e.code, "LLM_ERROR");
  assert.equal(e.status, 502);
  const log = logs.join("\n");
  assert.ok(log.includes("500"));
  assert.ok(!log.includes("SECRET123"));
  assert.ok(log.length <= 300 + "[gemini] 500 ".length);
});
