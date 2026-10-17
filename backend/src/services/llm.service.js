import { gemini } from "../config/gemini.js";
import { env } from "../config/env.js";
import { HttpError } from "../utils/http-error.js";

const MAX_TOOL_ROUNDS = 3; // [REVISI] batas putaran pemanggilan fungsi agar tidak berulang tanpa akhir

/**
 * history: pesan tersimpan berurutan lama ke baru ({role: "USER"|"ASSISTANT", content}).
 * [REVISI] tools (opsional): { declarations: [FunctionDeclaration], handlers: { nama: async (args) => objek } }.
 * Galat di handler dikembalikan ke Gemini sebagai { error } agar dijawab jujur, bukan dikarang.
 */
export async function generateAnswer({ system, history, userText, tools, temperature = 0.3 /* [REVISI] dapat diatur pemanggil; bawaan tetap 0.3 */ }, client = null /* [REVISI] klien palsu untuk uji */, opts = {} /* [REVISI] uji: { cfg, sleep } */) {
  const deadline = Date.now() + (opts.cfg ?? env).geminiTimeoutMs; // [REVISI] anggaran waktu untuk retry
  const contents = [
    ...history.map((m) => ({ role: m.role === "USER" ? "user" : "model", parts: [{ text: m.content }] })),
    { role: "user", parts: [{ text: userText }] },
  ];
  const config = { systemInstruction: system, temperature };
  if (tools?.declarations?.length) config.tools = [{ functionDeclarations: tools.declarations }];
  try {
    let res;
    for (let round = 0; ; round++) {
      res = await callGemini((m) => (client ?? gemini()).models.generateContent({ model: m, contents, config }), { deadline, ...opts });
      const calls = res.functionCalls ?? [];
      if (!calls.length || !tools) break;
      if (round >= MAX_TOOL_ROUNDS) throw new HttpError(502, "Asisten tidak memberi jawaban. Coba ulangi.");
      contents.push(res.candidates?.[0]?.content ?? { role: "model", parts: calls.map((functionCall) => ({ functionCall })) });
      const parts = [];
      for (const call of calls) {
        let response;
        try {
          const handler = tools.handlers?.[call.name];
          response = handler ? await handler(call.args ?? {}) : { error: "Fungsi tidak tersedia" };
        } catch (e) {
          response = { error: e instanceof HttpError ? e.message : "Data tidak dapat diambil" };
        }
        parts.push({ functionResponse: { name: call.name, ...(call.id ? { id: call.id } : {}), response } });
      }
      contents.push({ role: "user", parts });
    }
    const text = res.text?.trim();

    if (!text) throw new HttpError(502, "Asisten tidak memberi jawaban. Coba ulangi.");
    return text;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    // [REVISI] galat panggilan Gemini sudah diklasifikasi+dilog di callGemini (HttpError di atas); sisanya galat tak terduga.
    logGeminiError(e);
    throw classifyLlmError(e);
  }
}

// [REVISI] Deteksi tanaman: panggilan Gemini terstruktur (teks + gambar opsional) dengan keluaran JSON.
/** Galat panggilan Gemini dengan kode yang jelas: LLM_QUOTA (kuota/laju), LLM_TIMEOUT, LLM_EMPTY, LLM_ERROR. */
export class LlmError extends HttpError {
  constructor(status, code, message) {
    super(status, message);
    this.code = code;
  }
}

// [REVISI] satu-satunya klasifikasi galat Gemini (dipakai generateAnswer dan generateStructured).
// Status HTTP didahulukan; teks status gRPC (mis. "INVALID_ARGUMENT") hanya bila status tidak ada.
// Pesan ke pengguna selalu umum; detail asli hanya di log server (lihat logGeminiError).
export function classifyLlmError(e, signal) {
  if (e instanceof LlmError) return e;
  if (signal?.aborted || e?.name === "TimeoutError" || e?.name === "AbortError") {
    return new LlmError(504, "LLM_TIMEOUT", "Analisis AI melewati batas waktu. Coba lagi sebentar lagi.");
  }
  const status = Number(e?.status ?? e?.error?.code);
  const text = String(e?.message ?? "");
  const is = (code, re) => status === code || (!Number.isFinite(status) && re.test(text));
  if (is(429, /RESOURCE_EXHAUSTED/)) {
    return new LlmError(503, "LLM_QUOTA", "Kuota AI hari ini habis, coba lagi besok atau hubungi admin.");
  }
  if (is(503, /UNAVAILABLE/)) {
    return new LlmError(503, "LLM_BUSY", "Layanan AI sedang sibuk, coba lagi sebentar lagi.");
  }
  if ([400, 401, 403, 404].includes(status) || (!Number.isFinite(status) && /INVALID_ARGUMENT|NOT_FOUND|PERMISSION_DENIED|UNAUTHENTICATED/.test(text))) {
    return new LlmError(500, "LLM_CONFIG", "Konfigurasi layanan AI bermasalah, hubungi admin.");
  }
  return new LlmError(502, "LLM_ERROR", "Layanan AI tidak dapat dihubungi");
}

