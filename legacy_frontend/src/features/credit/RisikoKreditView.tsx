'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { repositories } from '@/infrastructure/repositories';
import { useActiveSeason, canViewFinancing } from '@/hooks/useActiveSeason';
import { computeActualTotal } from '@/domain/calculations/cashflow';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatCard } from '@/components/ui/StatCard';
import { AppButton } from '@/components/ui/AppButton';
import { EmptyState } from '@/components/ui/FeedbackState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { formatRupiah, formatPersen } from '@/lib/formatters';
import { Lock, Info, ShieldCheck, FileText, Send } from 'lucide-react';

// Hitung skor kesiapan kredit heuristik
function computeCreditScore(
  expenseCount: number,
  totalActual: number,
  totalPlan: number,
  hasPhoto: boolean
): { score: number; label: string; components: Array<{ label: string; score: number; weight: number; desc: string }> } {
  // Disiplin biaya 35%
  const variance = totalPlan > 0 ? Math.abs(totalActual - totalPlan) / totalPlan : 0;
  const costDiscipline = Math.max(0, 1 - variance) * 0.35;

  // Kelengkapan catatan 20%
  const recordScore = Math.min(expenseCount / 10, 1) * 0.20;

  // Bukti foto 15%
  const photoScore = (hasPhoto ? 1 : 0) * 0.15;

  // Kemampuan bayar 30% (simpel: modal vs rencana)
  const payScore = totalPlan > 0 ? Math.min(totalActual / totalPlan, 1) * 0.30 : 0;

  const raw = costDiscipline + recordScore + photoScore + payScore;
  const score = Math.round(300 + raw * 550); // scale 300-850

  const label =
    score >= 750 ? 'Sangat baik' :
    score >= 650 ? 'Baik' :
    score >= 550 ? 'Cukup' :
    score >= 450 ? 'Perlu ditingkatkan' : 'Rendah';

  return {
    score,
    label,
    components: [
      { label: 'Disiplin biaya', score: Math.round(costDiscipline * 1000) / 10, weight: 35, desc: 'Seberapa dekat pengeluaran dengan rencana.' },
      { label: 'Kelengkapan catatan', score: Math.round(recordScore * 1000 / 0.20) / 10, weight: 20, desc: 'Jumlah transaksi yang tercatat.' },
      { label: 'Bukti foto', score: hasPhoto ? 100 : 0, weight: 15, desc: 'Foto lahan yang diunggah.' },
      { label: 'Kemampuan bayar', score: Math.round(payScore * 1000 / 0.30) / 10, weight: 30, desc: 'Rasio pengeluaran aktual terhadap rencana.' },
    ],
  };
}

