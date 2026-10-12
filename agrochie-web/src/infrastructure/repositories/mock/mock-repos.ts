import type {
  Farm,
  Farmer,
  Season,
  Expense,
  HarvestEntry,
  HarvestSample,
  FinancingSnapshot,
  LoanApplication,
  SeasonRecord,
  WeeklyChecklist,
} from '@/domain/models/types';
import { computePredictionFromFarm } from '@/domain/calculations/baseline-cost';

// ============================================================
// FIXTURE DATA — Berlabel "Data contoh" / "Simulasi"
// Record ini tidak pernah diikutkan ekspor dataset nyata.
// ============================================================

const MOCK_FARMER: Farmer = {
  id: 'u-001',
  name: 'Pak Budi Santoso',
  phone: '081234567890',
  village: 'Ds. Cikaret, Kec. Ciawi',
  farmerGroup: 'Kelompok Tani Makmur Sejahtera',
};

const MOCK_FARM_CABAI: Farm = {
  id: 'f-001',
  userId: 'u-001',
  name: 'Lahan Utama Ciawi',
  crop: 'cabai',
  areaHa: 0.5,
  soilType: 'lempung',
  waterSource: 'irigasi_teknis',
  province: 'jawa_barat',
  latitude: -6.8523,
  longitude: 106.9578,
  ph: 6.2,
  phMeasuredAt: '2026-09-01',
  nitrogen: 'sedang',
  phosphorus: 'rendah',
  potassium: 'sedang',
  availableCapitalIdr: 35_000_000,
  expectedPricePerKgIdr: 25_000,
  targetProfitIdr: 10_000_000,
  plannedStartDate: '2026-10-15',
};

const MOCK_FARM_INCOMPLETE: Farm = {
  id: 'f-002',
  userId: 'u-001',
  name: 'Lahan Baru',
  crop: 'tomat',
  areaHa: 0.25,
};

const MOCK_PREDICTION = computePredictionFromFarm(MOCK_FARM_CABAI, 's-001', {
  avgRainMmPerWeek: 45,
});

const MOCK_SEASON_FINANCING: Season = {
  id: 's-001',
  farmId: 'f-001',
  crop: 'cabai',
  areaHa: 0.5,
  status: 'planting',
  financingStartedAt: '2026-10-01',
  plantingStartedAt: '2026-10-15',
  snapshotId: 'snap-001',
};

const MOCK_SEASON_DRAFT: Season = {
  id: 's-002',
  farmId: 'f-002',
  crop: 'tomat',
  areaHa: 0.25,
  status: 'draft',
};

const MOCK_SNAPSHOT: FinancingSnapshot = {
  id: 'snap-001',
  seasonId: 's-001',
  createdAt: '2026-10-01T08:00:00Z',
  prediction: MOCK_PREDICTION,
  availableCapitalIdr: 35_000_000,
  gapIdr: MOCK_PREDICTION.p50Idr - 35_000_000,
};

const MOCK_EXPENSES: Expense[] = [
  { id: 'e-001', seasonId: 's-001', spentOn: '2026-10-15', category: 'seed', amountIdr: 2_500_000, note: 'Benih cabai TM-999', origin: 'actual', weekNumber: 1 },
  { id: 'e-002', seasonId: 's-001', spentOn: '2026-10-17', category: 'fertilizer', amountIdr: 1_800_000, note: 'Pupuk kandang 30 karung', origin: 'actual', weekNumber: 1 },
  { id: 'e-003', seasonId: 's-001', spentOn: '2026-10-22', category: 'labor', amountIdr: 2_000_000, note: 'Tenaga pengolahan tanah', origin: 'actual', weekNumber: 2 },
  { id: 'e-004', seasonId: 's-001', spentOn: '2026-10-29', category: 'fertilizer', amountIdr: 1_200_000, note: 'Pupuk NPK dasar', origin: 'actual', weekNumber: 3 },
  { id: 'e-005', seasonId: 's-001', spentOn: '2026-11-05', category: 'pesticide', amountIdr: 850_000, note: 'Fungisida preventif', origin: 'actual', weekNumber: 4 },
];

