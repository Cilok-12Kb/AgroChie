import { test } from "node:test";
import assert from "node:assert/strict";
import { generateAnswer, generateStructured, classifyLlmError } from "../src/services/llm.service.js";
import { buildEnv, modelNameWarnings } from "../src/config/env-parse.js";

const cfg = { geminiModel: "m-utama", geminiFallbackModel: "", geminiMaxRetries: 1, geminiRetryBaseMs: 10, geminiTimeoutMs: 30000 };
const input = { system: "s", history: [], userText: "halo" };
const err = (status, message = "x") => Object.assign(new Error(message), { status });
const ok = { text: "jawab" };

// steps: Error = dilempar, objek lain = hasil. Mencatat model yang dipakai.
function fake(steps) {
  const models = [];
  return { models, client: { models: { generateContent: async ({ model }) => { models.push(model); const s = steps[models.length - 1]; if (s instanceof Error) throw s; return s; } } } };
}
async function run(steps, c = cfg, fn = "answer") {
  const f = fake(steps);
  const logs = [];
  const orig = console.error;
  console.error = (...a) => logs.push(a.join(" "));
  const sleeps = [];
  const opts = { cfg: c, sleep: async (ms) => sleeps.push(ms) };
  try {
    const call = fn === "answer" ? generateAnswer(input, f.client, opts) : generateStructured({ userText: "x", model: c.geminiModel }, f.client, opts);
    const out = await call.then((v) => ({ v }), (e) => ({ e }));
    return { ...out, models: f.models, logs, sleeps };
  } finally { console.error = orig; }
}

test("klasifikasi: tiap status dipetakan benar", () => {
  const cases = [
    [429, 503, "LLM_QUOTA", "Kuota AI hari ini habis, coba lagi besok atau hubungi admin."],
    [503, 503, "LLM_BUSY", "Layanan AI sedang sibuk, coba lagi sebentar lagi."],
    [400, 500, "LLM_CONFIG", "Konfigurasi layanan AI bermasalah, hubungi admin."],
    [404, 500, "LLM_CONFIG"], [401, 500, "LLM_CONFIG"], [403, 500, "LLM_CONFIG"],
    [500, 502, "LLM_ERROR"],
  ];
  for (const [s, http, code, msg] of cases) {
    const e = classifyLlmError(err(s, "detail rahasia model"));
    assert.equal(e.status, http); assert.equal(e.code, code);
    if (msg) assert.equal(e.message, msg);
    assert.ok(!/detail rahasia/.test(e.message));
  }
  assert.equal(classifyLlmError(new Error("RESOURCE_EXHAUSTED")).code, "LLM_QUOTA");
  assert.equal(classifyLlmError(new Error("UNAVAILABLE")).code, "LLM_BUSY");
  assert.equal(classifyLlmError(new Error("INVALID_ARGUMENT")).code, "LLM_CONFIG");
  const t = classifyLlmError(Object.assign(new Error("t"), { name: "TimeoutError" }));
  assert.equal(t.code, "LLM_TIMEOUT"); assert.equal(t.status, 504);
});

for (const fn of ["answer", "structured"]) {
  const okv = fn === "answer" ? ok : ok;
  test(`${fn}: 503 retry sekali lalu sukses (2 panggilan)`, async () => {
    const r = await run([err(503), okv], cfg, fn);
    assert.equal(r.v, "jawab"); assert.equal(r.models.length, 2); assert.deepEqual(r.sleeps, [10]);
  });
  test(`${fn}: 503 terus -> LLM_BUSY setelah 1 retry (2 panggilan)`, async () => {
    const r = await run([err(503), err(503), okv], cfg, fn);
    assert.equal(r.e.code, "LLM_BUSY"); assert.equal(r.models.length, 2);
  });
  test(`${fn}: 429 tanpa retry`, async () => {
    const r = await run([err(429, "RESOURCE_EXHAUSTED"), okv], cfg, fn);
    assert.equal(r.e.code, "LLM_QUOTA"); assert.equal(r.models.length, 1); assert.equal(r.sleeps.length, 0);
  });
  test(`${fn}: 400 tanpa retry dan tanpa fallback; detail hanya di log`, async () => {
    const r = await run([err(400, "INVALID_ARGUMENT model salah"), okv], { ...cfg, geminiFallbackModel: "m-cadangan" }, fn);
    assert.equal(r.e.code, "LLM_CONFIG"); assert.equal(r.e.status, 500); assert.equal(r.models.length, 1);
    assert.ok(r.logs.join("\n").includes("INVALID_ARGUMENT model salah"));
    assert.ok(!r.e.message.includes("model salah"));
  });
}
