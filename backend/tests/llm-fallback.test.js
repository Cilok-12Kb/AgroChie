import { test } from "node:test";
import assert from "node:assert/strict";
import { generateAnswer } from "../src/services/llm.service.js";
import { buildEnv, modelNameWarnings } from "../src/config/env-parse.js";

const cfg = { geminiModel: "m-utama", geminiFallbackModel: "", geminiMaxRetries: 1, geminiRetryBaseMs: 10, geminiTimeoutMs: 30000 };
const input = { system: "s", history: [], userText: "halo" };
const err = (status, message = "x") => Object.assign(new Error(message), { status });
const ok = { text: "jawab" };

async function run(steps, c = cfg) {
  const models = [];
  const client = { models: { generateContent: async ({ model }) => { models.push(model); const s = steps[models.length - 1]; if (s instanceof Error) throw s; return s; } } };
  const logs = [];
  const orig = console.error;
  console.error = (...a) => logs.push(a.join(" "));
  try {
    const out = await generateAnswer(input, client, { cfg: c, sleep: async () => {} }).then((v) => ({ v }), (e) => ({ e }));
    return { ...out, models, logs };
  } finally { console.error = orig; }
}

test("fallback: 503 habis retry lalu model cadangan dicoba sekali", async () => {
  const r = await run([err(503), err(503), ok], { ...cfg, geminiFallbackModel: "m-cadangan" });
  assert.equal(r.v, "jawab"); assert.deepEqual(r.models, ["m-utama", "m-utama", "m-cadangan"]);
});

test("fallback: kuota habis langsung ke cadangan; cadangan gagal -> galat, hanya sekali", async () => {
  const r = await run([err(429), err(429), ok], { ...cfg, geminiFallbackModel: "m-cadangan" });
  assert.equal(r.e.code, "LLM_QUOTA"); assert.deepEqual(r.models, ["m-utama", "m-cadangan"]);
});

test("fallback kosong atau sama dengan model utama diabaikan", async () => {
  assert.equal((await run([err(429), ok], cfg)).models.length, 1);
  assert.equal((await run([err(429), ok], { ...cfg, geminiFallbackModel: "m-utama" })).models.length, 1);
});

test("retry dilewati bila jeda tidak muat dalam GEMINI_TIMEOUT_MS", async () => {
  const r = await run([err(503), ok], { ...cfg, geminiRetryBaseMs: 5000, geminiTimeoutMs: 1000 });
  assert.equal(r.e.code, "LLM_BUSY"); assert.equal(r.models.length, 1);
});

test("log tanpa API key", async () => {
  const r = await run([err(400, "gagal key=AIzaSySECRET123 dan AIzaSyLAIN456")]);
  const log = r.logs.join("\n");
  assert.ok(log.includes("400")); assert.ok(!log.includes("SECRET123")); assert.ok(!log.includes("LAIN456"));
});

test("env: default dan validasi retry/fallback", () => {
  const base = { DATABASE_URL: "x", JWT_SECRET: "a".repeat(32) };
  const e = buildEnv(base);
  assert.equal(e.geminiMaxRetries, 1); assert.equal(e.geminiRetryBaseMs, 2000); assert.equal(e.geminiFallbackModel, "");
  assert.equal(buildEnv({ ...base, GEMINI_FALLBACK_MODEL: "gemini-2.5-flash" }).geminiFallbackModel, "gemini-2.5-flash");
  assert.throws(() => buildEnv({ ...base, GEMINI_MODEL: "a-b", GEMINI_FALLBACK_MODEL: "a-b" }), /GEMINI_FALLBACK_MODEL/);
  assert.throws(() => buildEnv({ ...base, GEMINI_MAX_RETRIES: "-1" }), /GEMINI_MAX_RETRIES/);
});

test("validasi nama model", () => {
  assert.deepEqual(modelNameWarnings("GEMINI_MODEL", "gemini-2.5-flash"), []);
  assert.deepEqual(modelNameWarnings("GEMINI_MODEL", ""), []);
  for (const bad of ["Gemini-2.5-Flash", "gemini 2.5 flash", "models/gemini", "gemini_2", "-abc"]) {
    const w = modelNameWarnings("GEMINI_MODEL", bad);
    assert.equal(w.length, 1, bad); assert.ok(w[0].includes("PERINGATAN") && w[0].includes("GEMINI_MODEL"));
  }
});
