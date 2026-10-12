'use client';

import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { repositories } from '@/infrastructure/repositories';
import { useActiveSeason, canViewFinancing } from '@/hooks/useActiveSeason';
import { computePredictionFromFarm } from '@/domain/calculations/baseline-cost';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatCard } from '@/components/ui/StatCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { AppButton } from '@/components/ui/AppButton';
import { EmptyState } from '@/components/ui/FeedbackState';
import { formatRupiah, formatPersen, CROP_LABELS } from '@/lib/formatters';
import { PHASE_LABELS } from '@/domain/calculations/seasons';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend
} from 'recharts';
import { Lock, Info, SlidersHorizontal, RotateCcw } from 'lucide-react';
import type { PredictionResult } from '@/domain/models/types';

function FinancingGateMessage() {
  return (
    <EmptyState
      title="Mulai pembiayaan untuk melihat prediksi"
      description="Pergi ke menu Musim tanam, klik Mulai perhitungan pembiayaan untuk membuka halaman ini."
      icon={<Lock size={40} className="text-[--text-muted]" />}
    />
  );
}

interface ScenarioState {
  rainMmPerWeek: number;
  fertilizerIndex: number;
  wageIndex: number;
}

const DEFAULT_SCENARIO: ScenarioState = {
  rainMmPerWeek: 40,
  fertilizerIndex: 1.0,
  wageIndex: 1.0,
};

