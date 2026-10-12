'use client';

import { useQuery } from '@tanstack/react-query';
import { repositories } from '@/infrastructure/repositories';
import type { Season } from '@/domain/models/types';

// Default to 'f-001' (mock farm). In production this comes from auth session.
const DEFAULT_FARM_ID = 'f-001';

function getActiveFarmId(): string {
  if (typeof window === 'undefined') return DEFAULT_FARM_ID;
  return localStorage.getItem('agrochie_active_farm_id') ?? DEFAULT_FARM_ID;
}

export function setActiveFarmId(farmId: string): void {
  if (typeof window !== 'undefined') {
    localStorage.setItem('agrochie_active_farm_id', farmId);
  }
}

/**
 * Hook untuk mendapatkan musim aktif berdasarkan farm aktif.
 */
export function useActiveSeason() {
  const farmId = getActiveFarmId();

  const { data: season, isLoading, error } = useQuery({
    queryKey: ['season', 'active', farmId],
    queryFn: () => repositories.season.getActiveSeason(farmId),
  });

  return {
    season: season ?? null,
    isLoading,
    error: error ? String(error) : null,
    farmId,
  };
}

/**
 * Apakah pembiayaan sudah dimulai?
 */
export function canViewFinancing(season: Season | null | undefined): boolean {
  return Boolean(season?.financingStartedAt);
}

/**
 * Apakah penanaman sudah dimulai?
 */
export function canViewPlanting(season: Season | null | undefined): boolean {
  return Boolean(season?.plantingStartedAt);
}

/**
 * Apakah musim sudah ditutup?
 */
export function isSeasonClosed(season: Season | null | undefined): boolean {
  return season?.status === 'closed';
}
