'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { repositories } from '@/infrastructure/repositories';
import { useActiveSeason, canViewFinancing, canViewPlanting } from '@/hooks/useActiveSeason';
import { computePredictionFromFarm } from '@/domain/calculations/baseline-cost';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { AppButton } from '@/components/ui/AppButton';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { StatCard } from '@/components/ui/StatCard';
import { LoadingSkeleton } from '@/components/ui/FeedbackState';
import { formatRupiah, CROP_LABELS } from '@/lib/formatters';
import { CROP_DURATION, PHASE_LABELS, getPhaseForWeek, getCurrentWeek } from '@/domain/calculations/seasons';
import { Play, Square, Sprout, Leaf, CheckCircle2, Lock, Info } from 'lucide-react';

export function MusimTanamView() {
  const qc = useQueryClient();
  const { season, isLoading, farmId } = useActiveSeason();
  const [showStartFinancing, setShowStartFinancing] = useState(false);
  const [showStartPlanting, setShowStartPlanting] = useState(false);
  const [modalInput, setModalInput] = useState('');

  const { data: farm } = useQuery({
    queryKey: ['farm', farmId],
    queryFn: () => repositories.farm.getFarmById(farmId),
    enabled: !!farmId,
  });

  // Mulai pembiayaan
  const startFinancing = useMutation({
    mutationFn: async () => {
      if (!season || !farm) throw new Error('Data tidak lengkap');
      const prediction = computePredictionFromFarm(farm, season.id);
      const capital = modalInput ? parseInt(modalInput.replace(/\D/g, '')) : farm.availableCapitalIdr ?? 0;
      const snapshot = await repositories.financing.saveSnapshot({
        seasonId: season.id,
        createdAt: new Date().toISOString(),
        prediction,
        availableCapitalIdr: capital,
        gapIdr: prediction.p50Idr - capital,
      });
      return repositories.season.updateSeasonStatus(season.id, {
        status: 'financing',
        financingStartedAt: new Date().toISOString().slice(0, 10),
        snapshotId: snapshot.id,
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['season'] });
      setShowStartFinancing(false);
    },
  });

  // Mulai penanaman
  const startPlanting = useMutation({
    mutationFn: async () => {
      if (!season) throw new Error('Tidak ada musim aktif');
      return repositories.season.updateSeasonStatus(season.id, {
        status: 'planting',
        plantingStartedAt: new Date().toISOString().slice(0, 10),
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['season'] });
      setShowStartPlanting(false);
    },
  });

  if (isLoading) {
    return <div className="space-y-4"><LoadingSkeleton className="h-10 w-64" /><LoadingSkeleton className="h-48 rounded-2xl" /></div>;
  }

  const hasFinancing = canViewFinancing(season);
  const hasPlanting = canViewPlanting(season);
  const duration = farm ? CROP_DURATION[farm.crop] : 16;
  const currentWeek = season?.plantingStartedAt
    ? getCurrentWeek(season.plantingStartedAt, season.crop)
    : null;
  const currentPhase = currentWeek && season
    ? getPhaseForWeek(season.crop, currentWeek)
    : null;

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Musim tanam"
        subtitle="Tiga langkah untuk satu musim: pembiayaan, penanaman, dan panen."
      />

      {/* Step 1: Pembiayaan */}
      <SectionCard
        title="Langkah 1 — Mulai perhitungan pembiayaan"
        action={hasFinancing ? <StatusBadge label="Selesai" variant="success" dot /> : undefined}
      >
        {farm ? (
          <div className="space-y-4">
            <div className="bg-[--surface-muted] rounded-xl p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-bold text-[--text]">{CROP_LABELS[farm.crop]}</p>
                  <p className="text-sm text-[--text-muted]">{farm.areaHa} ha · {duration} minggu</p>
                </div>
                {farm.availableCapitalIdr && (
                  <div className="text-right">
                    <p className="text-xs text-[--text-muted] font-semibold">Modal tersedia</p>
                    <p className="font-bold text-[--text] tabular-nums">
                      {formatRupiah(farm.availableCapitalIdr, true)}
                    </p>
                  </div>
                )}
              </div>
            </div>

            {!hasFinancing ? (
              <div className="space-y-3">
                <p className="text-sm text-[--text-muted]">
                  Setelah Mulai, aplikasi akan menghitung perkiraan biaya musim dan membuka menu keuangan.
                </p>
                <AppButton
                  leftIcon={<Play size={16} />}
                  onClick={() => setShowStartFinancing(true)}
                >
                  Mulai perhitungan pembiayaan
                </AppButton>
              </div>
            ) : (
              <div className="flex gap-2 flex-wrap">
                <div className="flex items-center gap-2 text-sm text-[--success] font-semibold">
                  <CheckCircle2 size={16} />
                  Pembiayaan dimulai {season?.financingStartedAt}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-sm text-[--text-muted]">
            Lengkapi profil lahan terlebih dahulu untuk melihat ringkasan komoditas dan luas.
          </div>
        )}
      </SectionCard>

      {/* Step 2: Penanaman */}
      <SectionCard
        title="Langkah 2 — Mulai penanaman"
        action={hasPlanting ? <StatusBadge label="Aktif" variant="success" dot /> : !hasFinancing ? <StatusBadge label="Terkunci" variant="muted" /> : undefined}
      >
        {!hasFinancing ? (
          <div className="flex items-center gap-2 text-sm text-[--text-muted]">
            <Lock size={16} />
            Selesaikan langkah 1 terlebih dahulu.
          </div>
        ) : !hasPlanting ? (
          <div className="space-y-3">
            <div className="flex gap-2 bg-[--primary-soft] rounded-xl p-3">
              <Info size={16} className="text-[--primary] flex-shrink-0 mt-0.5" />
              <p className="text-sm text-[--primary-ink]">
                Tanggal mulai ini digunakan sebagai <strong>minggu 1</strong>, termasuk persiapan lahan, sesuai penyelarasan dataset.
              </p>
            </div>
            <AppButton
              leftIcon={<Sprout size={16} />}
              onClick={() => setShowStartPlanting(true)}
            >
              Mulai penanaman (minggu 1)
            </AppButton>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <StatCard label="Minggu berjalan" value={`${currentWeek ?? '—'} / ${duration}`} />
              <StatCard label="Fase saat ini" value={currentPhase ? PHASE_LABELS[currentPhase] : '—'} />
              <StatCard
                label="Mulai tanam"
                value={season?.plantingStartedAt ?? '—'}
              />
              <StatCard
                label="Perkiraan panen"
                value={
                  season?.plantingStartedAt
                    ? new Date(
                        new Date(season.plantingStartedAt).getTime() +
                          duration * 7 * 24 * 60 * 60 * 1000
                      ).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
                    : '—'
                }
              />
            </div>
          </div>
        )}
      </SectionCard>

      {/* Step 3: Panen */}
      <SectionCard
        title="Langkah 3 — Panen dan tutup musim"
        action={!hasPlanting ? <StatusBadge label="Terkunci" variant="muted" /> : undefined}
      >
        {!hasPlanting ? (
          <div className="flex items-center gap-2 text-sm text-[--text-muted]">
            <Lock size={16} />
            Mulai penanaman terlebih dahulu.
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-[--text-muted]">
              Catat setiap entri panen (tanggal, mutu, berat, harga), ambil sampel ukuran petak, dan unggah minimal 1 foto bukti sebelum menutup musim.
            </p>
            <div className="flex gap-3 flex-wrap">
              <AppButton variant="secondary" leftIcon={<Leaf size={16} />}>
                Tambah entri panen
              </AppButton>
              <AppButton variant="outline" leftIcon={<Square size={16} />}>
                Tutup musim
              </AppButton>
            </div>
            <p className="text-xs text-[--text-muted]">
              Wajib: min. 1 entri panen · berat dan luas sampel &gt; 0 · min. 1 foto · total biaya aktual &gt; 0
            </p>
          </div>
        )}
      </SectionCard>

      {/* Dialog Mulai Pembiayaan */}
      <ConfirmDialog
        open={showStartFinancing}
        title="Mulai perhitungan pembiayaan?"
        description="Aplikasi akan menghitung perkiraan biaya berdasarkan data lahan Anda dan membuka menu keuangan. Anda bisa hitung ulang kapan saja."
        confirmLabel="Mulai"
        cancelLabel="Batal"
        isLoading={startFinancing.isPending}
        onConfirm={() => startFinancing.mutate()}
        onCancel={() => setShowStartFinancing(false)}
      >
        <div>
          <label htmlFor="modal-input" className="text-sm font-bold text-[--text] block mb-1.5">
            Modal tersedia (opsional, Rp)
          </label>
          <input
            id="modal-input"
            type="number"
            value={modalInput}
            onChange={(e) => setModalInput(e.target.value)}
            placeholder={farm?.availableCapitalIdr?.toString() ?? '35000000'}
            className="w-full rounded-xl border border-[--border] px-4 py-2.5 text-[--text] focus:outline-none focus:border-[--primary] focus:ring-2 focus:ring-[--primary]/10 transition"
          />
          <p className="text-xs text-[--text-muted] mt-1">Kosong = pakai modal dari profil lahan.</p>
        </div>
      </ConfirmDialog>

      {/* Dialog Mulai Penanaman */}
      <ConfirmDialog
        open={showStartPlanting}
        title="Mulai penanaman hari ini?"
        description="Tanggal hari ini akan dicatat sebagai awal minggu 1, termasuk persiapan lahan. Pastikan tanggal sudah benar."
        confirmLabel="Mulai penanaman"
        cancelLabel="Batal"
        isLoading={startPlanting.isPending}
        onConfirm={() => startPlanting.mutate()}
        onCancel={() => setShowStartPlanting(false)}
      />
    </div>
  );
}
