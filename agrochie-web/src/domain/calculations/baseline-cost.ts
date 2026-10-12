import type { Crop, Farm, NutrientLevel, PredictionResult } from '@/domain/models/types';
import {
  CROP_DURATION,
  CROP_PHASES,
  PHASE_COST_WEIGHTS,
  getPhaseForWeek,
  type PhaseName,
} from './seasons';

// ============================================================
// Baseline biaya per komoditas (dalam rupiah per hektar)
// ============================================================

const BASELINE_COST_PER_HA: Record<Crop, number> = {
  cabai: 85_000_000, // ~85 juta/ha
  tomat: 65_000_000, // ~65 juta/ha
  bawang: 55_000_000, // ~55 juta/ha
};

interface WeatherInput {
  avgRainMmPerWeek?: number;
  heavyRainWeeks?: number;
}

interface SoilInput {
  ph?: number;
  nitrogen?: NutrientLevel;
  phosphorus?: NutrientLevel;
  potassium?: NutrientLevel;
}

interface PriceInput {
  fertilizerPriceIndex?: number; // 1.0 = normal
  wagePriceIndex?: number;
  pesticidePriceIndex?: number;
}

interface BaselineCostInput {
  crop: Crop;
  areaHa: number;
  weather?: WeatherInput;
  soil?: SoilInput;
  prices?: PriceInput;
  availableCapitalIdr?: number;
  now?: Date;
}

function nutrientAdjustment(level?: NutrientLevel): number {
  if (level === 'rendah') return 0.08;
  if (level === 'tinggi') return -0.04;
  return 0;
}

function phAdjustment(ph?: number): number {
  if (ph === undefined) return 0;
  if (ph < 6.0) return 0.06; // perlu kapur dolomit lebih
  if (ph > 7.5) return 0.03;
  return 0;
}

/**
 * Hitung baseline biaya musim menggunakan aturan dan 500 iterasi Monte Carlo.
 * Ini adalah PERKIRAAN BERBASIS ATURAN, bukan prediksi model AI.
 */
export function computeBaselinePrediction(
  input: BaselineCostInput,
  seasonId: string
): PredictionResult {
  const { crop, areaHa, weather, soil, prices, availableCapitalIdr, now = new Date() } = input;

  const basePerHa = BASELINE_COST_PER_HA[crop];
  const baseCost = basePerHa * Math.min(areaHa, 3); // capped at 3 ha untuk model

  // Penyesuaian cuaca
  const avgRain = weather?.avgRainMmPerWeek ?? 40;
  const heavyRainWeeks = weather?.heavyRainWeeks ?? 0;
  const rainAdj = avgRain > 60 ? 0.08 : avgRain < 20 ? 0.04 : 0;
  const heavyRainAdj = heavyRainWeeks > 3 ? 0.06 : 0;

  // Penyesuaian tanah
  const phAdj = phAdjustment(soil?.ph);
  const nAdj = nutrientAdjustment(soil?.nitrogen);
  const pAdj = nutrientAdjustment(soil?.phosphorus);
  const kAdj = nutrientAdjustment(soil?.potassium);

  // Penyesuaian harga
  const ferAdj = ((prices?.fertilizerPriceIndex ?? 1) - 1) * 0.25;
  const wageAdj = ((prices?.wagePriceIndex ?? 1) - 1) * 0.30;
  const pesAdj = ((prices?.pesticidePriceIndex ?? 1) - 1) * 0.15;

  const totalAdjustment =
    1 + rainAdj + heavyRainAdj + phAdj + nAdj + pAdj + kAdj + ferAdj + wageAdj + pesAdj;

  const expectedCost = baseCost * totalAdjustment;

  // Monte Carlo sederhana 500 iterasi
  const iterations = 500;
  const samples: number[] = [];
  for (let i = 0; i < iterations; i++) {
    // Variasi acak normal ~±15%
    const variance = (Math.random() - 0.5) * 0.3;
    samples.push(expectedCost * (1 + variance));
  }
  samples.sort((a, b) => a - b);

  const p10 = Math.round(samples[Math.floor(iterations * 0.1)]);
  const p50 = Math.round(samples[Math.floor(iterations * 0.5)]);
  const p90 = Math.round(samples[Math.floor(iterations * 0.9)]);

  const overCapitalProb =
    availableCapitalIdr !== undefined
      ? samples.filter((s) => s > availableCapitalIdr).length / iterations
      : undefined;

  // Biaya mingguan per fase
  const duration = CROP_DURATION[crop];
  const weekly: PredictionResult['weekly'] = [];
  for (let w = 1; w <= duration; w++) {
    const phase = getPhaseForWeek(crop, w);
    const phaseDuration = CROP_PHASES[crop][phase as PhaseName];
    const phaseWeight = PHASE_COST_WEIGHTS[phase as PhaseName];
    weekly.push({
      week: w,
      plannedIdr: Math.round((p50 * phaseWeight) / phaseDuration),
      phase: phase,
    });
  }

  // Driver penjelasan
  const drivers: PredictionResult['drivers'] = [];
  if (rainAdj > 0) {
    drivers.push({
      label: 'Curah hujan tinggi',
      explanation: 'Hujan >60 mm/minggu meningkatkan risiko penyakit jamur dan kebutuhan fungisida.',
      impactIdr: Math.round(expectedCost * rainAdj),
    });
  }
  if (phAdj > 0) {
    drivers.push({
      label: 'pH tanah rendah',
      explanation: 'pH <6 memerlukan penambahan kapur dolomit dan pupuk fosfor lebih banyak.',
      impactIdr: Math.round(expectedCost * phAdj),
    });
  }
  if (nAdj > 0) {
    drivers.push({
      label: 'Nitrogen rendah',
      explanation: 'Kandungan nitrogen rendah meningkatkan kebutuhan pupuk dasar.',
      impactIdr: Math.round(expectedCost * nAdj),
    });
  }
  if (ferAdj > 0) {
    drivers.push({
      label: 'Harga pupuk naik',
      explanation: 'Indeks harga pupuk di atas normal menaikkan biaya perawatan.',
      impactIdr: Math.round(expectedCost * ferAdj),
    });
  }
  if (wageAdj > 0) {
    drivers.push({
      label: 'Upah tenaga kerja naik',
      explanation: 'Kenaikan upah berdampak signifikan pada fase perawatan dan panen.',
      impactIdr: Math.round(expectedCost * wageAdj),
    });
  }

  const warnings: string[] = [];
  if (areaHa > 3) {
    warnings.push('Lahan > 3 ha berada di luar cakupan data pelatihan awal. Estimasi kurang akurat.');
  }

  return {
    seasonId,
    source: 'rule-baseline',
    modelVersion: '1.0.0',
    generatedAt: now.toISOString(),
    p10Idr: p10,
    p50Idr: p50,
    p90Idr: p90,
    overCapitalProbability: overCapitalProb,
    weekly,
    drivers,
    warnings,
  };
}

/**
 * Hitung prediksi dari data Farm (shortcut).
 */
export function computePredictionFromFarm(
  farm: Farm,
  seasonId: string,
  overrides?: Partial<WeatherInput & PriceInput>
): PredictionResult {
  return computeBaselinePrediction({
    crop: farm.crop,
    areaHa: farm.areaHa,
    soil: {
      ph: farm.ph,
      nitrogen: farm.nitrogen,
      phosphorus: farm.phosphorus,
      potassium: farm.potassium,
    },
    weather: overrides,
    prices: overrides,
    availableCapitalIdr: farm.availableCapitalIdr,
  }, seasonId);
}
