import { createHash } from "node:crypto";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { prisma } from "../../config/prisma.js";
import { embedTag } from "../../config/env.js";
import { chunkMarkdown } from "./chunker.js";
import { embedDocuments } from "./embedder.js";

const sha256 = (s) => createHash("sha256").update(s).digest("hex");

/** Baca semua .md di folder, pecah, embed, lalu simpan. Berkas yang tidak berubah dilewati. */
export async function ingestKnowledge(dir, log = console.log) {
  const files = (await readdir(dir)).filter((f) => f.endsWith(".md")).sort();
  if (!files.length) throw new Error(`Tidak ada berkas .md di ${dir}`);
  const tag = embedTag();
  const stats = { embedded: 0, skipped: 0, chunks: 0 };

  for (const f of files) {
    const text = await readFile(join(dir, f), "utf8");
    const sourceHash = sha256(`${tag}\n${text}`); // ganti model/dimensi => dianggap berubah
    const existing = await prisma.knowledgeChunk.findFirst({ where: { source: f }, select: { sourceHash: true } });
    if (existing?.sourceHash === sourceHash) {
      log(`lewati (tidak berubah): ${f}`);
      stats.skipped++;
      continue;
    }
    const chunks = chunkMarkdown(text);
    const vectors = await embedDocuments(chunks.map((c) => c.content));
    await prisma.$transaction([
      prisma.knowledgeChunk.deleteMany({ where: { source: f } }),
      prisma.knowledgeChunk.createMany({
        data: chunks.map((c, i) => ({
          source: f, title: c.title, position: c.position, content: c.content,
          embedding: vectors[i], embedModel: tag, sourceHash,
        })),
      }),
    ]);
    log(`${f}: ${chunks.length} potongan`);
    stats.embedded++;
    stats.chunks += chunks.length;
  }

  const gone = await prisma.knowledgeChunk.deleteMany({ where: { source: { notIn: files } } });
  if (gone.count) log(`dihapus ${gone.count} potongan dari berkas yang sudah tidak ada`);
  return stats;
}