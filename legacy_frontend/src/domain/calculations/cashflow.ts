import type { Expense, MoneyIDR, PredictionResult } from '@/domain/models/types';

/**
 * Hitung total pengeluaran aktual (hanya origin=actual).
 */
export function computeActualTotal(expenses: Expense[]): MoneyIDR {
  return expenses
    .filter((e) => e.origin === 'actual')
    .reduce((sum, e) => sum + e.amountIdr, 0);
}

/**
 * Hitung pengeluaran aktual per kategori.
 */
export function computeActualByCategory(expenses: Expense[]): Record<string, MoneyIDR> {
  return expenses
    .filter((e) => e.origin === 'actual')
    .reduce<Record<string, MoneyIDR>>((acc, e) => {
      acc[e.category] = (acc[e.category] ?? 0) + e.amountIdr;
      return acc;
    }, {});
}

/**
 * Hitung pengeluaran aktual per minggu.
 */
export function computeActualByWeek(expenses: Expense[]): Record<number, MoneyIDR> {
  return expenses
    .filter((e) => e.origin === 'actual' && e.weekNumber !== undefined)
    .reduce<Record<number, MoneyIDR>>((acc, e) => {
      const week = e.weekNumber!;
      acc[week] = (acc[week] ?? 0) + e.amountIdr;
      return acc;
    }, {});
}

/**
 * Hitung selisih modal: negatif = kurang modal, positif = cukup.
 */
export function computeCapitalGap(
  availableCapitalIdr: MoneyIDR,
  prediction: PredictionResult
): MoneyIDR {
  return availableCapitalIdr - prediction.p50Idr;
}

/**
 * Hitung kumulatif kebutuhan modal per minggu.
 */
export function computeCumulativeCashflow(
  prediction: PredictionResult,
  availableCapitalIdr: MoneyIDR
): Array<{
  week: number;
  planned: MoneyIDR;
  cumulativePlanned: MoneyIDR;
  capitalRemaining: MoneyIDR;
  phase: string;
}> {
  let cumulative = 0;
  return prediction.weekly.map(({ week, plannedIdr, phase }) => {
    cumulative += plannedIdr;
    return {
      week,
      planned: plannedIdr,
      cumulativePlanned: cumulative,
      capitalRemaining: availableCapitalIdr - cumulative,
      phase,
    };
  });
}

/**
 * Temukan minggu pertama di mana modal diperkirakan tidak mencukupi.
 * Returns null jika modal cukup seluruh musim.
 */
export function findCapitalShortfallWeek(
  prediction: PredictionResult,
  availableCapitalIdr: MoneyIDR
): number | null {
  const cashflow = computeCumulativeCashflow(prediction, availableCapitalIdr);
  const shortfall = cashflow.find((c) => c.capitalRemaining < 0);
  return shortfall ? shortfall.week : null;
}

/**
 * Hitung rencana biaya per fase dari prediksi.
 */
export function computePhaseBudget(
  prediction: PredictionResult
): Record<string, MoneyIDR> {
  return prediction.weekly.reduce<Record<string, MoneyIDR>>((acc, { plannedIdr, phase }) => {
    acc[phase] = (acc[phase] ?? 0) + plannedIdr;
    return acc;
  }, {});
}

/**
 * Hitung harga impas per kg.
 * breakEvenPrice = totalCost / estimatedYieldKg
 */
export function computeBreakEvenPrice(
  totalCostIdr: MoneyIDR,
  estimatedYieldKg: number
): MoneyIDR {
  if (estimatedYieldKg <= 0) return 0;
  return Math.round(totalCostIdr / estimatedYieldKg);
}

/**
 * Perkiraan laba/rugi dari skenario harga jual.
 */
export function computeProfitScenario(
  totalCostIdr: MoneyIDR,
  estimatedYieldKg: number,
  salePricePerKgIdr: MoneyIDR
): { revenueIdr: MoneyIDR; profitIdr: MoneyIDR; profitPct: number } {
  const revenueIdr = estimatedYieldKg * salePricePerKgIdr;
  const profitIdr = revenueIdr - totalCostIdr;
  const profitPct = totalCostIdr > 0 ? profitIdr / totalCostIdr : 0;
  return { revenueIdr, profitIdr, profitPct };
}
