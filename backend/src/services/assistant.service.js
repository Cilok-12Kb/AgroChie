import { prisma } from "../config/prisma.js";
import { HttpError } from "../utils/http-error.js";
import { retrieve } from "./rag/retriever.js";
import { buildSystemPrompt, describeFarmer } from "./rag/prompt.js";
import { generateAnswer } from "./llm.service.js";
import { buildTools } from "./assistant-tools.js"; // [REVISI]
import { redactPlan } from "../utils/money-gate.js"; // [REVISI] 18.11

const HISTORY_MESSAGES = 6; // 3 putaran tanya-jawab terakhir
const MAX_CHARS = 1000;

/** Data milik pengguna ini saja. Musim yang bukan miliknya dijawab 404. */
async function farmerContext(userId, seasonId, farmId) {
  if (seasonId) {
    const season = await prisma.season.findFirst({ where: { id: seasonId, farm: { userId } }, include: { farm: true } });
    if (!season) throw new HttpError(404, "Musim tidak ditemukan");
    const latest = await prisma.costPlan.findFirst({ where: { seasonId }, orderBy: { createdAt: "desc" } });
    const plan = redactPlan(season.status, latest); // [REVISI] 18.11: gerbang uang; DRAFT -> angka prediksi tidak masuk jawaban
    return { farm: season.farm, season, plan };
  }
  if (farmId) { // [REVISI] lahan aktif dari frontend; milik orang lain -> 404
    const farm = await prisma.farm.findFirst({ where: { id: String(farmId), userId } });
    if (!farm) throw new HttpError(404, "Lahan tidak ditemukan");
    return { farm, season: null, plan: null };
  }
  const farm = await prisma.farm.findFirst({ where: { userId }, orderBy: { id: "asc" } });
  return { farm, season: null, plan: null };
}

export async function chat(userId, { sessionId, seasonId, farmId, message } = {}) {
  const text = String(message ?? "").trim();
  if (!text) throw new HttpError(400, "Pertanyaan kosong");
  if (text.length > MAX_CHARS) throw new HttpError(400, `Pertanyaan terlalu panjang (maksimal ${MAX_CHARS} karakter)`);

  const ctx = await farmerContext(userId, seasonId, farmId);

  let session = null;
  let history = [];
  if (sessionId) {
    session = await prisma.chatSession.findFirst({ where: { id: sessionId, userId } });
    if (!session) throw new HttpError(404, "Sesi percakapan tidak ditemukan");
    const recent = await prisma.chatMessage.findMany({
      where: { sessionId }, orderBy: { createdAt: "desc" }, take: HISTORY_MESSAGES,
    });
    history = recent.reverse();
  }

  // pertanyaan lanjutan ("kalau minggu ke-5?") butuh konteks: gabungkan dengan pertanyaan sebelumnya
  const lastUser = [...history].reverse().find((m) => m.role === "USER");
  const chunks = await retrieve([lastUser?.content, text].filter(Boolean).join("\n"));

  const system = buildSystemPrompt({ chunks, farmerText: describeFarmer(ctx), farmId: ctx.farm?.id }); // [REVISI] lahan_id untuk alat cuaca
  const answer = await generateAnswer({ system, history, userText: text, tools: ctx.farm ? buildTools(userId) : undefined });


  // simpan SETELAH jawaban berhasil, agar riwayat selalu berpasangan (Gemini mewajibkan giliran bergantian)
  session ??= await prisma.chatSession.create({
    data: { userId, seasonId: ctx.season?.id ?? null, title: text.slice(0, 60) },
  });
  const sources = chunks.map(({ source, title, score }) => ({ source, title, score: Number(score.toFixed(3)) }));
  const t = Date.now(); // waktu eksplisit: dua baris dalam satu transaksi bisa bertanda waktu sama
  await prisma.$transaction([
    prisma.chatMessage.create({ data: { sessionId: session.id, role: "USER", content: text, createdAt: new Date(t) } }),
    prisma.chatMessage.create({
      data: { sessionId: session.id, role: "ASSISTANT", content: answer, sources, createdAt: new Date(t + 1) },
    }),
  ]);
  return { sessionId: session.id, answer, sources };
}

export async function getSession(userId, id) {
  const session = await prisma.chatSession.findFirst({
    where: { id, userId },
    include: { messages: { orderBy: { createdAt: "asc" } } },
  });
  if (!session) throw new HttpError(404, "Sesi percakapan tidak ditemukan");
  return session;
}