export function RisikoKreditView() {
  const { season, farmId } = useActiveSeason();
  const hasFinancing = canViewFinancing(season);
  const [showApply, setShowApply] = useState(false);
  const [submitted, setSubmitted] = useState(false);

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

  const qc = useQueryClient();
  const applyMutation = useMutation({
    mutationFn: () =>
      repositories.loan.saveLoanApplication({
        seasonId: season!.id,
        amountIdr: snapshot ? Math.max(0, snapshot.gapIdr) : 0,
        purpose: 'Kekurangan modal musim tanam',
        tenorMonths: 6,
        status: 'submitted',
        origin: 'demo',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['loans'] });
      setShowApply(false);
      setSubmitted(true);
    },
  });

  if (!hasFinancing) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Risiko dan kredit" />
        <EmptyState
          icon={<Lock size={40} className="text-[--text-muted]" />}
          title="Mulai pembiayaan untuk melihat kesiapan kredit"
          description="Buka Musim tanam → Mulai perhitungan pembiayaan."
        />
      </div>
    );
  }

  const totalActual = computeActualTotal(expenses.filter((e) => e.origin === 'actual'));
  const totalPlan = snapshot?.prediction.p50Idr ?? 0;
  const { score, label, components } = computeCreditScore(
    expenses.filter((e) => e.origin === 'actual').length,
    totalActual,
    totalPlan,
    false
  );
  const gap = snapshot?.gapIdr ?? 0;
  const scoreColor = score >= 700 ? 'text-[--success]' : score >= 550 ? 'text-[--warning]' : 'text-[--danger]';

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Risiko dan kredit"
        subtitle="Indikator kesiapan pengajuan pinjaman berdasarkan data musim ini."
      />

      {/* Credit readiness score */}
      <SectionCard title="Indikator kesiapan kredit">
        <div className="flex items-center gap-6 mb-5">
          <div className="text-center">
            <p className={`text-5xl font-extrabold tabular-nums ${scoreColor}`}>{score}</p>
            <p className={`text-sm font-bold mt-1 ${scoreColor}`}>{label}</p>
            <p className="text-xs text-[--text-muted] mt-0.5">dari 850 maksimum</p>
          </div>
          {/* Gauge bar */}
          <div className="flex-1">
            <div className="h-3 bg-[--border] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-700"
                style={{
                  width: `${((score - 300) / 550) * 100}%`,
                  backgroundColor: score >= 700 ? 'var(--success)' : score >= 550 ? 'var(--warning)' : 'var(--danger)',
                }}
              />
            </div>
            <div className="flex justify-between text-xs text-[--text-muted] mt-1">
              <span>300</span><span>550</span><span>700</span><span>850</span>
            </div>
          </div>
        </div>

        <div className="flex gap-2 bg-[--surface-muted] rounded-xl p-3 mb-4">
          <Info size={14} className="text-[--text-muted] flex-shrink-0 mt-0.5" />
          <p className="text-xs text-[--text-muted]">
            <strong>Indikator kesiapan (heuristik, bukan skor kredit bank).</strong> Nilai ini hanya gambaran kelengkapan data, bukan penilaian kredit resmi. Keputusan ditentukan bank/koperasi.
          </p>
        </div>

        <div className="space-y-3">
          {components.map((c) => (
            <div key={c.label}>
              <div className="flex justify-between mb-1">
                <span className="text-sm font-bold text-[--text]">{c.label}</span>
                <span className="text-sm text-[--text-muted]">{c.weight}% bobot · {c.score.toFixed(0)}% tercapai</span>
              </div>
              <div className="h-1.5 bg-[--border] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[--primary] rounded-full"
                  style={{ width: `${c.score}%` }}
                />
              </div>
              <p className="text-xs text-[--text-muted] mt-0.5">{c.desc}</p>
            </div>
          ))}
        </div>
      </SectionCard>

      {/* Gap modal */}
      {gap > 0 && (
        <SectionCard title="Kebutuhan tambahan modal">
          <div className="grid grid-cols-2 gap-3">
            <StatCard label="Perkiraan kekurangan" value={formatRupiah(gap, true)} subtitle="Estimasi awal" danger />
            <StatCard label="Total kebutuhan" value={formatRupiah(totalPlan, true)} subtitle="Estimasi P50" />
          </div>
          <p className="text-xs text-[--text-muted] mt-3">
            Kekurangan ini adalah estimasi; aktual bergantung pada pengeluaran nyata selama musim.
          </p>
        </SectionCard>
      )}

      {/* Pengajuan pinjaman */}
      {submitted ? (
        <div className="flex gap-3 bg-[--primary-soft] border border-[--primary]/20 rounded-2xl p-5">
          <ShieldCheck size={20} className="text-[--primary] flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-[--primary-ink]">Pengajuan contoh tersimpan</p>
            <p className="text-sm text-[--text-muted] mt-1">
              <strong>Ini adalah pengajuan contoh — belum dikirim ke bank.</strong> Integrasi bank/koperasi belum aktif. Kode rujukan hanya akan diterbitkan setelah integrasi produksi tersedia.
            </p>
          </div>
        </div>
      ) : (
        <SectionCard title="Ajukan pinjaman">
          <p className="text-sm text-[--text-muted] mb-4">
            Siapkan dokumen pendukung: profil lahan, rencana biaya, catatan pengeluaran, dan foto bukti (jika ada).
          </p>
          <div className="space-y-2 mb-5">
            {[
              'Profil lahan dan komoditas',
              'Rencana biaya (P10/P50/P90)',
              'Catatan pengeluaran aktual',
              'Foto lahan (jika tersedia)',
            ].map((item) => (
              <div key={item} className="flex items-center gap-2">
                <FileText size={14} className="text-[--text-muted]" />
                <span className="text-sm text-[--text-muted]">{item}</span>
              </div>
            ))}
          </div>
          <div className="flex gap-2 bg-yellow-50 border border-yellow-200 rounded-xl p-3 mb-4">
            <Info size={14} className="text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-800">
              <strong>Kode rujukan bukan persetujuan pinjaman.</strong> Keputusan ditentukan bank/koperasi, bukan aplikasi ini.
            </p>
          </div>
          <AppButton leftIcon={<Send size={16} />} onClick={() => setShowApply(true)}>
            Ajukan pinjaman (demo)
          </AppButton>
        </SectionCard>
      )}

      <ConfirmDialog
        open={showApply}
        title="Ajukan pinjaman? (Demo)"
        description="Ini adalah pengajuan contoh. Data tidak akan dikirim ke bank atau koperasi sungguhan. Integrasi bank belum aktif."
        confirmLabel="Ya, simpan sebagai contoh"
        cancelLabel="Batal"
        isLoading={applyMutation.isPending}
        onConfirm={() => applyMutation.mutate()}
        onCancel={() => setShowApply(false)}
      />
    </div>
  );
}
