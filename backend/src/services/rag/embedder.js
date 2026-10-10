import { gemini } from "../../config/gemini.js";
import { env } from "../../config/env.js";
import { HttpError } from "../../utils/http-error.js";
import { normalize } from "./similarity.js";

const BATCH = 20;

async function embed(texts, taskType) {
  const out = [];
  for (let i = 0; i < texts.length; i += BATCH) {
    const batch = texts.slice(i, i + BATCH);
    let res;
    try {
      res = await gemini().models.embedContent({
        model: env.geminiEmbedModel,
        contents: batch,
        config: { taskType, outputDimensionality: env.embedDims },
      });
    } catch (e) {
      if (e instanceof HttpError) throw e;
      console.error("[embed]", e?.status, e?.message);
      throw new HttpError(e?.status === 429 ? 503 : 502, "Layanan embedding tidak tersedia. Coba lagi nanti.");
    }
    if (res.embeddings?.length !== batch.length) throw new HttpError(502, "Jumlah embedding tidak sesuai");
    // gemini-embedding-001 hanya menormalkan keluaran 3072 dimensi; kita normalkan sendiri
    out.push(...res.embeddings.map((e) => normalize(e.values)));
  }
  return out;
}

export const embedDocuments = (texts) => embed(texts, "RETRIEVAL_DOCUMENT");
export const embedQuery = async (text) => (await embed([text], "RETRIEVAL_QUERY"))[0];