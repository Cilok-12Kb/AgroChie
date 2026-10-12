import type { Crop } from '@/domain/models/types';

// ============================================================
// Durasi dan fase musim tanam (dari dataset)
// ============================================================

/** Durasi total per komoditas dalam minggu */
export const CROP_DURATION: Record<Crop, number> = {
  cabai: 16,
  tomat: 14,
  bawang: 10,
};

/** Nama fase */
export type PhaseName = 'persiapan' | 'penanaman' | 'perawatan' | 'panen';

/** Durasi fase dalam minggu per komoditas */
export const CROP_PHASES: Record<Crop, Record<PhaseName, number>> = {
  cabai: { persiapan: 2, penanaman: 2, perawatan: 8, panen: 4 },
  tomat: { persiapan: 2, penanaman: 2, perawatan: 7, panen: 3 },
  bawang: { persiapan: 2, penanaman: 1, perawatan: 5, panen: 2 },
};

/** Bobot alokasi biaya per fase (baseline) */
export const PHASE_COST_WEIGHTS: Record<PhaseName, number> = {
  persiapan: 0.19,
  penanaman: 0.16,
  perawatan: 0.50,
  panen: 0.15,
};

/** Label fase */
export const PHASE_LABELS: Record<PhaseName, string> = {
  persiapan: 'Persiapan lahan',
  penanaman: 'Penanaman',
  perawatan: 'Perawatan',
  panen: 'Panen dan pascapanen',
};

const ORDERED_PHASES: PhaseName[] = ['persiapan', 'penanaman', 'perawatan', 'panen'];

/**
 * Tentukan fase dari nomor minggu.
 * Week 1 = minggu pertama termasuk persiapan lahan.
 */
export function getPhaseForWeek(crop: Crop, week: number): PhaseName {
  const phases = CROP_PHASES[crop];
  let accumulated = 0;
  for (const phase of ORDERED_PHASES) {
    accumulated += phases[phase];
    if (week <= accumulated) return phase;
  }
  return 'panen'; // fallback
}

/**
 * Nomor minggu dalam fase.
 */
export function getWeekInPhase(crop: Crop, week: number): number {
  const phases = CROP_PHASES[crop];
  let accumulated = 0;
  for (const phase of ORDERED_PHASES) {
    const prevAccumulated = accumulated;
    accumulated += phases[phase];
    if (week <= accumulated) return week - prevAccumulated;
  }
  return week;
}

/**
 * Hitung tanggal berdasarkan minggu ke-n dari tanggal mulai.
 */
export function getWeekStartDate(plantingStartDate: string, week: number): Date {
  const start = new Date(plantingStartDate);
  const result = new Date(start);
  result.setDate(start.getDate() + (week - 1) * 7);
  return result;
}

/**
 * Hitung nomor minggu dari tanggal transaksi relatif ke tanggal mulai.
 * Transaksi sebelum mulai → minggu 1
 * Transaksi setelah akhir → minggu terakhir
 */
export function getWeekNumberFromDate(
  plantingStartDate: string,
  transactionDate: string,
  crop: Crop
): number {
  const start = new Date(plantingStartDate);
  const txDate = new Date(transactionDate);
  const duration = CROP_DURATION[crop];

  if (txDate < start) return 1;

  const diffDays = Math.floor((txDate.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const week = Math.floor(diffDays / 7) + 1;

  return Math.min(Math.max(1, week), duration);
}

/**
 * Minggu yang sedang berjalan dari tanggal hari ini.
 */
export function getCurrentWeek(plantingStartDate: string, crop: Crop): number {
  return getWeekNumberFromDate(plantingStartDate, new Date().toISOString().slice(0, 10), crop);
}
