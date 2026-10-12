import { Prisma } from "@prisma/client";
import { prisma } from "../config/prisma.js";
import { HttpError } from "../utils/http-error.js";
import { catFrac, CATEGORY_INDEX, currentWeek } from "../utils/season-flow.js";
import { todayWib } from "../validators/season.validator.js";

// [REVISI] 18.8: catatan pengeluaran (F7). Semua rupiah Decimal (juta Rupiah), diserialisasi sebagai string.
export const WARN_RATIO = new Prisma.Decimal("1.15"); // peringatan bila kenyataan > 115% rencana (tepat 15% belum)

const NOT_FOUND = "Musim tidak ditemukan";

async function ownedSeason(userId, id) {
  const season = await prisma.season.findFirst({ where: { id, farm: { userId } } });
  if (!season) throw new HttpError(404, NOT_FOUND);
  return season;
}

export async function addExpense(userId, seasonId, data) {
  const season = await ownedSeason(userId, seasonId);
  if (season.status === "SELESAI") throw new HttpError(409, "Musim yang sudah selesai tidak bisa diubah");
  return prisma.expense.create({
    data: { seasonId, category: data.category, amountJt: new Prisma.Decimal(data.amountJt), spentOn: data.spentOn, note: data.note ?? null },
  });
}

export async function listExpenses(userId, seasonId) {
  await ownedSeason(userId, seasonId);
  return prisma.expense.findMany({ where: { seasonId }, orderBy: [{ spentOn: "asc" }, { createdAt: "asc" }] });
}

export async function deleteExpense(userId, seasonId, expenseId) {
  const season = await ownedSeason(userId, seasonId);
  const exp = await prisma.expense.findFirst({ where: { id: expenseId, seasonId } });
  if (!exp) throw new HttpError(404, "Pengeluaran tidak ditemukan");
  if (season.status === "SELESAI") throw new HttpError(409, "Musim yang sudah selesai tidak bisa diubah");
  const r = await prisma.expense.deleteMany({ where: { id: expenseId, seasonId } });
  if (r.count !== 1) throw new HttpError(404, "Pengeluaran tidak ditemukan");
  return { deleted: true };
}

const warns = (plan, actual) => actual.gt(plan.mul(WARN_RATIO));

/**
 * Rencana vs kenyataan per kategori. Rencana = kumulatif weeklyJt (CostPlan terbaru) sampai minggu berjalan x catFrac.
 * Rencana null bila belum ada CostPlan, belum tanam, atau weeklyJt kosong (tidak menebak). Catatan simulasi tidak dihitung.
 */
export async function expenseSummary(userId, seasonId, now = new Date()) {
  const season = await ownedSeason(userId, seasonId);
  const [rows, plan] = await Promise.all([
    prisma.expense.findMany({ where: { seasonId, simulated: false }, select: { category: true, amountJt: true } }),
    prisma.costPlan.findFirst({ where: { seasonId }, orderBy: { createdAt: "desc" }, select: { weeklyJt: true } }),
  ]);
  const actual = Object.fromEntries(Object.keys(CATEGORY_INDEX).map((k) => [k, new Prisma.Decimal(0)]));
  for (const r of rows) actual[r.category] = actual[r.category].plus(r.amountJt);

  const weekly = plan && Array.isArray(plan.weeklyJt) && plan.weeklyJt.length ? plan.weeklyJt : null;
  const week = season.plantedOn ? currentWeek(season.plantedOn, todayWib(now), season.crop) : null;
  let cumulative = null;
  if (weekly && week !== null) {
    cumulative = weekly.slice(0, week).reduce((s, v) => s.plus(new Prisma.Decimal(v)), new Prisma.Decimal(0));
  }

  let totalPlan = null;
  const categories = Object.entries(CATEGORY_INDEX).map(([category, idx]) => {
    const planJt = cumulative === null ? null : cumulative.mul(String(catFrac[idx]));
    if (planJt !== null) totalPlan = (totalPlan ?? new Prisma.Decimal(0)).plus(planJt);
    return { category, planJt, actualJt: actual[category], warning: planJt === null ? false : warns(planJt, actual[category]) };
  });
  const totalActual = categories.reduce((s, c) => s.plus(c.actualJt), new Prisma.Decimal(0));
  return {
    currentWeek: week,
    categories,
    total: { planJt: totalPlan, actualJt: totalActual, warning: totalPlan === null ? false : warns(totalPlan, totalActual) },
  };
}
