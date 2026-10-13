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
    console.error("[gemini]", e?.status, e?.message);
    if (e?.status === 429) throw new HttpError(503, "Asisten sedang sibuk. Coba lagi sebentar lagi.");
    throw new HttpError(502, "Asisten tidak dapat dihubungi");
  }
}