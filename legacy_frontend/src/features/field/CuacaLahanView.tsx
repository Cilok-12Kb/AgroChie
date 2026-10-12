'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { AppButton } from '@/components/ui/AppButton';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts';
import { CloudRain, Thermometer, Droplets, RefreshCw, Camera, Leaf, Info, AlertCircle } from 'lucide-react';

// Data cuaca simulasi — dibuat sekali saat module load (aman untuk prerender karena tidak memakai Date selama render)
function buildMockWeather() {
  const BASE_LABELS = ['Sen', 'Sel', 'Rab', 'Kam', 'Jum', 'Sab', 'Min'];
  return BASE_LABELS.map((label, i) => ({
    label: `${label} ${i + 1}`,
    hujan: 5 + ((i * 7 + 3) % 18),
    suhu: 28 + ((i * 3 + 1) % 7),
    kelembaban: 70 + ((i * 5 + 2) % 20),
  }));
}

const MOCK_WEATHER = buildMockWeather();

const TABS = [
  { id: 'cuaca', label: 'Cuaca', icon: CloudRain },
  { id: 'tanah', label: 'Kondisi tanah', icon: Droplets },
  { id: 'tanaman', label: 'Kondisi tanaman', icon: Leaf },
  { id: 'foto', label: 'Foto lahan', icon: Camera },
];

