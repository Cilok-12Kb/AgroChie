import { fileURLToPath } from "node:url";
import { prisma } from "../src/config/prisma.js";
import { ingestKnowledge } from "../src/services/rag/ingest.js";

const dir = fileURLToPath(new URL("../knowledge/", import.meta.url));

try {
  const s = await ingestKnowledge(dir);
  console.log(`Selesai: ${s.embedded} berkas diproses (${s.chunks} potongan), ${s.skipped} dilewati`);
} finally {
  await prisma.$disconnect();
}