export function PrediksiView() {
  const { season, farmId } = useActiveSeason();
  const [scenario, setScenario] = useState<ScenarioState>(DEFAULT_SCENARIO);
  const [showScenario, setShowScenario] = useState(false);

  const { data: farm } = useQuery({
    queryKey: ['farm', farmId],
    queryFn: () => repositories.farm.getFarmById(farmId),
    enabled: !!farmId,
  });

  const prediction: PredictionResult | null =
    farm && season
      ? computePredictionFromFarm(farm, season.id, {
          avgRainMmPerWeek: scenario.rainMmPerWeek,
          fertilizerPriceIndex: scenario.fertilizerIndex,
          wagePriceIndex: scenario.wageIndex,
        })
      : null;

  const { data: snapshot } = useQuery({
    queryKey: ['snapshot', season?.snapshotId],
    queryFn: () => repositories.financing.getSnapshot(season!.snapshotId!),
    enabled: !!season?.snapshotId,
  });

  const hasFinancing = canViewFinancing(season);
  const availableCapital = snapshot?.availableCapitalIdr ?? farm?.availableCapitalIdr ?? 0;

  if (!hasFinancing) return <div className="animate-fade-in"><PageHeader title="Prediksi musim" /><FinancingGateMessage /></div>;
  if (!prediction) return <div className="animate-fade-in"><PageHeader title="Prediksi musim" /></div>;

  const isOutOfRange = (farm?.areaHa ?? 0) > 3;

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Prediksi musim"
        subtitle="Perkiraan total biaya satu musim dan ketidakpastiannya."
        action={
          <AppButton
            variant="outline"
            size="sm"
            leftIcon={<SlidersHorizontal size={15} />}
            onClick={() => setShowScenario((v) => !v)}
          >
            {showScenario ? 'Tutup skenario' : 'Atur skenario'}
          </AppButton>
        }
      />

      {/* Warnings */}
      {isOutOfRange && (
        <div className="flex gap-2 bg-yellow-50 border border-yellow-200 rounded-xl p-3 text-sm">
          <Info size={16} className="text-yellow-600 flex-shrink-0 mt-0.5" />
          <span className="text-yellow-800">Lahan &gt; 3 ha berada di luar cakupan data pelatihan awal. Estimasi kurang akurat.</span>
        </div>
      )}

      {/* Source badge */}
      <div className="flex items-center gap-2">
        <StatusBadge label="Perkiraan berbasis aturan dan simulasi" variant="demo" size="sm" />
        <span className="text-xs text-[--text-muted]">· Bukan model XGBoost · Data contoh</span>
      </div>

      {/* Main prediction */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="md:col-span-1 bg-[--primary] rounded-2xl p-6 text-white shadow-md flex flex-col gap-3">
          <p className="text-white/70 text-sm font-semibold">Perkiraan biaya tengah (P50)</p>
          <p className="text-4xl font-extrabold tabular-nums">
            {formatRupiah(prediction.p50Idr, true)}
          </p>
          <p className="text-white/60 text-xs">
            {farm ? `${CROP_LABELS[farm.crop]} · ${farm.areaHa} ha` : ''}
          </p>
          {prediction.overCapitalProbability !== undefined && (
            <div className="bg-white/10 rounded-xl p-3 mt-2">
              <p className="text-white/80 text-xs font-semibold">Peluang biaya melebihi modal</p>
              <p className="text-2xl font-bold mt-1">
                {formatPersen(prediction.overCapitalProbability)}
              </p>
              <p className="text-white/60 text-xs mt-0.5">
                {prediction.overCapitalProbability > 0.5
                  ? 'Modal kemungkinan tidak cukup'
                  : 'Modal kemungkinan cukup'}
              </p>
            </div>
          )}
        </div>

        <div className="md:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
          <SectionCard>
            <p className="text-sm text-[--text-muted] font-semibold mb-1">Rentang biaya (80%)</p>
            <div className="flex items-baseline gap-2">
              <span className="text-xl font-bold tabular-nums">{formatRupiah(prediction.p10Idr, true)}</span>
              <span className="text-[--text-muted]">—</span>
              <span className="text-xl font-bold tabular-nums">{formatRupiah(prediction.p90Idr, true)}</span>
            </div>
            <p className="text-xs text-[--text-muted] mt-1">P10 hingga P90 dari 500 iterasi simulasi</p>
          </SectionCard>

          <SectionCard>
            <p className="text-sm text-[--text-muted] font-semibold mb-1">Modal tersedia</p>
            <p className="text-xl font-bold tabular-nums">{formatRupiah(availableCapital, true)}</p>
            <div className={`mt-2 px-2 py-1 rounded-lg text-xs font-semibold ${
              availableCapital >= prediction.p50Idr ? 'bg-[--primary-soft] text-[--primary-ink]' : 'bg-red-50 text-[--danger]'
            }`}>
              {availableCapital >= prediction.p50Idr
                ? `✓ Cukup (lebih ${formatRupiah(availableCapital - prediction.p50Idr, true)})`
                : `⚠ Kurang ~${formatRupiah(prediction.p50Idr - availableCapital, true)}`}
            </div>
          </SectionCard>

          {prediction.warnings.length > 0 && prediction.warnings.map((w, i) => (
            <div key={i} className="sm:col-span-2 flex gap-2 bg-yellow-50 border border-yellow-200 rounded-xl p-3">
              <Info size={15} className="text-yellow-600 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-yellow-800">{w}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Scenario Controls */}
      {showScenario && (
        <SectionCard title="Atur skenario" subtitle="Geser untuk melihat dampak pada perkiraan biaya.">
          <div className="space-y-5">
            <div>
              <div className="flex justify-between mb-1">
                <label className="text-sm font-bold text-[--text]">Curah hujan rata-rata</label>
                <span className="text-sm font-bold text-[--primary]">{scenario.rainMmPerWeek} mm/minggu</span>
              </div>
              <input
                type="range" min={5} max={150} step={5}
                value={scenario.rainMmPerWeek}
                onChange={(e) => setScenario((s) => ({ ...s, rainMmPerWeek: Number(e.target.value) }))}
                className="w-full accent-[--primary]"
              />
              <div className="flex justify-between text-xs text-[--text-muted] mt-0.5">
                <span>Kering (5)</span><span>Lebat (150)</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <label className="text-sm font-bold text-[--text]">Indeks harga pupuk</label>
                <span className="text-sm font-bold text-[--primary]">{scenario.fertilizerIndex.toFixed(1)}x</span>
              </div>
              <input
                type="range" min={0.8} max={1.5} step={0.05}
                value={scenario.fertilizerIndex}
                onChange={(e) => setScenario((s) => ({ ...s, fertilizerIndex: Number(e.target.value) }))}
                className="w-full accent-[--primary]"
              />
              <div className="flex justify-between text-xs text-[--text-muted] mt-0.5">
                <span>Turun (0.8x)</span><span>Naik (1.5x)</span>
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1">
                <label className="text-sm font-bold text-[--text]">Indeks upah tenaga kerja</label>
                <span className="text-sm font-bold text-[--primary]">{scenario.wageIndex.toFixed(1)}x</span>
              </div>
              <input
                type="range" min={0.8} max={1.5} step={0.05}
                value={scenario.wageIndex}
                onChange={(e) => setScenario((s) => ({ ...s, wageIndex: Number(e.target.value) }))}
                className="w-full accent-[--primary]"
              />
              <div className="flex justify-between text-xs text-[--text-muted] mt-0.5">
                <span>Turun (0.8x)</span><span>Naik (1.5x)</span>
              </div>
            </div>

            <AppButton
              variant="ghost"
              size="sm"
              leftIcon={<RotateCcw size={14} />}
              onClick={() => setScenario(DEFAULT_SCENARIO)}
            >
              Reset ke normal
            </AppButton>
          </div>
        </SectionCard>
      )}

      {/* Weekly chart */}
      <SectionCard title="Perkiraan biaya per minggu">
        <div className="h-64 mt-2">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={prediction.weekly} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                label={{ value: 'Minggu', position: 'insideBottom', offset: -2, fontSize: 11 }}
              />
              <YAxis
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                tickFormatter={(v) => `${(v / 1_000_000).toFixed(1)}jt`}
              />
              <Tooltip
                formatter={(v: unknown) => [formatRupiah(Number(v)), 'Rencana']}
                labelFormatter={(w) => `Minggu ${w}`}
                contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', fontSize: 12 }}
              />
              <ReferenceLine
                y={availableCapital / prediction.weekly.length}
                stroke="var(--danger)"
                strokeDasharray="4 4"
                label={{ value: 'Modal rata-rata/minggu', position: 'right', fontSize: 10, fill: 'var(--danger)' }}
              />
              <Bar dataKey="plannedIdr" fill="var(--primary)" radius={[4, 4, 0, 0]} name="Rencana biaya" />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-[--text-muted] mt-2 text-center">
          Biaya rencana per minggu (perkiraan berbasis aturan, bukan data aktual)
        </p>
      </SectionCard>

      {/* Drivers */}
      {prediction.drivers.length > 0 && (
        <SectionCard title="Faktor penyesuaian biaya">
          <div className="space-y-3">
            {prediction.drivers.map((d, i) => (
              <div key={i} className="flex items-start justify-between gap-4 py-3 border-b border-[--border] last:border-0">
                <div>
                  <p className="font-bold text-[--text] text-sm">{d.label}</p>
                  <p className="text-xs text-[--text-muted] mt-0.5">{d.explanation}</p>
                </div>
                {d.impactIdr && (
                  <span className="text-sm font-bold text-[--warning] tabular-nums flex-shrink-0">
                    +{formatRupiah(d.impactIdr, true)}
                  </span>
                )}
              </div>
            ))}
          </div>
        </SectionCard>
      )}
    </div>
  );
}