const MOCK_HARVEST_ENTRIES: HarvestEntry[] = [
  { id: 'h-001', seasonId: 's-003', harvestedOn: '2026-02-15', quality: 'A', weightKg: 180, pricePerKgIdr: 28_000, buyer: 'Pasar Induk Caringin' },
  { id: 'h-002', seasonId: 's-003', harvestedOn: '2026-02-22', quality: 'B', weightKg: 95, pricePerKgIdr: 20_000, buyer: 'Tengkulak Pak Hendra' },
];

const MOCK_SEASON_HISTORY: Season = {
  id: 's-003',
  farmId: 'f-001',
  crop: 'cabai',
  areaHa: 0.5,
  status: 'closed',
  financingStartedAt: '2025-11-01',
  plantingStartedAt: '2025-11-10',
  closedAt: '2026-03-15',
  totalActualCostIdr: 38_200_000,
};

const MOCK_SEASON_RECORD: SeasonRecord = {
  id: 'rec-001',
  seasonId: 's-003',
  farmId: 'f-001',
  crop: 'cabai',
  areaHa: 0.5,
  soilType: 'lempung',
  waterSource: 'irigasi_teknis',
  province: 'jawa_barat',
  plantingMonth: 11,
  avgRainMmPerWeek: 52,
  heavyRainWeeks: 3,
  avgMaxTempC: 31.5,
  ph: 6.2,
  phosphorus: 'rendah',
  nitrogen: 'sedang',
  potassium: 'sedang',
  fertilizerPriceIndex: 1.05,
  wagePriceIndex: 1.08,
  pesticidePriceIndex: 1.02,
  durationWeeks: 16,
  totalActualCostIdr: 38_200_000,
  qualityStatus: 'READY_TOTAL_ONLY',
  dataConsent: false,
};

// ============================================================
// In-memory store (runtime only, tidak persisten lintas refresh)
// ============================================================

let _farmers: Farmer[] = [MOCK_FARMER];
let _farms: Farm[] = [MOCK_FARM_CABAI, MOCK_FARM_INCOMPLETE];
let _seasons: Season[] = [MOCK_SEASON_FINANCING, MOCK_SEASON_DRAFT, MOCK_SEASON_HISTORY];
let _snapshots: FinancingSnapshot[] = [MOCK_SNAPSHOT];
let _expenses: Expense[] = [...MOCK_EXPENSES];
let _harvests: HarvestEntry[] = [...MOCK_HARVEST_ENTRIES];
let _harvestSamples: HarvestSample[] = [];
let _records: SeasonRecord[] = [MOCK_SEASON_RECORD];
let _loans: LoanApplication[] = [];
let _checklists: WeeklyChecklist[] = [];

function generateId(): string {
  return Math.random().toString(36).slice(2, 10);
}

function delay(ms = 300): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// ============================================================
// Mock Repository Implementations
// ============================================================

export const mockFarmerRepo = {
  async getCurrentFarmer() {
    await delay(200);
    return _farmers[0] ?? null;
  },
  async saveFarmer(data: Partial<Farmer>) {
    await delay(300);
    const existing = _farmers[0];
    const updated: Farmer = existing
      ? { ...existing, ...data }
      : { id: generateId(), name: '', ...data };
    _farmers = [updated];
    return updated;
  },
};

export const mockFarmRepo = {
  async getFarmsByUser(_userId: string) {
    await delay(200);
    return _farms;
  },
  async getFarmById(id: string) {
    await delay(150);
    return _farms.find((f) => f.id === id) ?? null;
  },
  async saveFarm(farm: Partial<Farm>) {
    await delay(300);
    const id = farm.id ?? generateId();
    const existing = _farms.find((f) => f.id === id);
    if (existing) {
      const updated = { ...existing, ...farm };
      _farms = _farms.map((f) => (f.id === id ? updated : f));
      return updated;
    }
    const newFarm: Farm = { id, userId: 'u-001', name: 'Lahan baru', crop: 'cabai', areaHa: 0.5, ...farm };
    _farms = [..._farms, newFarm];
    return newFarm;
  },
  async deleteFarm(id: string) {
    await delay(200);
    _farms = _farms.filter((f) => f.id !== id);
  },
};

