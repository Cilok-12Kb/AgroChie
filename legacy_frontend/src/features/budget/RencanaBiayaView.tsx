'use client';

import { useQuery } from '@tanstack/react-query';
import { repositories } from '@/infrastructure/repositories';
import { useActiveSeason, canViewFinancing } from '@/hooks/useActiveSeason';
import { computeActualByCategory, computePhaseBudget } from '@/domain/calculations/cashflow';
import { computePredictionFromFarm } from '@/domain/calculations/baseline-cost';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/FeedbackState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { AppButton } from '@/components/ui/AppButton';
import { formatRupiah, formatPersen, EXPENSE_CATEGORY_LABELS, CROP_LABELS } from '@/lib/formatters';
import { PHASE_LABELS, PHASE_COST_WEIGHTS, CROP_PHASES, type PhaseName } from '@/domain/calculations/seasons';
import Link from 'next/link';
import { Lock, Info, ArrowRight, AlertTriangle } from 'lucide-react';

const PHASE_ORDER: PhaseName[] = ['persiapan', 'penanaman', 'perawatan', 'panen'];

const CATEGORY_WEIGHTS: Record<string, number> = {
  seed: 0.12,
  fertilizer: 0.28,
  pesticide: 0.18,
  labor: 0.32,
  other: 0.10,
};

