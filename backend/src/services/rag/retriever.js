import { prisma } from "../../config/prisma.js";
import { env, embedTag } from "../../config/env.js";
import { embedQuery } from "./embedder.js";
import { topK } from "./similarity.js";

const TTL_MS = 5 * 60_000; // basis pengetahuan kecil: cukup disimpan di memori
let cache = { at: 0, tag: "", items: [] };

async function load() {
  const tag = embedTag();
  if (cache.tag !== tag || Date.now() - cache.at > TTL_MS) {
    const items = await prisma.knowledgeChunk.findMany({
      where: { embedModel: tag },
      select: { source: true, title: true, content: true, embedding: true },
    });
    cache = { at: Date.now(), tag, items };
  }
  return cache.items;
}

export const clearRetrieverCache = () => { cache = { at: 0, tag: "", items: [] }; };

/** Potongan dokumen paling relevan untuk pertanyaan. Kosong bila tidak ada yang cukup mirip. */
export async function retrieve(question, { k = 4, minScore = env.ragMinScore } = {}) {
  const items = await load();
  if (!items.length) return [];
  return topK(await embedQuery(question), items, { k, minScore });
}