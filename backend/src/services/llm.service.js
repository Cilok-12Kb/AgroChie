import { gemini } from "../config/gemini.js";
import { env } from "../config/env.js";
import { HttpError } from "../utils/http-error.js";

/** history: pesan tersimpan berurutan lama ke baru ({role: "USER"|"ASSISTANT", content}). */
export async function generateAnswer({ system, history, userText }) {
  const contents = [
    ...history.map((m) => ({ role: m.role === "USER" ? "user" : "model", parts: [{ text: m.content }] })),
    { role: "user", parts: [{ text: userText }] },
  ];
  try {
    const res = await gemini().models.generateContent({
      model: env.geminiModel,
      contents,
      config: { systemInstruction: system, temperature: 0.3 },
    });
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