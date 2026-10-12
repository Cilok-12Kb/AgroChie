'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { repositories } from '@/infrastructure/repositories';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { AppButton } from '@/components/ui/AppButton';
import { LoadingSkeleton } from '@/components/ui/FeedbackState';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useState } from 'react';
import { CheckCircle2, AlertCircle, Save } from 'lucide-react';
import type { Farm } from '@/domain/models/types';
import {
  CROP_LABELS, SOIL_TYPE_LABELS, WATER_SOURCE_LABELS,
  PROVINCE_LABELS, NUTRIENT_LABELS,
} from '@/lib/formatters';

const farmSchema = z.object({
  name: z.string().min(1, 'Nama lahan wajib diisi'),
  crop: z.enum(['cabai', 'tomat', 'bawang']),
  areaHa: z.number().min(0.01, 'Luas minimal 0,01 ha').max(5, 'Luas maksimal 5 ha'),
  soilType: z.string().optional(),
  waterSource: z.string().optional(),
  province: z.string().optional(),
  ph: z.number().min(3).max(10).optional().or(z.nan()),
  nitrogen: z.string().optional(),
  phosphorus: z.string().optional(),
  potassium: z.string().optional(),
  availableCapitalIdr: z.number().min(0).optional().or(z.nan()),
  expectedPricePerKgIdr: z.number().min(0).optional().or(z.nan()),
});

type FarmForm = z.infer<typeof farmSchema>;

function FieldRow({
  label, children, hint,
}: { label: string; children: React.ReactNode; hint?: string }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-sm font-bold text-[--text]">{label}</label>
      {children}
      {hint && <p className="text-xs text-[--text-muted]">{hint}</p>}
    </div>
  );
}

const inputCls =
  'w-full rounded-xl border border-[--border] bg-[--surface] px-4 py-2.5 text-[--text] focus:outline-none focus:border-[--primary] focus:ring-2 focus:ring-[--primary]/10 transition font-semibold';

