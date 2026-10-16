'use client';
import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import Link from 'next/link';
import {
  AlertTriangle, ArrowUpRight, Bell, CalendarDays, CheckCircle2,
  ClipboardList, CloudSun, Droplets, History, Info, Leaf,
  MapPinned, Sprout, TrendingUp, Wallet, Wind, Zap,
} from 'lucide-react';
import {
  api, amount, CROP_NAME, CROP_WEEKS, percent, rupiah, shortDate,
} from './api';
import { useWorkspace } from './hooks';
import { Busy, Card, Empty, ErrorLine, Heading, Tag } from './ui';

/* ─── Types ───────────────────────────────────────────────────────────── */
type W = ReturnType<typeof useWorkspace>;

/* ─── Helpers ─────────────────────────────────────────────────────────── */
const STATUS_LABEL: Record<string, string> = {
  DRAFT: 'Persiapan', PEMBIAYAAN: 'Pembiayaan aktif',
  TANAM: 'Sedang menanam', PANEN: 'Masa panen', SELESAI: 'Selesai',
};
const STATUS_COLOR: Record<string, string> = {
  DRAFT: 'amber', PEMBIAYAAN: 'green', TANAM: 'green', PANEN: 'green', SELESAI: 'gray',
};

function currentWeek(plantedOn: string, totalWeeks: number): number {
  const start = Date.parse(plantedOn);
  const wk = Math.floor((Date.now() - start) / 604_800_000) + 1;
  return Math.max(1, Math.min(totalWeeks, wk));
}

/* ─── Sub-components ──────────────────────────────────────────────────── */

