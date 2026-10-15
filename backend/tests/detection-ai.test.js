import { test } from "node:test";
import assert from "node:assert/strict";
import { parseJsonText, generateValidated } from "../src/services/ai-json.js";
import { generateStructured, classifyLlmError, LlmError } from "../src/services/llm.service.js";
import { createGeminiProvider, buildDetectionPrompt, buildDetectionSystem } from "../src/services/detection/gemini-provider.js";
import { solutionSchema } from "../src/services/solution.service.js";

const silent = () => { const o = console.error; console.error = () => {}; return () => { console.error = o; }; };
const IMG = Buffer.from("ffd8ffe000104a46494600010100", "hex");

const detOk = {
  tanaman_terlihat: true, kondisi: "Daun cabai bercak", kategori_kualitas: "sedang", skor_kepercayaan: 0.8,
  masalah_terdeteksi: [{ nama: "Bercak daun", jenis: "penyakit", tingkat_keparahan: "ringan", gejala_terlihat: "bercak cokelat" }],
};

// klien Gemini palsu: antrean balasan, menyimpan argumen panggilan
function fakeClient(replies) {
  const calls = [];
  return {
    calls,
    models: {
      async generateContent(args) {
        calls.push(args);
        const r = replies.shift();
        if (r instanceof Error) throw r;
        return { text: r };
      },
    },
  };
}

test("parseJsonText menerima JSON polos dan pagar kode", () => {
  assert.deepEqual(parseJsonText('{"a":1}'), { a: 1 });
  assert.deepEqual(parseJsonText('```json\n{"a":1}\n```'), { a: 1 });
  assert.throws(() => parseJsonText("bukan json"), SyntaxError);
});

test("deteksi: retry sekali lalu berhasil; gagal terus -> AI_INVALID_OUTPUT", async () => {
  const restore = silent();
  try {
    const client = fakeClient(["{rusak", JSON.stringify(detOk)]);
    const r = await createGeminiProvider({ client }).detect(IMG, "image/jpeg", { komoditas: "cabai merah" });
    assert.equal(r.kondisi, "Daun cabai bercak");
    assert.equal(client.calls.length, 2);

    const c2 = fakeClient(["{rusak", JSON.stringify({ kondisi: "x" })]);
    await assert.rejects(createGeminiProvider({ client: c2 }).detect(IMG, "image/jpeg", {}), (e) => e.code === "AI_INVALID_OUTPUT" && e.status === 502);
    assert.equal(c2.calls.length, 2); // tepat satu retry
  } finally { restore(); }
});

test("permintaan Gemini memuat gambar, mime JSON, skema, dan abortSignal", async () => {
  const client = fakeClient([JSON.stringify(detOk)]);
  await createGeminiProvider({ client }).detect(IMG, "image/png", { komoditas: "tomat" });
  const { config, contents } = client.calls[0];
  assert.equal(config.responseMimeType, "application/json");
  assert.ok(config.responseJsonSchema.properties.kategori_kualitas);
  assert.ok(config.abortSignal);
  assert.equal(contents[0].parts[0].inlineData.mimeType, "image/png");
  assert.equal(contents[0].parts[0].inlineData.data, IMG.toString("base64"));
  assert.match(contents[0].parts[1].text, /tomat/);
});

test("prompt deteksi memakai komoditas dari data lahan, tidak hardcode", () => {
  assert.match(buildDetectionPrompt({ komoditas: "bawang" }), /bawang/);
  assert.doesNotMatch(buildDetectionPrompt({ komoditas: "bawang" }), /cabai/);
  assert.match(buildDetectionPrompt({}), /tidak diketahui/);
});

test("prompt sistem deteksi mengikuti bahasa yang dipilih", () => {
  assert.match(buildDetectionSystem("en"), /simple English/);
  assert.match(buildDetectionSystem("zh"), /简体中文/);
});

test("galat Gemini dibedakan: kuota, timeout, lain, kosong", async () => {
  const restore = silent();
  try {
    const quota = Object.assign(new Error("RESOURCE_EXHAUSTED"), { status: 429 });
    await assert.rejects(generateStructured({ userText: "x" }, fakeClient([quota])), (e) => e.code === "LLM_QUOTA" && e.status === 503);
    const to = Object.assign(new Error("aborted"), { name: "AbortError" });
    await assert.rejects(generateStructured({ userText: "x" }, fakeClient([to])), (e) => e.code === "LLM_TIMEOUT" && e.status === 504);
    await assert.rejects(generateStructured({ userText: "x" }, fakeClient([new Error("boom")])), (e) => e.code === "LLM_ERROR" && e.status === 502);
    await assert.rejects(generateStructured({ userText: "x" }, fakeClient([""])), (e) => e.code === "LLM_EMPTY");
  } finally { restore(); }
  assert.ok(classifyLlmError(new Error("x")) instanceof LlmError);
});

test("timeout nyata: sinyal habis waktu menjadi LLM_TIMEOUT", async () => {
  const restore = silent();
  try {
    const slow = { models: { generateContent: ({ config }) => new Promise((_, rej) => config.abortSignal.addEventListener("abort", () => rej(config.abortSignal.reason))) } };
    await assert.rejects(generateStructured({ userText: "x", timeoutMs: 20 }, slow), (e) => e.code === "LLM_TIMEOUT");
  } finally { restore(); }
});

test("galat kuota tidak di-retry oleh generateValidated", async () => {
  const restore = silent();
  try {
    let n = 0;
    const call = async () => { n++; throw new LlmError(503, "LLM_QUOTA", "x"); };
    await assert.rejects(generateValidated({ call, schema: solutionSchema }), (e) => e.code === "LLM_QUOTA");
    assert.equal(n, 1);
  } finally { restore(); }
});
