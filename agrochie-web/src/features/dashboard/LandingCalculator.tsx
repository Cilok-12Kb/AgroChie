'use client';

import { useState } from 'react';
import { AppButton } from '@/components/ui/AppButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { computeBaselinePrediction } from '@/domain/calculations/baseline-cost';
import { formatRupiah, CROP_LABELS } from '@/lib/formatters';
import type { Crop } from '@/domain/models/types';
import { BarChart3, Info } from 'lucide-react';

const CROPS: Crop[] = ['cabai', 'tomat', 'bawang'];
const AREA_OPTIONS = [0.1, 0.25, 0.5, 1, 1.5, 2, 3];

export function LandingCalculator() {
  const [crop, setCrop] = useState<Crop>('cabai');
  const [area, setArea] = useState(0.5);
  const [result, setResult] = useState<ReturnType<typeof computeBaselinePrediction> | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function handleCalculate() {
    setIsLoading(true);
    // Simulate async
    setTimeout(() => {
      const prediction = computeBaselinePrediction(
        { crop, areaHa: area },
        'landing-demo'
      );
      setResult(prediction);
      setIsLoading(false);
    }, 600);
  }

  return (
    <div className="max-w-xl mx-auto bg-[--surface] rounded-2xl border border-[--border] shadow-md p-6 md:p-8">
      <div className="space-y-5">
        {/* Komoditas */}
        <div>
          <label className="block text-sm font-bold text-[--text] mb-2">
            Komoditas
          </label>
          <div className="grid grid-cols-3 gap-2">
            {CROPS.map((c) => (
              <button
                key={c}
                onClick={() => { setCrop(c); setResult(null); }}
                className={`py-2.5 px-3 rounded-xl text-sm font-semibold border transition-all ${
                  crop === c
                    ? 'bg-[--primary] text-white border-[--primary] shadow-sm'
                    : 'bg-[--surface-muted] text-[--text-muted] border-[--border] hover:border-[--primary]/40'
                }`}
              >
                {CROP_LABELS[c]}
              </button>
            ))}
          </div>
        </div>

        {/* Luas */}
        <div>
          <label htmlFor="area-select" className="block text-sm font-bold text-[--text] mb-2">
            Luas lahan
          </label>
          <select
            id="area-select"
            value={area}
            onChange={(e) => { setArea(Number(e.target.value)); setResult(null); }}
            className="w-full rounded-xl border border-[--border] bg-[--surface] px-4 py-2.5 text-[--text] font-semibold focus:outline-none focus:border-[--primary]"
          >
            {AREA_OPTIONS.map((a) => (
              <option key={a} value={a}>
                {a} hektar ({a < 1 ? `${a * 10000} m²` : `${a} ha`})
              </option>
            ))}
          </select>
        </div>

        <AppButton
          className="w-full"
          size="lg"
          onClick={handleCalculate}
          isLoading={isLoading}
          leftIcon={<BarChart3 size={18} />}
        >
          Mulai hitung perkiraan
        </AppButton>
      </div>

      {/* Result */}
      {result && (
        <div className="mt-6 pt-6 border-t border-[--border] space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-[--text]">Perkiraan biaya satu musim</h3>
            <StatusBadge label="Data contoh" variant="demo" size="sm" />
          </div>

          {/* P50 */}
          <div className="bg-[--primary-soft] rounded-2xl p-4 text-center">
            <p className="text-sm text-[--primary-ink] font-semibold mb-1">Perkiraan tengah</p>
            <p className="text-3xl font-extrabold text-[--primary] tabular-nums">
              {formatRupiah(result.p50Idr, true)}
            </p>
            <p className="text-xs text-[--text-muted] mt-1">
              untuk {CROP_LABELS[crop]} · {area} ha · ~{result.weekly.length} minggu
            </p>
          </div>

          {/* P10-P90 */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-[--surface-muted] rounded-xl p-3 text-center">
              <p className="text-xs text-[--text-muted] font-semibold">Kemungkinan minimum</p>
              <p className="text-lg font-bold text-[--text] tabular-nums">
                {formatRupiah(result.p10Idr, true)}
              </p>
            </div>
            <div className="bg-[--surface-muted] rounded-xl p-3 text-center">
              <p className="text-xs text-[--text-muted] font-semibold">Kemungkinan maksimum</p>
              <p className="text-lg font-bold text-[--text] tabular-nums">
                {formatRupiah(result.p90Idr, true)}
              </p>
            </div>
          </div>

          {/* Disclaimer */}
          <div className="flex gap-2 bg-yellow-50 border border-yellow-200 rounded-xl p-3">
            <Info size={16} className="text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-800 leading-relaxed">
              <strong>Estimasi berbasis aturan dan simulasi</strong> · Bukan prediksi AI · Angka tidak menjamin hasil nyata. 
              Daftar untuk rencana biaya yang lebih sesuai lahan Anda.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