/** Hero — komoditas, minggu berjalan, progress bar */
function SeasonHero({ w }: { w: W }) {
  const s = w.season!;
  const plan = s.status !== 'DRAFT' ? s.costPlan : null;
  const totalWks = CROP_WEEKS[s.crop];
  const week = s.plantedOn ? currentWeek(s.plantedOn, totalWks) : null;
  const expenses = w.expenses.data ?? [];
  const totalActual = expenses.filter(e => !e.simulated).reduce((sum, e) => sum + amount(e.amountJt), 0);
  const totalPlan = amount(plan?.p50Jt);
  const progress = percent(totalActual, totalPlan);
  const capital = amount(plan?.capitalJt ?? s.capitalJt);
  const remaining = capital > 0 ? capital - totalActual : null;
  const isShort = remaining !== null && remaining < 0;

  return (
    <div className="rounded-2xl overflow-hidden" style={{ background: 'linear-gradient(135deg,#145e38 0%,#1d7a4a 60%,#22924d 100%)' }}>
      <div className="p-6 sm:p-8">
        {/* Top row */}
        <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sprout size={16} className="text-emerald-300" />
              <span className="text-emerald-200 text-xs font-bold tracking-wide uppercase">Musim aktif</span>
            </div>
            <h2 className="text-white text-2xl sm:text-3xl font-black tracking-tight">
              {CROP_NAME[s.crop]}
            </h2>
            <p className="text-emerald-200 text-sm mt-1">
              {amount(s.areaHa)} ha · <span data-no-translate>{w.farm?.name ?? 'Lahan terdaftar'}</span>
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span className={`console-tag ${s.status === 'DRAFT' ? 'bg-amber-100 text-amber-800' : 'bg-white/20 text-white'} text-xs`}>
              {STATUS_LABEL[s.status]}
            </span>
            {s.plantedOn && (
              <span className="text-emerald-200 text-xs">Tanam: {shortDate(s.plantedOn)}</span>
            )}
          </div>
        </div>

        {/* Week progress (only if planting started) */}
        {s.plantedOn && week !== null && (
          <div className="mb-6">
            <div className="flex justify-between text-xs text-emerald-200 mb-2">
              <span className="font-bold">Minggu {week} dari {totalWks}</span>
              <span>{Math.round((week / totalWks) * 100)}% durasi</span>
            </div>
            <div className="h-2 bg-white/20 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-white transition-all"
                style={{ width: `${Math.round((week / totalWks) * 100)}%` }}
              />
            </div>
          </div>
        )}

        {/* KPI row inside hero */}
        {plan ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <div className="bg-white/15 backdrop-blur-sm rounded-xl p-3">
              <p className="text-emerald-200 text-xs">Estimasi kebutuhan</p>
              <p className="text-white text-lg font-black mt-1 tabular-nums">{rupiah(plan.p50Jt)}</p>
              <p className="text-emerald-300 text-[11px]">{rupiah(plan.p10Jt)}–{rupiah(plan.p90Jt)}</p>
            </div>
            <div className="bg-white/15 backdrop-blur-sm rounded-xl p-3">
              <p className="text-emerald-200 text-xs">Tercatat aktual</p>
              <p className="text-white text-lg font-black mt-1 tabular-nums">{rupiah(totalActual)}</p>
              <p className="text-emerald-300 text-[11px]">{progress}% dari rencana</p>
            </div>
            <div className={`rounded-xl p-3 col-span-2 sm:col-span-1 ${isShort ? 'bg-red-500/30' : 'bg-white/15 backdrop-blur-sm'}`}>
              <p className="text-emerald-200 text-xs">{isShort ? 'Kekurangan modal' : 'Sisa modal'}</p>
              <p className={`text-lg font-black mt-1 tabular-nums ${isShort ? 'text-red-200' : 'text-white'}`}>
                {remaining !== null ? rupiah(Math.abs(remaining)) : '—'}
              </p>
              <p className="text-emerald-300 text-[11px]">
                {remaining === null ? 'Modal belum diisi' : isShort ? 'Pertimbangkan pengajuan kredit' : 'Estimasi masih mencukupi'}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-white/10 rounded-xl p-4 flex items-center justify-between gap-4">
            <div>
              <p className="text-white font-bold">Pembiayaan belum dimulai</p>
              <p className="text-emerald-200 text-sm mt-0.5">Mulai perhitungan untuk melihat estimasi biaya musim ini.</p>
            </div>
            <Link href="/musim-tanam" className="shrink-0 bg-white text-emerald-800 font-black text-xs rounded-xl px-4 py-2 hover:bg-emerald-50 transition-colors">
              Mulai
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

/** Alert card — biaya melenceng, modal kurang, dsb */
function AlertsSection({ w }: { w: W }) {
  const s = w.season;
  const plan = s?.status !== 'DRAFT' ? s?.costPlan : null;
  const expenses = w.expenses.data ?? [];
  const totalActual = expenses.filter(e => !e.simulated).reduce((sum, e) => sum + amount(e.amountJt), 0);
  const capital = amount(plan?.capitalJt ?? s?.capitalJt);
  const alerts: { icon: React.ReactNode; title: string; detail: string; color: string; href?: string }[] = [];

  if (plan && capital > 0 && totalActual > capital) {
    alerts.push({
      icon: <AlertTriangle size={16} />,
      title: 'Modal diperkirakan tidak mencukupi',
      detail: `Pengeluaran sudah melebihi modal awal ${rupiah(capital)}.`,
      color: 'red',
      href: '/risiko-kredit',
    });
  }
  if (plan && amount(plan.shortfallJt) > 0) {
    alerts.push({
      icon: <Wallet size={16} />,
      title: `Kekurangan modal awal ${rupiah(plan.shortfallJt)}`,
      detail: 'Pertimbangkan pengajuan pinjaman atau penyesuaian rencana.',
      color: 'amber',
      href: '/risiko-kredit',
    });
  }
  if (plan && amount(plan.p50Jt) > 0 && totalActual > amount(plan.p50Jt) * 1.15) {
    alerts.push({
      icon: <TrendingUp size={16} />,
      title: 'Biaya aktual 15% di atas rencana',
      detail: 'Periksa catatan pengeluaran dan sesuaikan rencana bila perlu.',
      color: 'amber',
      href: '/catatan',
    });
  }
  if (s && !s.plantedOn && s.status === 'PEMBIAYAAN') {
    alerts.push({
      icon: <Sprout size={16} />,
      title: 'Tanggal penanaman belum diisi',
      detail: 'Isi tanggal mulai tanam agar minggu berjalan dapat dihitung.',
      color: 'amber',
      href: '/musim-tanam',
    });
  }

  if (alerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {alerts.map((a, i) => (
        <div key={i} className={`console-message ${a.color === 'red' ? 'console-message-red' : 'console-message-amber'}`}>
          <span className="shrink-0 mt-0.5">{a.icon}</span>
          <div className="min-w-0 flex-1">
            <p className="font-extrabold text-sm">{a.title}</p>
            <p className="text-xs mt-0.5 opacity-80">{a.detail}</p>
          </div>
          {a.href && (
            <Link href={a.href} className="shrink-0 font-bold text-xs underline underline-offset-2 opacity-80 hover:opacity-100">
              Lihat
            </Link>
          )}
        </div>
      ))}
    </div>
  );
}

/** Quick action grid */
function QuickActions() {
  const actions = [
    { href: '/catatan',       icon: ClipboardList, label: 'Catat pengeluaran', sub: 'Simpan transaksi aktual' },
    { href: '/kalender-uang', icon: CalendarDays,  label: 'Kalender uang',     sub: 'Biaya per minggu' },
    { href: '/musim-tanam',   icon: Sprout,        label: 'Kelola musim',      sub: 'Pembiayaan & panen' },
    { href: '/cuaca-lahan',   icon: CloudSun,      label: 'Cek lahan',         sub: 'Cuaca & kondisi tanah' },
    { href: '/riwayat-musim', icon: History,       label: 'Riwayat musim',     sub: 'Catatan musim lalu' },
    { href: '/pengingat',     icon: Bell,          label: 'Pengingat',         sub: 'Checklist mingguan' },
  ];
  return (
    <Card title="Aksi cepat" subtitle="Satu klik menuju aktivitas yang paling sering digunakan.">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {actions.map(a => {
          const Icon = a.icon;
          return (
            <Link key={a.href} href={a.href} className="console-action group">
              <span className="console-action-icon group-hover:bg-emerald-100 transition-colors">
                <Icon size={18} />
              </span>
              <div className="min-w-0">
                <p className="font-extrabold text-xs text-slate-800 truncate">{a.label}</p>
                <p className="text-slate-400 text-[11px] truncate mt-0.5">{a.sub}</p>
              </div>
            </Link>
          );
        })}
      </div>
    </Card>
  );
}

/** Mini checklist card — 4 item checklist dari panduan */
function WeekChecklistCard({ w }: { w: W }) {
  const s = w.season;
  // [REVISI] hook dipanggil tanpa syarat; kondisi dijaga lewat `enabled`, return dini setelahnya.
  const week = s?.plantedOn ? currentWeek(s.plantedOn, CROP_WEEKS[s.crop]) : 0;
  const checklist = useQuery({
    queryKey: ['console', 'checklist', s?.id, week],
    queryFn: () => api.checklist.get(s!.id, week),
    enabled: !!s?.id && !!s?.plantedOn,
  });
  if (!s?.plantedOn) return null;

  const LABEL: Record<string, string> = {
    cek_hama: 'Periksa tanda hama & penyakit',
    cek_air: 'Periksa kebutuhan air & irigasi',
    cek_nutrisi: 'Periksa kondisi nutrisi/pupuk',
    catat_biaya: 'Catat pengeluaran minggu ini',
  };

  const items = checklist.data?.items ?? [];
  const done = items.filter(i => i.done).length;
  const total = items.length;

  return (
    <Card
      title={`Checklist minggu ${week}`}
      subtitle={`Fase ${s.crop} · ${done}/${total} selesai`}
      action={<Link href="/pengingat" className="text-emerald-700 font-extrabold text-xs flex items-center gap-1">Lihat semua <ArrowUpRight size={13}/></Link>}
    >
      {checklist.isLoading ? (
        <p className="text-sm text-slate-400">Memuat checklist...</p>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400">Checklist belum tersedia untuk minggu ini.</p>
      ) : (
        <div className="space-y-2">
          {items.map(item => (
            <div key={item.key} className={`flex items-center gap-3 p-3 rounded-xl text-sm transition-colors ${item.done ? 'bg-emerald-50' : 'bg-slate-50'}`}>
              <CheckCircle2
                size={18}
                className={item.done ? 'text-emerald-600 shrink-0' : 'text-slate-300 shrink-0'}
                fill={item.done ? 'currentColor' : 'none'}
              />
              <span className={item.done ? 'line-through text-slate-400' : 'text-slate-700 font-semibold'}>
                {LABEL[item.key] ?? item.key}
              </span>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}

/** Farm info ringkas */
function FarmInfoCard({ w }: { w: W }) {
  const farm = w.farm;
  const rows = [
    { label: 'Komoditas',    value: w.season ? CROP_NAME[w.season.crop] : 'Belum dipilih' },
    { label: 'Luas lahan',   value: farm ? `${farm.areaHa} ha` : '—' },
    { label: 'Jenis tanah',  value: farm?.soilType ?? 'Belum diisi' },
    { label: 'Sumber air',   value: farm?.waterSource ?? 'Belum diisi' },
    { label: 'pH tanah',     value: farm?.ph ?? 'Belum diukur' },
  ];
  return (
    <Card
      title="Profil lahan"
      subtitle={farm?.name ?? 'Lahan belum terdaftar'}
      action={<Tag color={farm ? 'green' : 'amber'}>{farm ? 'Terdaftar' : 'Belum lengkap'}</Tag>}
    >
      <div className="flex justify-between items-center border-b border-slate-100 pb-4 mb-4">
        <div>
          <p className="text-xs text-slate-500">Nama lahan</p>
          <p data-no-translate className="font-black text-slate-900 mt-0.5">{farm?.name ?? 'Belum ada lahan'}</p>
        </div>
        <span className="bg-emerald-50 text-emerald-700 p-3 rounded-xl">
          <MapPinned size={20} />
        </span>
      </div>
      <dl className="space-y-2.5 text-sm">
        {rows.map(r => (
          <div key={r.label} className="flex justify-between gap-3">
            <dt className="text-slate-500">{r.label}</dt>
            <dd className="text-slate-900 font-extrabold text-right truncate max-w-[55%]">{r.value}</dd>
          </div>
        ))}
      </dl>
      <Link className="text-emerald-700 inline-flex font-extrabold text-xs gap-1 items-center mt-5" href="/profil">
        Perbarui profil <ArrowUpRight size={13} />
      </Link>
    </Card>
  );
}

/** Cuaca mini */
function WeatherCard({ w }: { w: W }) {
  const farm = w.farm;
  const weather = useQuery({
    queryKey: ['console', 'weather', farm?.latitude, farm?.longitude],
    queryFn: () => api.weather.current(Number(farm?.latitude), Number(farm?.longitude)),
    enabled: !!farm?.latitude && !!farm?.longitude,
    staleTime: 10 * 60_000,
    retry: false,
  });

  return (
    <Card title="Cuaca terkini" subtitle="Open-Meteo · Lokasi lahan">
      {weather.data ? (
        <div className="grid grid-cols-3 gap-2">
          {[
            { icon: <CloudSun size={18}/>, val: `${weather.data.tempC ?? '—'}°C`, label: 'Suhu' },
            { icon: <Droplets size={18}/>, val: `${weather.data.rainMm ?? '—'} mm`, label: 'Hujan' },
            { icon: <Wind size={18}/>,    val: `${weather.data.windKmh ?? '—'} km/j`, label: 'Angin' },
          ].map(w => (
            <div key={w.label} className="console-weather">
              {w.icon}
              <strong>{w.val}</strong>
              <span>{w.label}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-sm text-slate-500 flex gap-2 items-start">
          <Info size={17} className="shrink-0 mt-0.5" />
          {!farm?.latitude
            ? 'Isi koordinat lahan pada Profil agar cuaca aktual dapat diambil.'
            : weather.isLoading
              ? 'Memuat cuaca...'
              : 'Cuaca belum tersedia. Periksa koneksi server.'}
        </div>
      )}
      <ErrorLine error={weather.error} />
    </Card>
  );
}

/** Beranda before Mulai (DRAFT season) */
function BeforeFinancing({ w }: { w: W }) {
  return (
    <div className="space-y-6 animate-fade-in">
      <Heading
        kicker="Beranda · AgroChie"
        title={`Halo, ${w.account.data?.name?.split(' ')[0] ?? 'Petani'} 👋`}
        description="Selesaikan profil lahan dan mulai perhitungan pembiayaan untuk mengaktifkan seluruh fitur."
      />
      {/* CTA card Mulai pembiayaan */}
      <div className="bg-gradient-to-r from-emerald-700 to-emerald-600 rounded-2xl p-6 sm:p-8 flex flex-col sm:flex-row gap-5 items-start sm:items-center justify-between">
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Zap size={16} className="text-emerald-200" />
            <span className="text-emerald-200 text-xs font-bold uppercase tracking-wide">Langkah berikutnya</span>
          </div>
          <h3 className="text-white text-xl font-black">Mulai perhitungan pembiayaan</h3>
          <p className="text-emerald-200 text-sm mt-1">
            Aktifkan estimasi biaya, kalender uang, dan fitur keuangan untuk musim tanam ini.
            Tidak ada angka fiktif — semua berdasarkan data lahan Anda.
          </p>
        </div>
        <Link
          href="/musim-tanam"
          className="shrink-0 bg-white text-emerald-800 font-black rounded-xl px-6 py-3 text-sm hover:bg-emerald-50 transition-colors flex items-center gap-2"
        >
          Mulai sekarang <ArrowUpRight size={16} />
        </Link>
      </div>

      <div className="grid lg:grid-cols-2 gap-5">
        <FarmInfoCard w={w} />
        <WeatherCard w={w} />
      </div>

      <QuickActions />
      {w.error && <ErrorLine error={w.error} />}
    </div>
  );
}

/** Empty state — belum ada musim sama sekali */
function NoSeasonState({ w }: { w: W }) {
  return (
    <div className="space-y-6 animate-fade-in">
      <Heading
        kicker="Beranda · AgroChie"
        title={`Halo, ${w.account.data?.name?.split(' ')[0] ?? 'Petani'} 👋`}
        description="Selamat datang di AgroChie. Mulai dengan membuat lahan dan musim tanam pertama."
      />
      <Empty
        icon={Leaf}
        title="Belum ada musim aktif"
        detail="Buat musim baru untuk mulai merencanakan biaya, memantau lahan, dan mencatat pengeluaran."
        link="/musim-tanam"
        linkText="Mulai musim baru"
      />
      <div className="grid lg:grid-cols-2 gap-5">
        <FarmInfoCard w={w} />
        <WeatherCard w={w} />
      </div>
    </div>
  );
}

/* ─── Main Dashboard ──────────────────────────────────────────────────── */
export function Dashboard({ workspace: w }: { workspace: ReturnType<typeof useWorkspace> }) {
  if (w.loading) return <Busy />;

  // Tidak ada lahan/musim sama sekali
  if (!w.farm || !w.season) return <NoSeasonState w={w} />;

  // Musim ada tapi belum mulai pembiayaan
  if (w.season.status === 'DRAFT') return <BeforeFinancing w={w} />;

  // Musim aktif — tampilan penuh
  return (
    <div className="space-y-6 animate-fade-in">
      <Heading
        kicker="Beranda · AgroChie"
        title={`Halo, ${w.account.data?.name?.split(' ')[0] ?? 'Petani'} 👋`}
        description="Ringkasan musim tanam aktif dan tindakan yang perlu dilakukan."
        action={
          <Link href="/musim-tanam" className="console-button console-button-primary">
            Kelola musim <ArrowUpRight size={16} />
          </Link>
        }
      />

      {/* Hero section */}
      <SeasonHero w={w} />

      {/* Alerts */}
      <AlertsSection w={w} />

      {/* Main grid */}
      <div className="grid lg:grid-cols-[1fr_380px] gap-5 items-start">
        {/* Left */}
        <div className="space-y-5">
          <QuickActions />
          <WeekChecklistCard w={w} />
        </div>
        {/* Right */}
        <div className="space-y-5">
          <FarmInfoCard w={w} />
          <WeatherCard w={w} />
        </div>
      </div>

      {w.error && <ErrorLine error={w.error} />}
    </div>
  );
}
