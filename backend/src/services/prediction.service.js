import { prisma } from "../config/prisma.js";
import { HttpError } from "../utils/http-error.js";
import { engineCost, engineLeaf } from "./engine.service.js";
import { toEngineInput, checkLeafCrop } from "../utils/engine-input.js";

/** Musim harus milik pengguna yang login; selain itu dijawab 404 (tidak membocorkan keberadaannya). */
async function ownedSeason(userId, seasonId) {
  const season = await prisma.season.findFirst({ where: { id: seasonId, farm: { userId } }, include: { farm: true } });
  if (!season) throw new HttpError(404, "Musim tidak ditemukan");
  return season;
}

async function runCost(season, body) {
  const input = toEngineInput({
    farm: season.farm, season, weather: body.weather, indices: body.indices, startMonth: body.startMonth,
  });
  const output = await engineCost(input);
  return { input, output, modelVersion: `${output.models.season} + ${output.models.weekly}` };
}

/** Prediksi biasa (misalnya skenario "bagaimana kalau"). Dicatat di prediction_logs, tidak mengubah musim. */
export async function predictCost(userId, seasonId, body = {}) {
  const season = await ownedSeason(userId, seasonId);
  const { input, output, modelVersion } = await runCost(season, body);
  await prisma.predictionLog.create({ data: { seasonId, input, output, modelVersion } });
  return output;
}

/** Tombol Mulai: hitung, simpan potret rencana biaya (CostPlan), dan ubah status musim. */
export async function startFinancing(userId, seasonId, body = {}) {
  const capitalJt = Number(body.capitalJt);
  if (!Number.isFinite(capitalJt) || capitalJt < 0) throw new HttpError(400, "Modal harus berupa angka (juta Rupiah)");

  const season = await ownedSeason(userId, seasonId);
  if (season.status !== "DRAFT") throw new HttpError(409, "Pembiayaan sudah dimulai untuk musim ini");

  const { input, output, modelVersion } = await runCost(season, body);
  const { low, mid, high } = output.total_jt;

  const plan = await prisma.$transaction(async (tx) => {
    await tx.predictionLog.create({ data: { seasonId, input, output, modelVersion } });
    await tx.season.update({
      where: { id: seasonId },
      data: { status: "PEMBIAYAAN", financingStartedAt: new Date(), capitalJt },
    });
    return tx.costPlan.create({
      data: {
        seasonId, kind: "AWAL", totalJt: mid, p10Jt: low, p50Jt: mid, p90Jt: high, capitalJt,
        shortfallJt: Math.max(0, mid - capitalJt), // samakan aturan ini dengan hitungan di prototipe
        weeklyJt: output.weekly, modelVersion,
      },
    });
  });
  return { plan, output };
}

/** Kualitas tanaman dari foto daun. Foto tidak disimpan di sini (hanya dikirim ke engine). */
export async function predictLeaf({ imageBase64, crop }) {
  const b64 = String(imageBase64 ?? "").replace(/^data:image\/[a-z+]+;base64,/i, "");
  if (b64.length < 100) throw new HttpError(400, "Foto tidak valid");
  if (b64.length > 7_000_000) throw new HttpError(413, "Foto terlalu besar (maksimal sekitar 5 MB)");
  if (crop != null && !["CABAI", "TOMAT"].includes(crop)) throw new HttpError(400, "Tanaman harus CABAI atau TOMAT");
  return checkLeafCrop(await engineLeaf(b64), crop);
}