export function ProfilView() {
  const qc = useQueryClient();
  const [saved, setSaved] = useState(false);

  const { data: farm, isLoading } = useQuery({
    queryKey: ['farm', 'f-001'],
    queryFn: () => repositories.farm.getFarmById('f-001'),
  });

  const { register, handleSubmit, formState: { errors }, watch } = useForm<FarmForm>({
    resolver: zodResolver(farmSchema),
    defaultValues: {
      name: farm?.name ?? '',
      crop: farm?.crop ?? 'cabai',
      areaHa: farm?.areaHa ?? 0.5,
      soilType: farm?.soilType ?? '',
      waterSource: farm?.waterSource ?? '',
      province: farm?.province ?? '',
      ph: farm?.ph,
      nitrogen: farm?.nitrogen ?? '',
      phosphorus: farm?.phosphorus ?? '',
      potassium: farm?.potassium ?? '',
      availableCapitalIdr: farm?.availableCapitalIdr,
      expectedPricePerKgIdr: farm?.expectedPricePerKgIdr,
    },
    values: farm as FarmForm | undefined,
  });

  const areaHa = watch('areaHa');
  const isOutOfRange = areaHa > 3;

  const mutation = useMutation({
    mutationFn: (data: FarmForm) =>
      repositories.farm.saveFarm({ ...data, id: 'f-001', userId: 'u-001' } as Partial<Farm>),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['farm'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    },
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        <LoadingSkeleton className="h-10 w-56" />
        <LoadingSkeleton className="h-64 rounded-2xl" />
        <LoadingSkeleton className="h-48 rounded-2xl" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit((d) => mutation.mutate(d))} className="animate-fade-in space-y-6">
      <PageHeader
        title="Profil dan lahan"
        subtitle="Lengkapi data lahan agar rencana biaya lebih sesuai kondisi Anda."
        action={
          <AppButton
            type="submit"
            isLoading={mutation.isPending}
            leftIcon={saved ? <CheckCircle2 size={16} /> : <Save size={16} />}
            variant={saved ? 'secondary' : 'primary'}
          >
            {saved ? 'Tersimpan!' : 'Simpan profil'}
          </AppButton>
        }
      />

      {/* 1. Data lahan */}
      <SectionCard title="Data lahan">
        <div className="grid md:grid-cols-2 gap-4">
          <FieldRow label="Nama lahan">
            <input {...register('name')} placeholder="Contoh: Lahan Utama" className={inputCls} />
            {errors.name && <p className="text-xs text-[--danger]">{errors.name.message}</p>}
          </FieldRow>

          <FieldRow label="Komoditas">
            <select {...register('crop')} className={inputCls}>
              {Object.entries(CROP_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </FieldRow>

          <FieldRow
            label="Luas lahan (ha)"
            hint={isOutOfRange ? '⚠️ Di luar cakupan data pelatihan awal (>3 ha). Estimasi kurang akurat.' : 'Dataset mendukung 0,1–3 ha. Profil bisa hingga 5 ha.'}
          >
            <input
              {...register('areaHa', { valueAsNumber: true })}
              type="number"
              step="0.01"
              min="0.01"
              max="5"
              placeholder="0.5"
              className={inputCls}
            />
            {isOutOfRange && (
              <StatusBadge label="Di luar cakupan data pelatihan" variant="warning" size="sm" />
            )}
            {errors.areaHa && <p className="text-xs text-[--danger]">{errors.areaHa.message}</p>}
          </FieldRow>

          <FieldRow label="Jenis tanah">
            <select {...register('soilType')} className={inputCls}>
              <option value="">— Pilih jenis tanah —</option>
              {Object.entries(SOIL_TYPE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </FieldRow>

          <FieldRow label="Sumber air">
            <select {...register('waterSource')} className={inputCls}>
              <option value="">— Pilih sumber air —</option>
              {Object.entries(WATER_SOURCE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </FieldRow>

          <FieldRow label="Provinsi">
            <select {...register('province')} className={inputCls}>
              <option value="">— Pilih provinsi —</option>
              {Object.entries(PROVINCE_LABELS).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </FieldRow>
        </div>
      </SectionCard>

      {/* 2. Kondisi tanah */}
      <SectionCard title="Kondisi tanah">
        <div className="grid md:grid-cols-2 gap-4">
          <FieldRow label="pH tanah" hint="Nilai normal: 5,5 – 7,5. Jangan tebak jika belum diukur.">
            <input
              {...register('ph', { valueAsNumber: true })}
              type="number"
              step="0.1"
              min="3"
              max="10"
              placeholder="6.5"
              className={inputCls}
            />
          </FieldRow>

          {(['nitrogen', 'phosphorus', 'potassium'] as const).map((nutrient) => {
            const labels: Record<string, string> = {
              nitrogen: 'Nitrogen (N)',
              phosphorus: 'Fosfor (P)',
              potassium: 'Kalium (K)',
            };
            return (
              <FieldRow key={nutrient} label={labels[nutrient]}>
                <select {...register(nutrient)} className={inputCls}>
                  <option value="">— Pilih kadar —</option>
                  {Object.entries(NUTRIENT_LABELS).map(([val, label]) => (
                    <option key={val} value={val}>{label}</option>
                  ))}
                </select>
              </FieldRow>
            );
          })}
        </div>
      </SectionCard>

      {/* 3. Rencana keuangan */}
      <SectionCard
        title="Rencana keuangan"
        subtitle="Input ini boleh diisi sebelum memulai pembiayaan. Estimasi biaya tetap disembunyikan hingga Anda klik Mulai."
      >
        <div className="grid md:grid-cols-2 gap-4">
          <FieldRow label="Modal tersedia (Rp)">
            <input
              {...register('availableCapitalIdr', { valueAsNumber: true })}
              type="number"
              step="100000"
              placeholder="35000000"
              className={inputCls}
            />
          </FieldRow>

          <FieldRow label="Perkiraan harga jual (Rp/kg)">
            <input
              {...register('expectedPricePerKgIdr', { valueAsNumber: true })}
              type="number"
              step="1000"
              placeholder="25000"
              className={inputCls}
            />
          </FieldRow>
        </div>
      </SectionCard>

      {/* Info note */}
      <div className="flex gap-2 text-xs text-[--text-muted] bg-[--surface-muted] rounded-xl p-3 border border-[--border]">
        <AlertCircle size={14} className="flex-shrink-0 mt-0.5 text-[--warning]" />
        <span>
          Data profil ini digunakan untuk menghitung perkiraan biaya musim. Mengubah komoditas atau luas setelah pembiayaan dimulai tidak otomatis memperbarui snapshot awal — Anda perlu hitung ulang secara eksplisit.
        </span>
      </div>

      <div className="flex justify-end">
        <AppButton
          type="submit"
          isLoading={mutation.isPending}
          size="lg"
          leftIcon={saved ? <CheckCircle2 size={18} /> : <Save size={18} />}
          variant={saved ? 'secondary' : 'primary'}
        >
          {saved ? 'Profil tersimpan!' : 'Simpan profil'}
        </AppButton>
      </div>
    </form>
  );
}
