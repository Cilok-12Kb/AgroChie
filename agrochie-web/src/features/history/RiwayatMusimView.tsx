'use client';

import { useQuery } from '@tanstack/react-query';
import { repositories } from '@/infrastructure/repositories';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatCard } from '@/components/ui/StatCard';
import { AppButton } from '@/components/ui/AppButton';
import { EmptyState, LoadingSkeleton } from '@/components/ui/FeedbackState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { formatRupiah } from '@/lib/formatters';
import { CROP_LABELS } from '@/lib/formatters';
import Link from 'next/link';
import { Eye, CheckCircle2, AlertCircle, Clock, Download } from 'lucide-react';

const QUALITY_CONFIG = {
  READY_WEEKLY: { label: 'Siap dilatih', variant: 'success' as const, desc: 'Semua data lengkap termasuk biaya mingguan.' },
  READY_TOTAL_ONLY: { label: 'Siap, total saja', variant: 'success' as const, desc: 'Data lengkap, biaya mingguan tidak tersedia.' },
  INCOMPLETE: { label: 'Belum lengkap', variant: 'warning' as const, desc: 'Ada data wajib yang belum diisi.' },
  DEMO: { label: 'Contoh', variant: 'demo' as const, desc: 'Record demo, tidak ikut ekspor.' },
};

export function RiwayatMusimView() {
  const { data: seasons = [], isLoading: seasonsLoading } = useQuery({
    queryKey: ['seasons', 'all'],
    queryFn: () => repositories.season.getSeasonsByFarm('f-001'),
  });

  const { data: records = [], isLoading: recordsLoading } = useQuery({
    queryKey: ['records', 'all'],
    queryFn: () => repositories.record.getAllRecords(),
  });

  const closedSeasons = seasons.filter((s) => s.status === 'closed');

  if (seasonsLoading || recordsLoading) {
    return (
      <div className="space-y-4">
        <LoadingSkeleton className="h-10 w-64" />
        <LoadingSkeleton className="h-48 rounded-2xl" />
        <LoadingSkeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Riwayat musim"
        subtitle="Catatan musim tanam yang sudah selesai — inti pengumpulan data nyata."
        action={
          <Link href="/musim-tanam">
            <AppButton size="sm" variant="secondary">+ Musim baru</AppButton>
          </Link>
        }
      />

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <StatCard label="Total musim" value={seasons.length} subtitle="Semua status" />
        <StatCard label="Musim selesai" value={closedSeasons.length} subtitle="Tertutup" />
        <StatCard
          label="Siap dilatih"
          value={records.filter((r) => r.qualityStatus === 'READY_WEEKLY' || r.qualityStatus === 'READY_TOTAL_ONLY').length}
          subtitle="Record berkualitas"
        />
      </div>

      {/* Riwayat list */}
      {closedSeasons.length === 0 ? (
        <EmptyState
          title="Belum ada musim yang selesai"
          description="Selesaikan satu musim tanam dari menu Musim tanam untuk melihat riwayat di sini."
          action={
            <Link href="/musim-tanam">
              <AppButton size="sm">Buka musim tanam</AppButton>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {closedSeasons.map((season) => {
            const record = records.find((r) => r.seasonId === season.id);
            const quality = record ? QUALITY_CONFIG[record.qualityStatus] : null;
            return (
              <div
                key={season.id}
                className="bg-[--surface] rounded-2xl border border-[--border] p-5 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-[--text]">
                        {CROP_LABELS[season.crop]} · {season.areaHa} ha
                      </h3>
                      {quality && (
                        <StatusBadge label={quality.label} variant={quality.variant} size="sm" dot />
                      )}
                    </div>
                    <div className="flex gap-4 mt-2 text-xs text-[--text-muted]">
                      {season.plantingStartedAt && (
                        <span className="flex items-center gap-1">
                          <Clock size={12} /> {season.plantingStartedAt} — {season.closedAt ?? '?'}
                        </span>
                      )}
                    </div>
                    {season.totalActualCostIdr !== undefined && (
                      <p className="text-sm font-bold text-[--text] mt-1.5 tabular-nums">
                        Biaya aktual: {formatRupiah(season.totalActualCostIdr, true)}
                      </p>
                    )}
                    {quality && (
                      <p className="text-xs text-[--text-muted] mt-0.5">{quality.desc}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2 flex-shrink-0">
                    <AppButton size="sm" variant="outline" leftIcon={<Eye size={14} />}>
                      Detail
                    </AppButton>
                    {record && (record.qualityStatus === 'READY_WEEKLY' || record.qualityStatus === 'READY_TOTAL_ONLY') && (
                      <AppButton size="sm" variant="ghost" leftIcon={<Download size={14} />}>
                        Ekspor CSV
                      </AppButton>
                    )}
                  </div>
                </div>

                {/* Data quality checklist */}
                {record && (
                  <div className="mt-4 pt-4 border-t border-[--border] grid grid-cols-2 md:grid-cols-4 gap-2">
                    {[
                      { label: 'Data lahan', ok: !!record.soilType },
                      { label: 'Data cuaca', ok: !!record.avgRainMmPerWeek },
                      { label: 'Biaya aktual', ok: !!record.totalActualCostIdr },
                      { label: 'Biaya mingguan', ok: (record.weeklyExpenses?.length ?? 0) > 0 },
                    ].map((item) => (
                      <div key={item.label} className="flex items-center gap-1.5 text-xs">
                        {item.ok ? (
                          <CheckCircle2 size={13} className="text-[--success] flex-shrink-0" />
                        ) : (
                          <AlertCircle size={13} className="text-[--warning] flex-shrink-0" />
                        )}
                        <span className={item.ok ? 'text-[--text]' : 'text-[--text-muted]'}>{item.label}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Info ekspor */}
      <SectionCard muted>
        <div className="flex gap-3">
          <CheckCircle2 size={18} className="text-[--primary] flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-[--text] text-sm">Tentang ekspor data latih</p>
            <p className="text-xs text-[--text-muted] mt-1 leading-relaxed">
              CSV 32 kolom hanya tersedia untuk record berkualitas cukup. Data dianonimkan — tidak memuat nama, nomor HP, desa, atau koordinat. Mengunduh CSV <strong>bukan</strong> berarti persetujuan otomatis untuk pelatihan model AI. Persetujuan terpisah diperlukan jika data dikirim ke server.
            </p>
          </div>
        </div>
      </SectionCard>
    </div>
  );
}
