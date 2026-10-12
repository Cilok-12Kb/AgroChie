'use client';

import { useQuery } from '@tanstack/react-query';
import { repositories } from '@/infrastructure/repositories';
import { useActiveSeason, canViewFinancing } from '@/hooks/useActiveSeason';
import { PageHeader } from '@/components/ui/PageHeader';
import { StatCard } from '@/components/ui/StatCard';
import { SectionCard } from '@/components/ui/SectionCard';
import { AppButton } from '@/components/ui/AppButton';
import { EmptyState, LoadingSkeleton } from '@/components/ui/FeedbackState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatRupiah, CROP_LABELS, SEASON_STATUS_LABELS } from '@/lib/formatters';
import { computeActualTotal } from '@/domain/calculations/cashflow';
import { getPhaseForWeek, getCurrentWeek, PHASE_LABELS } from '@/domain/calculations/seasons';
import Link from 'next/link';
import {
  Sprout, ArrowRight, AlertTriangle, CheckCircle2, CalendarClock,
  Wallet, ClipboardList, BarChart3, CloudSun, TrendingUp
} from 'lucide-react';

export function BerandaView() {
  const { season, isLoading: seasonLoading, farmId } = useActiveSeason();

  const { data: farm } = useQuery({
    queryKey: ['farm', farmId],
    queryFn: () => repositories.farm.getFarmById(farmId),
    enabled: !!farmId,
  });

  const { data: expenses = [] } = useQuery({
    queryKey: ['expenses', season?.id],
    queryFn: () => repositories.expense.getExpensesBySeason(season!.id),
    enabled: !!season?.id,
  });

  const { data: snapshot } = useQuery({
    queryKey: ['snapshot', season?.snapshotId],
    queryFn: () => repositories.financing.getSnapshot(season!.snapshotId!),
    enabled: !!season?.snapshotId,
  });

  if (seasonLoading) {
    return (
      <div className="space-y-4">
        <LoadingSkeleton className="h-10 w-56" />
        <LoadingSkeleton className="h-32 rounded-2xl" />
        <div className="grid grid-cols-2 gap-3">
          <LoadingSkeleton className="h-24 rounded-2xl" />
          <LoadingSkeleton className="h-24 rounded-2xl" />
        </div>
      </div>
    );
  }

  const hasFinancing = canViewFinancing(season);
  const totalActual = computeActualTotal(expenses);

  // Musim aktif tapi belum mulai pembiayaan
  if (!season || !hasFinancing) {
    return (
      <div className="animate-fade-in space-y-6">
        <PageHeader
          title="Beranda"
          subtitle={farm ? `${CROP_LABELS[farm.crop]} · ${farm.areaHa} ha` : 'Selamat datang di AgroChie'}
        />

        <div className="bg-[--primary-soft] rounded-2xl border border-[--primary]/20 p-6 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-[--primary] flex items-center justify-center mx-auto shadow-md">
            <Sprout size={28} className="text-white" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[--text]">Mulai perhitungan pembiayaan</h2>
            <p className="text-sm text-[--text-muted] mt-1.5 max-w-sm mx-auto">
              Lengkapi profil lahan, lalu klik Mulai untuk melihat rencana biaya dan kalender pengeluaran musim ini.
            </p>
          </div>
          <div className="flex gap-3 justify-center flex-wrap">
            <Link href="/profil">
              <AppButton variant="outline" size="md">
                Lengkapi profil dulu
              </AppButton>
            </Link>
            <Link href="/musim-tanam">
              <AppButton size="md" rightIcon={<ArrowRight size={16} />}>
                Mulai sekarang
              </AppButton>
            </Link>
          </div>
        </div>

        {/* Quick links */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { href: '/profil', label: 'Profil lahan', icon: '🌾' },
            { href: '/cuaca-lahan', label: 'Cuaca dan lahan', icon: '⛅' },
            { href: '/pengingat', label: 'Cek lahan', icon: '✅' },
            { href: '/riwayat-musim', label: 'Riwayat musim', icon: '📋' },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="bg-[--surface] border border-[--border] rounded-2xl p-4 flex flex-col items-center gap-2 hover:shadow-md hover:-translate-y-1 transition-all text-center"
            >
              <span className="text-2xl">{item.icon}</span>
              <span className="text-sm font-semibold text-[--text]">{item.label}</span>
            </Link>
          ))}
        </div>
      </div>
    );
  }

  // Musim aktif dengan pembiayaan
  const currentWeek = season.plantingStartedAt
    ? getCurrentWeek(season.plantingStartedAt, season.crop)
    : null;
  const currentPhase = currentWeek
    ? getPhaseForWeek(season.crop, currentWeek)
    : null;
  const p50 = snapshot?.prediction.p50Idr ?? 0;
  const availableCapital = snapshot?.availableCapitalIdr ?? 0;
  const capitalLeft = availableCapital - totalActual;

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Beranda"
        subtitle="Ringkasan musim tanam berjalan"
      />

      {/* Hero */}
      <div className="bg-[--primary] text-white rounded-2xl p-6 shadow-md">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <StatusBadge
                label={SEASON_STATUS_LABELS[season.status]}
                variant="primary"
                size="sm"
                dot
              />
            </div>
            <h2 className="text-xl font-extrabold mt-2">
              {CROP_LABELS[season.crop]} · {season.areaHa} ha
            </h2>
            {currentWeek && currentPhase && (
              <p className="text-white/80 text-sm mt-1">
                Minggu {currentWeek} · {PHASE_LABELS[currentPhase]}
              </p>
            )}
          </div>
          <div className="text-right">
            <p className="text-white/70 text-xs font-semibold">Pengeluaran tercatat</p>
            <p className="text-2xl font-extrabold tabular-nums mt-0.5">
              {formatRupiah(totalActual, true)}
            </p>
            <p className="text-white/60 text-xs">dari ~{formatRupiah(p50, true)} rencana</p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard
          label="Rencana biaya"
          value={formatRupiah(p50, true)}
          subtitle="Estimasi P50"
        />
        <StatCard
          label="Pengeluaran aktual"
          value={formatRupiah(totalActual, true)}
          subtitle="Tercatat"
          trend={totalActual > p50 ? 'up' : 'neutral'}
        />
        <StatCard
          label="Modal tersisa"
          value={formatRupiah(Math.max(0, capitalLeft), true)}
          subtitle="Setelah pengeluaran"
          danger={capitalLeft < 0}
        />
        {snapshot?.gapIdr !== undefined && snapshot.gapIdr > 0 && (
          <StatCard
            label="Kekurangan modal"
            value={formatRupiah(snapshot.gapIdr, true)}
            subtitle="Estimasi awal"
            danger
          />
        )}
      </div>

      {/* Alerts */}
      {snapshot && snapshot.gapIdr > 0 && (
        <div className="flex gap-3 bg-red-50 border border-[--danger]/20 rounded-2xl p-4">
          <AlertTriangle size={20} className="text-[--danger] flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-[--danger] text-sm">Modal diperkirakan tidak mencukupi</p>
            <p className="text-xs text-[--text-muted] mt-0.5">
              Kekurangan estimasi ~{formatRupiah(snapshot.gapIdr, true)}. Pertimbangkan pengajuan pinjaman atau efisiensi biaya.
            </p>
            <Link href="/risiko-kredit">
              <AppButton size="sm" variant="danger" className="mt-2">
                Lihat opsi kredit
              </AppButton>
            </Link>
          </div>
        </div>
      )}

      {/* Quick actions */}
      <SectionCard title="Aksi cepat">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {[
            { href: '/catatan', label: 'Catat pengeluaran', icon: ClipboardList, color: 'text-blue-600 bg-blue-50' },
            { href: '/kalender-uang', label: 'Lihat kalender', icon: CalendarClock, color: 'text-purple-600 bg-purple-50' },
            { href: '/prediksi', label: 'Prediksi biaya', icon: BarChart3, color: 'text-[--primary] bg-[--primary-soft]' },
            { href: '/cuaca-lahan', label: 'Cuaca dan lahan', icon: CloudSun, color: 'text-sky-600 bg-sky-50' },
            { href: '/rencana-biaya', label: 'Rencana biaya', icon: Wallet, color: 'text-emerald-600 bg-emerald-50' },
            { href: '/riwayat-musim', label: 'Riwayat musim', icon: TrendingUp, color: 'text-orange-600 bg-orange-50' },
          ].map((action) => {
            const Icon = action.icon;
            return (
              <Link
                key={action.href}
                href={action.href}
                className="flex items-center gap-3 p-3.5 rounded-xl border border-[--border] hover:shadow-md hover:-translate-y-0.5 transition-all bg-[--surface]"
              >
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${action.color}`}>
                  <Icon size={18} />
                </div>
                <span className="text-sm font-semibold text-[--text]">{action.label}</span>
              </Link>
            );
          })}
        </div>
      </SectionCard>

      {/* Data note */}
      <div className="flex gap-2 bg-[--surface-muted] rounded-xl p-3 border border-[--border]">
        <CheckCircle2 size={15} className="text-[--primary] flex-shrink-0 mt-0.5" />
        <p className="text-xs text-[--text-muted]">
          Angka perkiraan berdasarkan aturan dan simulasi · Data contoh aktif · Bukan prediksi AI
        </p>
      </div>
    </div>
  );
}