export function RencanaBiayaView() {
  const { season, farmId } = useActiveSeason();
  const hasFinancing = canViewFinancing(season);

  const { data: farm } = useQuery({
    queryKey: ['farm', farmId],
    queryFn: () => repositories.farm.getFarmById(farmId),
    enabled: !!farmId,
  });

  const { data: snapshot } = useQuery({
    queryKey: ['snapshot', season?.snapshotId],
    queryFn: () => repositories.financing.getSnapshot(season!.snapshotId!),
    enabled: !!season?.snapshotId,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses', season?.id],
    queryFn: () => repositories.expense.getExpensesBySeason(season!.id),
    enabled: !!season?.id,
  });

  if (!hasFinancing) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Rencana biaya" />
        <EmptyState
          icon={<Lock size={40} className="text-[--text-muted]" />}
          title="Mulai pembiayaan untuk melihat rencana biaya"
          description="Buka Musim tanam → Mulai perhitungan pembiayaan."
        />
      </div>
    );
  }

  const prediction = snapshot?.prediction ??
    (farm && season ? computePredictionFromFarm(farm, season.id) : null);
  const totalPlan = prediction?.p50Idr ?? 0;

  const actualByCategory = computeActualByCategory(expenses);
  const totalActual = Object.values(actualByCategory).reduce((s, v) => s + v, 0);

  const phaseBudget = prediction ? computePhaseBudget(prediction) : {};

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Rencana biaya"
        subtitle="Alokasi biaya per fase dan per kategori musim ini."
        action={<StatusBadge label="Perkiraan aturan dan simulasi" variant="demo" size="sm" />}
      />

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <StatCard
          label="Total rencana (P50)"
          value={formatRupiah(totalPlan, true)}
          subtitle="Estimasi satu musim"
          highlight
        />
        <StatCard
          label="Pengeluaran aktual"
          value={formatRupiah(totalActual, true)}
          subtitle="Yang sudah tercatat"
          trend={totalActual > totalPlan ? 'up' : 'neutral'}
          danger={totalActual > totalPlan * 1.15}
        />
        <StatCard
          label="Selisih"
          value={formatRupiah(Math.abs(totalPlan - totalActual), true)}
          subtitle={totalActual <= totalPlan ? 'Masih dalam rencana' : 'Melebihi rencana'}
          danger={totalActual > totalPlan}
        />
      </div>

      {totalActual > totalPlan * 1.15 && (
        <div className="flex gap-3 bg-red-50 border border-[--danger]/20 rounded-2xl p-4">
          <AlertTriangle size={18} className="text-[--danger] flex-shrink-0 mt-0.5" />
          <p className="text-sm text-[--danger] font-semibold">
            Total pengeluaran sudah melebihi 115% dari rencana. Periksa kembali pencatatan.
          </p>
        </div>
      )}

      {/* Fase breakdown */}
      {farm && (
        <SectionCard title="Alokasi per fase" subtitle="Bobot baseline dari dataset hortikultura.">
          <div className="space-y-3">
            {PHASE_ORDER.map((phase) => {
              const weight = PHASE_COST_WEIGHTS[phase];
              const planned = Math.round(totalPlan * weight);
              const phaseDuration = CROP_PHASES[farm.crop][phase];
              return (
                <div key={phase} className="space-y-1.5">
                  <div className="flex items-center justify-between text-sm">
                    <span className="font-bold text-[--text]">{PHASE_LABELS[phase]}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-[--text-muted]">{phaseDuration} minggu</span>
                      <span className="font-bold text-[--text] tabular-nums">{formatRupiah(planned, true)}</span>
                      <StatusBadge label={`${(weight * 100).toFixed(0)}%`} variant="muted" size="sm" />
                    </div>
                  </div>
                  <div className="h-2 bg-[--border] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[--primary] rounded-full transition-all duration-500"
                      style={{ width: `${weight * 100}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-[--text-muted] mt-3">
            Bobot: Persiapan 19% · Penanaman 16% · Perawatan 50% · Panen 15%
          </p>
        </SectionCard>
      )}

      {/* Kategori breakdown */}
      <SectionCard title="Alokasi per kategori">
        <div className="space-y-3">
          {Object.entries(EXPENSE_CATEGORY_LABELS).map(([cat, label]) => {
            const plannedCat = Math.round(totalPlan * (CATEGORY_WEIGHTS[cat] ?? 0.1));
            const actualCat = actualByCategory[cat] ?? 0;
            const pct = plannedCat > 0 ? actualCat / plannedCat : 0;
            const isOver = pct > 1.15;
            return (
              <div key={cat} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span className="font-semibold text-[--text]">{label}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[--text-muted] tabular-nums">
                      {formatRupiah(actualCat, true)} / {formatRupiah(plannedCat, true)}
                    </span>
                    {isOver && (
                      <StatusBadge label=">115%" variant="warning" size="sm" />
                    )}
                  </div>
                </div>
                <div className="h-1.5 bg-[--border] rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${isOver ? 'bg-[--warning]' : 'bg-[--primary]'}`}
                    style={{ width: `${Math.min(pct * 100, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </SectionCard>

      {/* Break-even (P2 preview) */}
      {farm?.expectedPricePerKgIdr && (
        <SectionCard title="Perkiraan break-even" subtitle="Skenario harga jual — bukan prediksi harga pasar.">
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-[--surface-muted] rounded-xl p-4 text-center">
              <p className="text-xs text-[--text-muted] font-semibold mb-1">Harga impas perkiraan</p>
              <p className="text-xl font-bold tabular-nums text-[--text]">
                {/* Estimasi yield: 8 ton/ha untuk cabai */}
                {formatRupiah(Math.round(totalPlan / (farm.areaHa * 8000)), true)}/kg
              </p>
            </div>
            <div className="bg-[--surface-muted] rounded-xl p-4 text-center">
              <p className="text-xs text-[--text-muted] font-semibold mb-1">Harga target Anda</p>
              <p className="text-xl font-bold tabular-nums text-[--primary]">
                {formatRupiah(farm.expectedPricePerKgIdr)}/kg
              </p>
            </div>
          </div>
          <p className="text-xs text-[--text-muted] mt-2">
            Ini skenario estimasi, bukan prediksi harga pasar. Yield diasumsikan ~8 ton/ha untuk cabai.
          </p>
        </SectionCard>
      )}

      <div className="flex gap-3 flex-wrap">
        <Link href="/catatan">
          <AppButton variant="secondary" rightIcon={<ArrowRight size={15} />}>Catat pengeluaran</AppButton>
        </Link>
        <Link href="/kalender-uang">
          <AppButton variant="outline" rightIcon={<ArrowRight size={15} />}>Kalender uang</AppButton>
        </Link>
      </div>
    </div>
  );
}
