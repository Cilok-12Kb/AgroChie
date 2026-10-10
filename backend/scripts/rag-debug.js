// Pemakaian: node scripts/rag-debug.js "kapan pupuk dasar diberikan"
import { prisma } from "../src/config/prisma.js";
import { retrieve } from "../src/services/rag/retriever.js";

const q = process.argv.slice(2).join(" ");
if (!q) throw new Error('Tulis pertanyaannya: node scripts/rag-debug.js "pertanyaan"');

try {
  const hits = await retrieve(q, { k: 6, minScore: 0 }); // tanpa ambang, untuk melihat sebaran skor
  for (const h of hits) console.log(h.score.toFixed(3), h.source, "|", h.title);
} finally {
  await prisma.$disconnect();
}