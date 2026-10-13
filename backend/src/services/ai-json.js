import { LlmError } from "./llm.service.js";

// [REVISI] Deteksi tanaman: parse + validasi keluaran JSON AI, dengan retry terbatas. Tidak pernah memalsukan hasil.

/** Parse JSON dari teks AI; toleran terhadap pagar kode ```json. Melempar SyntaxError bila bukan JSON. */
export function parseJsonText(text) {
  const t = String(text ?? "").trim().replace(/^```(?:json)?\s*/i, "").replace(/\s*```$/, "");
  return JSON.parse(t);
}

/**
 * Memanggil `call()` (mengembalikan teks JSON), mem-parse, memvalidasi dengan zod `schema`, lalu `check(data)`
 * (opsional; melempar Error bila tidak lolos). Gagal parse/validasi -> ulang sekali, lalu LlmError AI_INVALID_OUTPUT.
 * Galat LlmError dari `call` (kuota, timeout, dll.) langsung diteruskan tanpa retry.
 */
export async function generateValidated({ call, schema, check, label = "AI", attempts = 2 }) {
  let lastReason = "";
  for (let i = 0; i < attempts; i++) {
    const text = await call(i);
    try {
      const parsed = schema.safeParse(parseJsonText(text));
      if (!parsed.success) throw new Error(parsed.error.issues.map((x) => `${x.path.join(".")}: ${x.message}`).join("; "));
      return check ? check(parsed.data) ?? parsed.data : parsed.data;
    } catch (e) {
      lastReason = e instanceof SyntaxError ? "bukan JSON valid" : String(e?.message ?? e).slice(0, 300);
      console.error(`[${label}] keluaran tidak valid (percobaan ${i + 1}/${attempts}): ${lastReason}`);
    }
  }
  throw new LlmError(502, "AI_INVALID_OUTPUT", `Hasil analisis AI tidak valid setelah ${attempts} percobaan. Coba ulangi beberapa saat lagi.`);
}
