import { env } from "../config/env.js";
import { HttpError } from "../utils/http-error.js";

/** Ringkas galat validasi FastAPI ({detail:[{loc,msg}]}) menjadi satu kalimat. */
export function summarize422(body) {
  const items = Array.isArray(body?.detail) ? body.detail : [];
  if (!items.length) return "format tidak sesuai";
  return items
    .slice(0, 3)
    .map((d) => `${(d.loc ?? []).slice(1).join(".") || "masukan"}: ${d.msg}`)
    .join("; ");
}

async function call(path, body, timeoutMs = 15_000) {
  if (!env.engineKey) throw new HttpError(503, "ENGINE_INTERNAL_KEY belum diisi di backend/.env");

  let res;
  try {
    res = await fetch(`${env.engineUrl}${path}`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-key": env.engineKey },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(timeoutMs),
    });
  } catch {
    throw new HttpError(503, "Mesin prediksi tidak dapat dihubungi. Pastikan engine menyala.");
  }

  if (res.ok) return res.json();
  if (res.status === 422) throw new HttpError(400, "Masukan ditolak engine: " + summarize422(await res.json().catch(() => null)));
  if (res.status === 503) throw new HttpError(503, "Model belum dimuat di engine");
  console.error("[engine]", res.status, await res.text().catch(() => ""));
  throw new HttpError(502, "Engine mengembalikan galat"); // termasuk 401: kunci backend dan engine berbeda
}

export const engineCost = (input) => call("/predict/cost", input);
export const engineLeaf = (imageBase64) => call("/predict/leaf", { image_base64: imageBase64 }, 30_000);