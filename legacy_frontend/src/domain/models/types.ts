// ============================================================
// AgroChie — Domain Types
// ============================================================

export type Crop = 'cabai' | 'tomat' | 'bawang';
export type NutrientLevel = 'rendah' | 'sedang' | 'tinggi';
export type SeasonStatus = 'draft' | 'financing' | 'planting' | 'closed';
export type DataOrigin = 'actual' | 'synthetic' | 'demo' | 'simulated';
export type PredictionSource = 'rule-baseline' | 'xgboost';
export type QualityStatus =
  | 'READY_WEEKLY'
  | 'READY_TOTAL_ONLY'
  | 'INCOMPLETE'
  | 'DEMO';

/** Unit internal uang di frontend = integer Rupiah, bukan float juta. */
export type MoneyIDR = number;

export type ExpenseCategory =
  | 'seed'
  | 'fertilizer'
  | 'pesticide'
  | 'labor'
  | 'other';

export type HarvestQuality = 'A' | 'B' | 'C';

export type SoilType =
  | 'lempung'
  | 'lempung_berpasir'
  | 'lempung_berliat'
  | 'andisol'
  | 'latosol';

export type WaterSource =
  | 'irigasi_teknis'
  | 'tadah_hujan'
  | 'sumur'
  | 'sungai';

export type Province =
  | 'jawa_barat'
  | 'jawa_tengah'
  | 'jawa_timur'
  | 'sumatera_utara'
  | 'sulawesi_selatan';

// ============================================================
// Farm & Farmer
// ============================================================

export interface Farmer {
  id: string;
  name: string;
  phone?: string;
  village?: string;
  farmerGroup?: string;
}

export interface Farm {
  id: string;
  userId: string;
  name: string;
  crop: Crop;
  areaHa: number;
  soilType?: SoilType;
  waterSource?: WaterSource;
  province?: Province;
  latitude?: number;
  longitude?: number;
  ph?: number;
  phMeasuredAt?: string; // YYYY-MM-DD
  nitrogen?: NutrientLevel;
  phosphorus?: NutrientLevel;
  potassium?: NutrientLevel;
  // Rencana keuangan
  availableCapitalIdr?: MoneyIDR;
  expectedPricePerKgIdr?: MoneyIDR;
  targetProfitIdr?: MoneyIDR;
  // Rencana tanam
  plannedStartDate?: string; // YYYY-MM-DD
}

// ============================================================
// Season
// ============================================================

export interface Season {
  id: string;
  farmId: string;
  crop: Crop;
  areaHa: number;
  status: SeasonStatus;
  financingStartedAt?: string; // YYYY-MM-DD
  plantingStartedAt?: string; // minggu 1
  closedAt?: string;
  snapshotId?: string;
  // Catatan penutupan
  closingNotes?: string;
  pestNotes?: string;
  weatherNotes?: string;
  priceNotes?: string;
  totalActualCostIdr?: MoneyIDR;
}

// ============================================================
// Prediction
// ============================================================

export interface PredictionResult {
  seasonId: string;
  source: PredictionSource;
  modelVersion?: string;
  generatedAt: string;
  p10Idr: MoneyIDR;
  p50Idr: MoneyIDR;
  p90Idr: MoneyIDR;
  overCapitalProbability?: number; // 0...1
  weekly: Array<{ week: number; plannedIdr: MoneyIDR; phase: string }>;
  drivers: Array<{ label: string; explanation: string; impactIdr?: MoneyIDR }>;
  warnings: string[];
}

export interface FinancingSnapshot {
  id: string;
  seasonId: string;
  createdAt: string;
  prediction: PredictionResult;
  availableCapitalIdr: MoneyIDR;
  gapIdr: MoneyIDR; // positif = kurang modal
}

// ============================================================
// Expense
// ============================================================

export interface Expense {
  id: string;
  seasonId: string;
  spentOn: string; // YYYY-MM-DD
  category: ExpenseCategory;
  amountIdr: MoneyIDR;
  note?: string;
  origin: DataOrigin;
  weekNumber?: number; // 1..N, dihitung saat simpan
}

// ============================================================
// Harvest
// ============================================================

export interface HarvestEntry {
  id: string;
  seasonId: string;
  harvestedOn: string; // YYYY-MM-DD
  quality: HarvestQuality;
  weightKg: number;
  pricePerKgIdr: MoneyIDR;
  buyer?: string;
}

export interface HarvestSample {
  seasonId: string;
  weightKg: number;
  plotAreaM2: number;
  photos: Array<{
    id: string;
    url: string;
    takenAt?: string;
    lat?: number;
    lng?: number;
  }>;
}

// ============================================================
// Season Record (Riwayat)
// ============================================================

export interface SeasonRecord {
  id: string;
  seasonId: string;
  farmId: string;
  crop: Crop;
  areaHa: number;
  soilType?: SoilType;
  waterSource?: WaterSource;
  province?: Province;
  plantingMonth?: number; // 1..12
  avgRainMmPerWeek?: number;
  heavyRainWeeks?: number;
  avgMaxTempC?: number;
  ph?: number;
  phosphorus?: NutrientLevel;
  nitrogen?: NutrientLevel;
  potassium?: NutrientLevel;
  fertilizerPriceIndex?: number;
  wagePriceIndex?: number;
  pesticidePriceIndex?: number;
  durationWeeks: number;
  totalActualCostIdr?: MoneyIDR;
  qualityStatus: QualityStatus;
  dataConsent?: boolean;
  // Ekspor
  weeklyExpenses?: WeeklyExpense[];
}

export interface WeeklyExpense {
  week: number;
  amountIdr: MoneyIDR;
  isActual: boolean;
}

// ============================================================
// Loan / Credit
// ============================================================

export type LoanStatus =
  | 'draft'
  | 'submitted'
  | 'reviewing'
  | 'approved'
  | 'rejected';

export interface LoanApplication {
  id: string;
  seasonId: string;
  amountIdr: MoneyIDR;
  purpose: string;
  tenorMonths: number;
  notes?: string;
  status: LoanStatus;
  referralCode?: string;
  submittedAt?: string;
  origin: DataOrigin;
}

// ============================================================
// Reminder
// ============================================================

export interface ReminderTask {
  id: string;
  label: string;
  description?: string;
  isDone: boolean;
  scheduledDay?: number; // 0=minggu, 1=senin, ...
  scheduledHour?: number;
}

export interface WeeklyChecklist {
  seasonId: string;
  weekNumber: number;
  tasks: ReminderTask[];
}

// ============================================================
// Utility
// ============================================================

export type AsyncState<T> =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'success'; data: T }
  | { status: 'error'; error: string };
