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

// ============================================================
// Repository Contracts (interfaces)
// ============================================================

export interface FarmerRepository {
  getCurrentFarmer(): Promise<Farmer | null>;
  saveFarmer(data: Partial<Farmer>): Promise<Farmer>;
}

export interface FarmRepository {
  getFarmsByUser(userId: string): Promise<Farm[]>;
  getFarmById(id: string): Promise<Farm | null>;
  saveFarm(farm: Partial<Farm>): Promise<Farm>;
  deleteFarm(id: string): Promise<void>;
}

export interface SeasonRepository {
  getSeasonsByFarm(farmId: string): Promise<Season[]>;
  getActiveSeason(farmId: string): Promise<Season | null>;
  getSeasonById(id: string): Promise<Season | null>;
  saveSeason(season: Partial<Season>): Promise<Season>;
  updateSeasonStatus(id: string, data: Partial<Season>): Promise<Season>;
  closeSeason(id: string, data: Partial<Season>): Promise<Season>;
}

export interface FinancingRepository {
  getSnapshot(snapshotId: string): Promise<FinancingSnapshot | null>;
  saveSnapshot(snapshot: Omit<FinancingSnapshot, 'id'>): Promise<FinancingSnapshot>;
}

export interface ExpenseRepository {
  getExpensesBySeason(seasonId: string): Promise<Expense[]>;
  addExpense(expense: Omit<Expense, 'id'>): Promise<Expense>;
  updateExpense(id: string, data: Partial<Expense>): Promise<Expense>;
  deleteExpense(id: string): Promise<void>;
}

export interface HarvestRepository {
  getHarvestsBySeason(seasonId: string): Promise<HarvestEntry[]>;
  addHarvestEntry(entry: Omit<HarvestEntry, 'id'>): Promise<HarvestEntry>;
  updateHarvestEntry(id: string, data: Partial<HarvestEntry>): Promise<HarvestEntry>;
  deleteHarvestEntry(id: string): Promise<void>;
  getHarvestSample(seasonId: string): Promise<HarvestSample | null>;
  saveHarvestSample(sample: HarvestSample): Promise<HarvestSample>;
}

export interface SeasonRecordRepository {
  getRecordBySeason(seasonId: string): Promise<SeasonRecord | null>;
  getAllRecords(): Promise<SeasonRecord[]>;
  saveRecord(record: Partial<SeasonRecord>): Promise<SeasonRecord>;
  updateRecord(id: string, data: Partial<SeasonRecord>): Promise<SeasonRecord>;
}

export interface LoanRepository {
  getLoansBySeason(seasonId: string): Promise<LoanApplication[]>;
  saveLoanApplication(loan: Omit<LoanApplication, 'id'>): Promise<LoanApplication>;
  updateLoanStatus(id: string, status: LoanApplication['status']): Promise<LoanApplication>;
}

export interface ReminderRepository {
  getChecklist(seasonId: string, weekNumber: number): Promise<WeeklyChecklist | null>;
  saveChecklist(checklist: WeeklyChecklist): Promise<WeeklyChecklist>;
  updateTaskStatus(seasonId: string, weekNumber: number, taskId: string, isDone: boolean): Promise<void>;
}

// ============================================================
// Aggregated Repository interface
// ============================================================

export interface Repositories {
  farmer: FarmerRepository;
  farm: FarmRepository;
  season: SeasonRepository;
  financing: FinancingRepository;
  expense: ExpenseRepository;
  harvest: HarvestRepository;
  record: SeasonRecordRepository;
  loan: LoanRepository;
  reminder: ReminderRepository;
}