export const mockSeasonRepo = {
  async getSeasonsByFarm(farmId: string) {
    await delay(200);
    return _seasons.filter((s) => s.farmId === farmId);
  },
  async getActiveSeason(farmId: string) {
    await delay(150);
    return _seasons.find((s) => s.farmId === farmId && s.status !== 'closed') ?? null;
  },
  async getSeasonById(id: string) {
    await delay(150);
    return _seasons.find((s) => s.id === id) ?? null;
  },
  async saveSeason(season: Partial<Season>) {
    await delay(300);
    const id = season.id ?? generateId();
    const existing = _seasons.find((s) => s.id === id);
    if (existing) {
      const updated = { ...existing, ...season };
      _seasons = _seasons.map((s) => (s.id === id ? updated : s));
      return updated;
    }
    const newSeason: Season = {
      id,
      farmId: season.farmId ?? '',
      crop: season.crop ?? 'cabai',
      areaHa: season.areaHa ?? 0.5,
      status: 'draft',
      ...season,
    };
    _seasons = [..._seasons, newSeason];
    return newSeason;
  },
  async updateSeasonStatus(id: string, data: Partial<Season>) {
    await delay(300);
    const existing = _seasons.find((s) => s.id === id);
    if (!existing) throw new Error('Season not found');
    const updated = { ...existing, ...data };
    _seasons = _seasons.map((s) => (s.id === id ? updated : s));
    return updated;
  },
  async closeSeason(id: string, data: Partial<Season>) {
    await delay(400);
    const existing = _seasons.find((s) => s.id === id);
    if (!existing) throw new Error('Season not found');
    const updated: Season = { ...existing, ...data, status: 'closed', closedAt: new Date().toISOString().slice(0, 10) };
    _seasons = _seasons.map((s) => (s.id === id ? updated : s));
    return updated;
  },
};

export const mockFinancingRepo = {
  async getSnapshot(snapshotId: string) {
    await delay(200);
    return _snapshots.find((s) => s.id === snapshotId) ?? null;
  },
  async saveSnapshot(snapshot: Omit<FinancingSnapshot, 'id'>) {
    await delay(300);
    const newSnapshot: FinancingSnapshot = { id: generateId(), ...snapshot };
    _snapshots = [..._snapshots, newSnapshot];
    return newSnapshot;
  },
};

export const mockExpenseRepo = {
  async getExpensesBySeason(seasonId: string) {
    await delay(200);
    return _expenses.filter((e) => e.seasonId === seasonId);
  },
  async addExpense(expense: Omit<Expense, 'id'>) {
    await delay(300);
    const newExpense: Expense = { id: generateId(), ...expense };
    _expenses = [..._expenses, newExpense];
    return newExpense;
  },
  async updateExpense(id: string, data: Partial<Expense>) {
    await delay(300);
    const existing = _expenses.find((e) => e.id === id);
    if (!existing) throw new Error('Expense not found');
    const updated = { ...existing, ...data };
    _expenses = _expenses.map((e) => (e.id === id ? updated : e));
    return updated;
  },
  async deleteExpense(id: string) {
    await delay(200);
    _expenses = _expenses.filter((e) => e.id !== id);
  },
};

