import { Prisma } from "@prisma/client";

/** Db palsu di memori untuk tes deteksi: meniru bagian Prisma yang dipakai plant-detection.service. Tanpa database. */
export function makeFakeDb({ farms = [], seasons = [] } = {}) {
  const detections = [];
  const expenses = [];
  let n = 0;
  const match = (row, where = {}) =>
    Object.entries(where).every(([k, v]) => {
      if (k === "farm") return farms.find((f) => f.id === row.farmId && Object.entries(v).every(([a, b]) => f[a] === b));
      if (v && typeof v === "object" && "not" in v) return row[k] !== v.not;
      return row[k] === v;
    });
  const db = {
    detections,
    expenses,
    farm: { findFirst: async ({ where }) => farms.find((f) => match(f, where)) ?? null },
    season: { findFirst: async ({ where }) => seasons.find((s) => match(s, where)) ?? null },
    plantDetection: {
      create: async ({ data }) => {
        const row = { id: `det${++n}`, createdAt: new Date(2026, 9, 13, 8, 0, n), expenseId: null, solution: null, costMinJt: null, costMaxJt: null, ...data };
        detections.push(row);
        return row;
      },
      findFirst: async ({ where }) => detections.find((d) => match(d, where)) ?? null,
      count: async ({ where }) => detections.filter((d) => match(d, where)).length,
      findMany: async ({ where, skip = 0, take = 10 }) =>
        detections.filter((d) => match(d, where)).sort((a, b) => b.createdAt - a.createdAt).slice(skip, skip + take),
      updateMany: async ({ where, data }) => {
        const rows = detections.filter((d) => match(d, where));
        rows.forEach((r) => Object.assign(r, data));
        return { count: rows.length };
      },
    },
    expense: {
      create: async ({ data }) => {
        const row = { id: `exp${++n}`, ...data, amountJt: new Prisma.Decimal(data.amountJt) };
        expenses.push(row);
        return row;
      },
    },
    // transaksi sederhana: bila callback melempar, Expense yang dibuat di dalamnya dibatalkan
    $transaction: async (fn) => {
      const before = expenses.length;
      try {
        return await fn(db);
      } catch (e) {
        expenses.length = before;
        throw e;
      }
    },
  };
  return db;
}