/** Log server: status + pesan asli (maks 300 karakter, API key disamarkan). Tidak pernah masuk respons. */
export function logGeminiError(e) {
  const msg = String(e?.message ?? "").replace(/AIza[\w-]+/g, "[disembunyikan]").replace(/(key=)[^&\s"]+/gi, "$1[disembunyikan]").slice(0, 300);
  console.error("[gemini]", e?.status ?? "", msg);
}

const defaultSleep = (ms, signal) =>
  new Promise((resolve, reject) => {
    const t = setTimeout(resolve, ms);
    signal?.addEventListener("abort", () => { clearTimeout(t); reject(signal.reason); }, { once: true });
  });

/**
 * [REVISI] Menjalankan fn(model) dengan kebijakan hemat:
 * - LLM_BUSY (503): ulang sampai cfg.geminiMaxRetries kali, jeda base*2^n, hanya bila masih muat sebelum deadline.
 * - LLM_QUOTA (429): tanpa ulang. LLM_CONFIG/lainnya: langsung gagal.
 * - Model cadangan (opsional, harus beda dari model utama) dicoba satu kali bila utama gagal BUSY atau QUOTA.
 */
export async function callGemini(fn, { model, signal, deadline, cfg = env, sleep = defaultSleep } = {}) {
  const primary = model ?? cfg.geminiModel;
  const fb = cfg.geminiFallbackModel;
  const models = fb && fb !== primary ? [primary, fb] : [primary];
  for (let i = 0; ; i++) {
    for (let attempt = 0; ; attempt++) {
      try {
        return await fn(models[i]);
      } catch (e) {
        if (e instanceof HttpError && !(e instanceof LlmError)) throw e; // mis. 503 kunci belum diisi
        const err = classifyLlmError(e, signal);
        logGeminiError(e);
        if (err.code === "LLM_BUSY" && attempt < cfg.geminiMaxRetries) {
          const delay = cfg.geminiRetryBaseMs * 2 ** attempt;
          if (Date.now() + delay < (deadline ?? Infinity)) {
            try { await sleep(delay, signal); } catch (x) { throw classifyLlmError(x, signal); }
            continue;
          }
        }
        if (i < models.length - 1 && (err.code === "LLM_BUSY" || err.code === "LLM_QUOTA")) break; // ke model cadangan
        throw err;
      }
    }
  }
}

/**
 * Mengembalikan teks JSON mentah dari Gemini (parse dan validasi dilakukan pemanggil).
 * images: [{ data: Buffer, mimeType }]. jsonSchema: JSON Schema (responseJsonSchema) bila ada.
 * client: untuk uji (mock); bawaannya klien Gemini aplikasi.
 */
export async function generateStructured(
  { system, userText, images = [], jsonSchema, temperature = 0.2, timeoutMs = env.geminiTimeoutMs, model = env.geminiModel },
  client = null,
  opts = {}, // [REVISI] uji: { cfg, sleep }
) {
  const signal = AbortSignal.timeout(timeoutMs);
  const parts = [
    ...images.map((im) => ({ inlineData: { mimeType: im.mimeType, data: Buffer.from(im.data).toString("base64") } })),
    { text: userText },
  ];
  const config = { systemInstruction: system, temperature, responseMimeType: "application/json", abortSignal: signal };
  if (jsonSchema) config.responseJsonSchema = jsonSchema;
  try {
    const res = await callGemini(
      (m) => (client ?? gemini()).models.generateContent({ model: m, contents: [{ role: "user", parts }], config }),
      { model, signal, deadline: Date.now() + timeoutMs, ...opts },
    );
    const text = res.text?.trim();
    if (!text) throw new LlmError(502, "LLM_EMPTY", "Layanan AI tidak memberi jawaban. Coba ulangi.");
    return text;
  } catch (e) {
    if (e instanceof HttpError && !(e instanceof LlmError)) throw e; // mis. 503 kunci belum diisi
    const err = classifyLlmError(e, signal); // galat panggilan sudah dilog di callGemini
    if (!(e instanceof LlmError)) logGeminiError(e);
    throw err;
  }
}
