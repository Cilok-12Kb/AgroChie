'use client';

import { useQuery } from '@tanstack/react-query';
import { repositories } from '@/infrastructure/repositories';
import { useActiveSeason, canViewFinancing } from '@/hooks/useActiveSeason';
import { computeCumulativeCashflow, findCapitalShortfallWeek, computeActualByWeek } from '@/domain/calculations/cashflow';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatCard } from '@/components/ui/StatCard';
import { EmptyState } from '@/components/ui/FeedbackState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { AppButton } from '@/components/ui/AppButton';
import { formatRupiah } from '@/lib/formatters';
import { PHASE_LABELS, getPhaseForWeek } from '@/domain/calculations/seasons';
import Link from 'next/link';
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ReferenceLine, Legend
} from 'recharts';
import { Lock, AlertTriangle, ArrowRight, Info } from 'lucide-react';

export function KalenderUangView() {
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
        <PageHeader title="Kalender uang" />
        <EmptyState
          icon={<Lock size={40} className="text-[--text-muted]" />}
          title="Mulai pembiayaan untuk melihat kalender"
          description="Buka Musim tanam → Mulai perhitungan pembiayaan."
        />
      </div>
    );
  }

  const prediction = snapshot?.prediction;
  const availableCapital = snapshot?.availableCapitalIdr ?? farm?.availableCapitalIdr ?? 0;

  if (!prediction) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Kalender uang" />
        <EmptyState title="Data prediksi tidak ditemukan" description="Coba hitung ulang pembiayaan dari menu Musim tanam." />
      </div>
    );
  }

  const cashflow = computeCumulativeCashflow(prediction, availableCapital);
  const shortfallWeek = findCapitalShortfallWeek(prediction, availableCapital);
  const actualByWeek = computeActualByWeek(expenses.filter((e) => e.origin === 'actual'));
  const totalActual = Object.values(actualByWeek).reduce((s, v) => s + v, 0);

  // Chart data
  const chartData = cashflow.map((row) => ({
    week: row.week,
    rencana: row.planned,
    aktual: actualByWeek[row.week] ?? null,
    saldoRencana: row.capitalRemaining,
    phase: PHASE_LABELS[getPhaseForWeek(season!.crop, row.week)],
  }));

  const highestWeek = cashflow.reduce(
    (max, row) => (row.planned > (max?.planned ?? 0) ? row : max),
    cashflow[0]
  );

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Kalender uang"
        subtitle="Jadwal pengeluaran mingguan dan perkiraan saldo modal."
        action={<StatusBadge label="Estimasi berbasis aturan" variant="demo" size="sm" />}
      />

      {/* Summary KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Modal tersedia" value={formatRupiah(availableCapital, true)} subtitle="Dari profil" />
        <StatCard
          label="Perkiraan total kebutuhan"
          value={formatRupiah(prediction.p50Idr, true)}
          subtitle="Estimasi P50"
        />
        <StatCard
          label="Selisih modal"
          value={formatRupiah(Math.abs(availableCapital - prediction.p50Idr), true)}
          subtitle={availableCapital >= prediction.p50Idr ? 'Cukup' : 'Kurang'}
          danger={availableCapital < prediction.p50Idr}
        />
        <StatCard
          label="Minggu biaya tertinggi"
          value={`Minggu ${highestWeek?.week ?? '—'}`}
          subtitle={highestWeek ? formatRupiah(highestWeek.planned, true) : ''}
        />
      </div>

      {/* Shortfall alert */}
      {shortfallWeek !== null && (
        <div className="flex gap-3 bg-red-50 border border-[--danger]/20 rounded-2xl p-4">
          <AlertTriangle size={20} className="text-[--danger] flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-[--danger] text-sm">
              Modal diperkirakan tidak mencukupi mulai minggu {shortfallWeek}
            </p>
            <p className="text-xs text-[--text-muted] mt-0.5">
              Ini adalah perkiraan berdasarkan skenario saat ini, bukan kepastian.
            </p>
            <Link href="/risiko-kredit">
              <AppButton size="sm" variant="danger" className="mt-2" rightIcon={<ArrowRight size={14} />}>
                Lihat opsi pengajuan pinjaman
              </AppButton>
            </Link>
          </div>
        </div>
      )}

      {/* Pengeluaran aktual info */}
      {totalActual === 0 && (
        <div className="flex gap-2 bg-[--surface-muted] border border-[--border] rounded-xl p-3">
          <Info size={16} className="text-[--text-muted] flex-shrink-0 mt-0.5" />
          <p className="text-sm text-[--text-muted]">
            Belum ada pengeluaran tercatat. Rencana biaya tetap dapat dilihat.
          </p>
        </div>
      )}

      {/* Chart */}
      <SectionCard title="Biaya mingguan dan saldo modal">
        <div className="h-72">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 4, right: 8, left: -16, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis
                dataKey="week"
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                label={{ value: 'Minggu ke-', position: 'insideBottomRight', offset: -5, fontSize: 11 }}
              />
              <YAxis
                yAxisId="cost"
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}jt`}
              />
              <YAxis
                yAxisId="balance"
                orientation="right"
                tick={{ fontSize: 11, fill: 'var(--text-muted)' }}
                tickFormatter={(v) => `${(v / 1_000_000).toFixed(0)}jt`}
              />
              <Tooltip
                formatter={(v: unknown, name: unknown) => [
                  formatRupiah(Number(v)),
                  name === 'rencana' ? 'Rencana biaya' :
                  name === 'aktual' ? 'Aktual tercatat' : 'Saldo modal rencana',
                ]}
                labelFormatter={(w) => `Minggu ${w} · ${chartData[Number(w) - 1]?.phase ?? ''}`}
                contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', fontSize: 12 }}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <ReferenceLine yAxisId="balance" y={0} stroke="var(--danger)" strokeWidth={2} strokeDasharray="4 4" />
              <Bar yAxisId="cost" dataKey="rencana" fill="var(--primary)" opacity={0.85} radius={[3, 3, 0, 0]} name="rencana" />
              <Bar yAxisId="cost" dataKey="aktual" fill="#f97316" opacity={0.9} radius={[3, 3, 0, 0]} name="aktual" />
              <Line
                yAxisId="balance"
                type="monotone"
                dataKey="saldoRencana"
                stroke="var(--danger)"
                strokeWidth={2}
                dot={false}
                name="saldoRencana"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
        <p className="text-xs text-[--text-muted] mt-2 text-center">
          Batang hijau = rencana · Batang oranye = aktual tercatat · Garis merah = saldo modal tersisa
        </p>
      </SectionCard>

      {/* Tabel mobile-friendly */}
      <SectionCard title="Tabel mingguan">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-[--border]">
                {['Minggu', 'Fase', 'Rencana', 'Aktual', 'Saldo modal'].map((h) => (
                  <th key={h} className="text-left py-2 px-2 text-xs font-bold text-[--text-muted] first:pl-0 last:pr-0">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cashflow.slice(0, 8).map((row) => {
                const actual = actualByWeek[row.week];
                const isShortfall = row.capitalRemaining < 0;
                return (
                  <tr key={row.week} className={`border-b border-[--border] last:border-0 ${isShortfall ? 'bg-red-50' : ''}`}>
                    <td className="py-2 px-2 pl-0 font-bold text-[--text]">{row.week}</td>
                    <td className="py-2 px-2 text-[--text-muted] text-xs">
                      {PHASE_LABELS[getPhaseForWeek(season!.crop, row.week)]}
                    </td>
                    <td className="py-2 px-2 tabular-nums text-[--text]">{formatRupiah(row.planned, true)}</td>
                    <td className="py-2 px-2 tabular-nums">
                      {actual !== undefined ? (
                        <span className={actual > row.planned * 1.15 ? 'text-[--danger] font-bold' : 'text-[--text]'}>
                          {formatRupiah(actual, true)}
                        </span>
                      ) : (
                        <span className="text-[--text-muted]">—</span>
                      )}
                    </td>
                    <td className={`py-2 px-2 pr-0 tabular-nums font-bold ${isShortfall ? 'text-[--danger]' : 'text-[--success]'}`}>
                      {formatRupiah(Math.abs(row.capitalRemaining), true)}
                      {isShortfall ? ' ↓' : ''}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {cashflow.length > 8 && (
            <p className="text-xs text-[--text-muted] mt-2 text-center">
              ... dan {cashflow.length - 8} minggu lainnya
            </p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
