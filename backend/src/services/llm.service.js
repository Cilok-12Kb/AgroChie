import { gemini } from "../config/gemini.js";
import { env } from "../config/env.js";
import { HttpError } from "../utils/http-error.js";

const MAX_TOOL_ROUNDS = 3; // [REVISI] batas putaran pemanggilan fungsi agar tidak berulang tanpa akhir

/**
 * history: pesan tersimpan berurutan lama ke baru ({role: "USER"|"ASSISTANT", content}).
 * [REVISI] tools (opsional): { declarations: [FunctionDeclaration], handlers: { nama: async (args) => objek } }.
 * Galat di handler dikembalikan ke Gemini sebagai { error } agar dijawab jujur, bukan dikarang.
 */
export async function generateAnswer({ system, history, userText, tools }) {
  const contents = [
    ...history.map((m) => ({ role: m.role === "USER" ? "user" : "model", parts: [{ text: m.content }] })),
    { role: "user", parts: [{ text: userText }] },
  ];
  const config = { systemInstruction: system, temperature: 0.3 };
  if (tools?.declarations?.length) config.tools = [{ functionDeclarations: tools.declarations }];
  try {
    let res;
    for (let round = 0; ; round++) {
      res = await gemini().models.generateContent({ model: env.geminiModel, contents, config });
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
    console.error('[gemini-debug]', err?.status, String(err?.message).slice(0, 500));
    if (e?.status === 429) throw new HttpError(503, "Asisten sedang sibuk. Coba lagi sebentar lagi.");
    throw new HttpError(502, "Asisten tidak dapat dihubungi");
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

export function classifyLlmError(e, signal) {
  if (e instanceof LlmError) return e;
  if (signal?.aborted || e?.name === "TimeoutError" || e?.name === "AbortError") {
    return new LlmError(504, "LLM_TIMEOUT", "Analisis AI melewati batas waktu. Coba lagi sebentar lagi.");
  }
  if (e?.status === 429 || /RESOURCE_EXHAUSTED|quota/i.test(String(e?.message ?? ""))) {
    return new LlmError(503, "LLM_QUOTA", "Kuota layanan AI sedang habis atau penuh. Coba lagi nanti.");
  }
  return new LlmError(502, "LLM_ERROR", "Layanan AI tidak dapat dihubungi");
}

/**
 * Mengembalikan teks JSON mentah dari Gemini (parse dan validasi dilakukan pemanggil).
 * images: [{ data: Buffer, mimeType }]. jsonSchema: JSON Schema (responseJsonSchema) bila ada.
 * client: untuk uji (mock); bawaannya klien Gemini aplikasi.
 */
export async function generateStructured(
  { system, userText, images = [], jsonSchema, temperature = 0.2, timeoutMs = env.geminiTimeoutMs, model = env.geminiModel },
  client = null,
) {
  const signal = AbortSignal.timeout(timeoutMs);
  const parts = [
    ...images.map((im) => ({ inlineData: { mimeType: im.mimeType, data: Buffer.from(im.data).toString("base64") } })),
    { text: userText },
  ];
  const config = { systemInstruction: system, temperature, responseMimeType: "application/json", abortSignal: signal };
  if (jsonSchema) config.responseJsonSchema = jsonSchema;
  try {
    const res = await (client ?? gemini()).models.generateContent({ model, contents: [{ role: "user", parts }], config });
    const text = res.text?.trim();
    if (!text) throw new LlmError(502, "LLM_EMPTY", "Layanan AI tidak memberi jawaban. Coba ulangi.");
    return text;
  } catch (e) {
    if (e instanceof HttpError && !(e instanceof LlmError)) throw e; // mis. 503 kunci belum diisi
    const err = classifyLlmError(e, signal);
    console.error("[gemini]", err.code, e?.status ?? "", e?.name ?? ""); // tanpa isi pesan/gambar
    throw err;
  }
}
