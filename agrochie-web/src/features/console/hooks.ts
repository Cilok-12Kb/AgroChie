'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api, ApiError } from './api';

const FARM_KEY = 'agrochie:farm-id';
export function useWorkspace() {
  const qc = useQueryClient();
  const [chosenId, setChosenId] = useState<string | null>(
    () => (typeof window !== 'undefined' ? window.localStorage.getItem(FARM_KEY) : null)
  );
  const account = useQuery({ queryKey: ['console', 'account'], queryFn: api.auth.me, retry: false, staleTime: 30_000 });
  const farms = useQuery({ queryKey: ['console', 'farms'], queryFn: api.farms.list, enabled: !!account.data, retry: 1 });
  const farm = farms.data?.find(f => f.id === chosenId) ?? farms.data?.[0] ?? null;
  const seasons = useQuery({ queryKey: ['console', 'seasons', farm?.id], queryFn: () => api.seasons.list(farm!.id), enabled: !!farm?.id });
  const season = seasons.data?.find(s => s.status !== 'SELESAI') ?? null;
  const expenses = useQuery({ queryKey: ['console', 'expenses', season?.id], queryFn: () => api.expenses.list(season!.id), enabled: !!season?.id });
  const harvests = useQuery({ queryKey: ['console', 'harvests', season?.id], queryFn: () => api.harvests.list(season!.id), enabled: !!season?.id });
  const selectFarm = (id: string) => { window.localStorage.setItem(FARM_KEY, id); setChosenId(id); };
  const reload = () => qc.invalidateQueries({ queryKey: ['console'] });
  return { account, farms, farm, seasons, season, expenses, harvests, selectFarm, reload,
    loading: account.isLoading || (account.isSuccess && farms.isLoading),
    unauthorized: account.error instanceof ApiError && account.error.status === 401,
    error: account.error ?? farms.error ?? seasons.error ?? null };
}
export type Workspace = ReturnType<typeof useWorkspace>;