export function CuacaLahanView() {
  const [activeTab, setActiveTab] = useState('cuaca');

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader title="Cuaca dan lahan" subtitle="Pantau kondisi cuaca, tanah, dan tanaman lahan Anda." />

      {/* Tabs */}
      <div className="flex gap-1 bg-[--surface-muted] p-1 rounded-2xl overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap flex-shrink-0 ${
                activeTab === tab.id
                  ? 'bg-[--surface] text-[--primary] shadow-sm'
                  : 'text-[--text-muted] hover:text-[--text]'
              }`}
            >
              <Icon size={15} />
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* Tab: Cuaca */}
      {activeTab === 'cuaca' && (
        <div className="space-y-4 animate-fade-in">
          <div className="flex items-center justify-between">
            <StatusBadge label="Data simulasi · Bukan Open-Meteo" variant="demo" dot />
            <AppButton size="sm" variant="ghost" leftIcon={<RefreshCw size={14} />}>
              Perbarui
            </AppButton>
          </div>

          {/* Ringkasan hari ini */}
          <div className="grid grid-cols-3 gap-3">
            <div className="bg-[--primary-soft] rounded-2xl p-4 text-center">
              <CloudRain size={24} className="text-[--primary] mx-auto mb-1" />
              <p className="text-2xl font-bold text-[--primary] tabular-nums">{MOCK_WEATHER[0].hujan}mm</p>
              <p className="text-xs text-[--text-muted]">Hujan hari ini</p>
            </div>
            <div className="bg-orange-50 rounded-2xl p-4 text-center">
              <Thermometer size={24} className="text-orange-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-orange-600 tabular-nums">{MOCK_WEATHER[0].suhu}°C</p>
              <p className="text-xs text-[--text-muted]">Suhu siang</p>
            </div>
            <div className="bg-sky-50 rounded-2xl p-4 text-center">
              <Droplets size={24} className="text-sky-500 mx-auto mb-1" />
              <p className="text-2xl font-bold text-sky-600 tabular-nums">{MOCK_WEATHER[0].kelembaban}%</p>
              <p className="text-xs text-[--text-muted]">Kelembaban</p>
            </div>
          </div>

          {/* Chart 7 hari */}
          <SectionCard title="Prakiraan hujan 7 hari ke depan">
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={MOCK_WEATHER} margin={{ top: 4, right: 8, left: -24, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: 'var(--text-muted)' }} />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-muted)' }} unit="mm" />
                  <Tooltip
                    formatter={(v: unknown) => [`${Number(v)} mm`, 'Hujan']}
                    contentStyle={{ borderRadius: 12, border: '1px solid var(--border)', fontSize: 12 }}
                  />
                  <Area
                    type="monotone"
                    dataKey="hujan"
                    stroke="var(--primary)"
                    fill="var(--primary-soft)"
                    strokeWidth={2}
                    name="Curah hujan"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <div className="flex gap-2 bg-yellow-50 border border-yellow-200 rounded-xl p-3">
            <Info size={15} className="text-yellow-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-yellow-800">
              Data cuaca adalah simulasi. Pada produksi, data akan diambil dari Open-Meteo melalui backend API. Jangan gunakan sebagai acuan keputusan pertanian nyata.
            </p>
          </div>
        </div>
      )}

      {/* Tab: Tanah */}
      {activeTab === 'tanah' && (
        <div className="space-y-4 animate-fade-in">
          <SectionCard title="Kondisi tanah lahan">
            <div className="space-y-4">
              {[
                { label: 'pH tanah', value: '6.2', status: 'normal', hint: 'pH 5,5–7 baik untuk cabai dan tomat. pH < 5,5 memerlukan kapur dolomit.' },
                { label: 'Nitrogen (N)', value: 'Sedang', status: 'normal', hint: 'Kandungan sedang — pupuk dasar sesuai standar.' },
                { label: 'Fosfor (P)', value: 'Rendah', status: 'warning', hint: 'Fosfor rendah dapat meningkatkan kebutuhan pupuk TSP/SP-36.' },
                { label: 'Kalium (K)', value: 'Sedang', status: 'normal', hint: 'Kandungan sedang — kebutuhan pupuk KCl normal.' },
              ].map((item) => (
                <div key={item.label} className="flex items-start justify-between gap-4 py-3 border-b border-[--border] last:border-0">
                  <div>
                    <p className="font-bold text-[--text] text-sm">{item.label}</p>
                    <p className="text-xs text-[--text-muted] mt-0.5">{item.hint}</p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className="font-bold text-[--text]">{item.value}</span>
                    <StatusBadge
                      label={item.status === 'warning' ? 'Rendah' : 'Normal'}
                      variant={item.status === 'warning' ? 'warning' : 'success'}
                      size="sm"
                    />
                  </div>
                </div>
              ))}
            </div>
            <p className="text-xs text-[--text-muted] mt-3">Data dari profil lahan. Perbarui setelah pengukuran nyata di lahan.</p>
          </SectionCard>
        </div>
      )}

      {/* Tab: Tanaman (P2 - CNN belum aktif) */}
      {activeTab === 'tanaman' && (
        <div className="animate-fade-in">
          <SectionCard>
            <div className="text-center py-8 space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-[--surface-muted] flex items-center justify-center mx-auto">
                <AlertCircle size={32} className="text-[--text-muted]" />
              </div>
              <div>
                <h3 className="font-bold text-lg text-[--text]">Analisis foto otomatis belum tersedia</h3>
                <p className="text-sm text-[--text-muted] mt-1.5 max-w-sm mx-auto">
                  Fitur analisis kondisi tanaman (CNN) sedang dalam pengembangan. Untuk saat ini, gunakan panduan lapangan atau konsultasikan dengan PPL setempat.
                </p>
              </div>
              <StatusBadge label="Segera hadir" variant="muted" />
            </div>
          </SectionCard>
        </div>
      )}

      {/* Tab: Foto lahan (P2) */}
      {activeTab === 'foto' && (
        <div className="animate-fade-in">
          <SectionCard title="Foto progres lahan">
            <div className="space-y-4">
              <div className="flex gap-2 bg-yellow-50 border border-yellow-200 rounded-xl p-3">
                <Info size={15} className="text-yellow-600 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-yellow-800">
                  Metadata GPS dan waktu foto ditampilkan <strong>hanya jika tersedia dari perangkat</strong>. Jangan klaim foto terverifikasi jika metadata tidak ada.
                </p>
              </div>
              <div className="border-2 border-dashed border-[--border] rounded-2xl p-8 text-center space-y-3">
                <Camera size={32} className="text-[--text-muted] mx-auto" />
                <div>
                  <p className="font-bold text-[--text]">Unggah foto lahan</p>
                  <p className="text-sm text-[--text-muted]">Maks. 6 foto · Format JPG/PNG · Koordinat GPS jika disetujui</p>
                </div>
                <AppButton variant="outline" size="sm">Pilih foto</AppButton>
              </div>
            </div>
          </SectionCard>
        </div>
      )}
    </div>
  );
}