export const mockHarvestRepo = {
  async getHarvestsBySeason(seasonId: string) {
    await delay(200);
    return _harvests.filter((h) => h.seasonId === seasonId);
  },
  async addHarvestEntry(entry: Omit<HarvestEntry, 'id'>) {
    await delay(300);
    const newEntry: HarvestEntry = { id: generateId(), ...entry };
    _harvests = [..._harvests, newEntry];
    return newEntry;
  },
  async updateHarvestEntry(id: string, data: Partial<HarvestEntry>) {
    await delay(300);
    const existing = _harvests.find((h) => h.id === id);
    if (!existing) throw new Error('Harvest not found');
    const updated = { ...existing, ...data };
    _harvests = _harvests.map((h) => (h.id === id ? updated : h));
    return updated;
  },
  async deleteHarvestEntry(id: string) {
    await delay(200);
    _harvests = _harvests.filter((h) => h.id !== id);
  },
  async getHarvestSample(seasonId: string) {
    await delay(150);
    return _harvestSamples.find((s) => s.seasonId === seasonId) ?? null;
  },
  async saveHarvestSample(sample: HarvestSample) {
    await delay(300);
    const existing = _harvestSamples.findIndex((s) => s.seasonId === sample.seasonId);
    if (existing >= 0) {
      _harvestSamples = _harvestSamples.map((s, i) => (i === existing ? sample : s));
    } else {
      _harvestSamples = [..._harvestSamples, sample];
    }
    return sample;
  },
};

export const mockRecordRepo = {
  async getRecordBySeason(seasonId: string) {
    await delay(200);
    return _records.find((r) => r.seasonId === seasonId) ?? null;
  },
  async getAllRecords() {
    await delay(200);
    return _records;
  },
  async saveRecord(record: Partial<SeasonRecord>) {
    await delay(300);
    const id = record.id ?? generateId();
    const newRecord: SeasonRecord = {
      id,
      seasonId: record.seasonId ?? '',
      farmId: record.farmId ?? '',
      crop: record.crop ?? 'cabai',
      areaHa: record.areaHa ?? 0.5,
      durationWeeks: record.durationWeeks ?? 16,
      qualityStatus: record.qualityStatus ?? 'INCOMPLETE',
      ...record,
    };
    _records = [..._records, newRecord];
    return newRecord;
  },
  async updateRecord(id: string, data: Partial<SeasonRecord>) {
    await delay(300);
    const existing = _records.find((r) => r.id === id);
    if (!existing) throw new Error('Record not found');
    const updated = { ...existing, ...data };
    _records = _records.map((r) => (r.id === id ? updated : r));
    return updated;
  },
};

export const mockLoanRepo = {
  async getLoansBySeason(seasonId: string) {
    await delay(200);
    return _loans.filter((l) => l.seasonId === seasonId);
  },
  async saveLoanApplication(loan: Omit<LoanApplication, 'id'>) {
    await delay(400);
    const newLoan: LoanApplication = { id: generateId(), ...loan };
    _loans = [..._loans, newLoan];
    return newLoan;
  },
  async updateLoanStatus(id: string, status: LoanApplication['status']) {
    await delay(300);
    const existing = _loans.find((l) => l.id === id);
    if (!existing) throw new Error('Loan not found');
    const updated = { ...existing, status };
    _loans = _loans.map((l) => (l.id === id ? updated : l));
    return updated;
  },
};

export const mockReminderRepo = {
  async getChecklist(seasonId: string, weekNumber: number) {
    await delay(150);
    return _checklists.find((c) => c.seasonId === seasonId && c.weekNumber === weekNumber) ?? null;
  },
  async saveChecklist(checklist: WeeklyChecklist) {
    await delay(200);
    const existing = _checklists.findIndex(
      (c) => c.seasonId === checklist.seasonId && c.weekNumber === checklist.weekNumber
    );
    if (existing >= 0) {
      _checklists = _checklists.map((c, i) => (i === existing ? checklist : c));
    } else {
      _checklists = [..._checklists, checklist];
    }
    return checklist;
  },
  async updateTaskStatus(seasonId: string, weekNumber: number, taskId: string, isDone: boolean) {
    await delay(150);
    _checklists = _checklists.map((c) => {
      if (c.seasonId !== seasonId || c.weekNumber !== weekNumber) return c;
      return {
        ...c,
        tasks: c.tasks.map((t) => (t.id === taskId ? { ...t, isDone } : t)),
      };
    });
  },
};
