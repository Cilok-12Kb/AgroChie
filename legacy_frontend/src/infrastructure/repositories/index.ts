import {
  mockFarmerRepo,
  mockFarmRepo,
  mockSeasonRepo,
  mockFinancingRepo,
  mockExpenseRepo,
  mockHarvestRepo,
  mockRecordRepo,
  mockLoanRepo,
  mockReminderRepo,
} from './mock/mock-repos';
import type { Repositories } from './contracts';

const DATA_MODE = process.env.NEXT_PUBLIC_DATA_MODE ?? 'mock';

// TODO: Replace with HTTP repos when Express API is available
function buildRepositories(): Repositories {
  if (DATA_MODE === 'api') {
    // HTTP implementations (placeholder)
    throw new Error('HTTP repositories not yet implemented. Set NEXT_PUBLIC_DATA_MODE=mock');
  }

  return {
    farmer: mockFarmerRepo,
    farm: mockFarmRepo,
    season: mockSeasonRepo,
    financing: mockFinancingRepo,
    expense: mockExpenseRepo,
    harvest: mockHarvestRepo,
    record: mockRecordRepo,
    loan: mockLoanRepo,
    reminder: mockReminderRepo,
  };
}

export const repositories: Repositories = buildRepositories();
