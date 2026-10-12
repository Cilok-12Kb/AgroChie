import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { farmObject } from "../validators/farm.validator.js";
import { HttpError } from "../utils/http-error.js";
import { engineCost, engineLeaf } from "./engine.service.js";
import { toEngineInput, checkLeafCrop } from "../utils/engine-input.js";

// [REVISI] 18.5: aturan capitalJt dipakai ulang dari farmObject (Decimal tidak negatif, maks 2 desimal; null = kosong).
const capitalSchema = farmObject.shape.capitalJt;

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
// [REVISI] 18.5: capitalJt opsional (tidak dikirim -> Season.capitalJt; null -> kosong, tidak ditebak).
// Decimal, bukan Number. Masukan engine disimpan di CostPlan.input. breakEvenPerKg tetap null (Q10).
// Hanya dari DRAFT; financingStoppedAt dikosongkan.
export async function startFinancing(userId, seasonId, body = {}) {
  const sent = body.capitalJt !== undefined;
  const parsed = capitalSchema.safeParse(body.capitalJt);
  if (sent && !parsed.success) throw new HttpError(400, parsed.error.issues.map((i) => i.message).join("; "));

  const season = await ownedSeason(userId, seasonId);
  if (season.status !== "DRAFT") throw new HttpError(409, "Pembiayaan sudah dimulai untuk musim ini");
  const capital = sent ? parsed.data : season.capitalJt;
  const capitalDec = capital == null ? null : new Prisma.Decimal(capital);

  const { input, output, modelVersion } = await runCost(season, body);
  const { low, mid, high } = output.total_jt;
  const midDec = new Prisma.Decimal(mid);
  // Modal kosong: kekurangan tidak bisa dihitung; kolom wajib diisi 0 (bukan perkiraan).
  const shortfall = capitalDec == null ? new Prisma.Decimal(0) : Prisma.Decimal.max(0, midDec.minus(capitalDec));

  const plan = await prisma.$transaction(async (tx) => {
    const moved = await tx.season.updateMany({
      where: { id: seasonId, status: "DRAFT" },
      data: { status: "PEMBIAYAAN", financingStartedAt: new Date(), financingStoppedAt: null, ...(sent ? { capitalJt: capitalDec } : {}) },
    });
    if (moved.count !== 1) throw new HttpError(409, "Pembiayaan sudah dimulai untuk musim ini");
    await tx.predictionLog.create({ data: { seasonId, input, output, modelVersion } });
    return tx.costPlan.create({
      data: {
        seasonId, kind: "AWAL", totalJt: midDec, p10Jt: low, p50Jt: mid, p90Jt: high, capitalJt: capitalDec,
        shortfallJt: shortfall, breakEvenPerKg: null, weeklyJt: output.weekly, input, modelVersion,
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