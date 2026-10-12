'use client';

import { useState } from 'react';
import { useActiveSeason } from '@/hooks/useActiveSeason';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { AppButton } from '@/components/ui/AppButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { getPhaseForWeek, getCurrentWeek, PHASE_LABELS, CROP_DURATION } from '@/domain/calculations/seasons';
import { CROP_LABELS } from '@/lib/formatters';
import { Bell, BellOff, Check, Circle } from 'lucide-react';

const DEFAULT_TASKS = [
  { id: 't1', label: 'Cek kondisi tanaman (daun, batang, akar)', isDone: false },
  { id: 't2', label: 'Periksa tanda serangan hama atau penyakit', isDone: false },
  { id: 't3', label: 'Cek ketersediaan air dan saluran irigasi', isDone: false },
  { id: 't4', label: 'Catat pengeluaran minggu ini', isDone: false },
  { id: 't5', label: 'Foto dokumentasi perkembangan lahan', isDone: false },
  { id: 't6', label: 'Periksa cuaca prakiraan minggu depan', isDone: false },
];

export function PengingatView() {
  const { season } = useActiveSeason();
  const [tasks, setTasks] = useState(DEFAULT_TASKS);
  const [notifStatus, setNotifStatus] = useState<'unknown' | 'granted' | 'denied'>('unknown');

  const currentWeek = season?.plantingStartedAt
    ? getCurrentWeek(season.plantingStartedAt, season.crop)
    : null;
  const currentPhase = currentWeek && season
    ? getPhaseForWeek(season.crop, currentWeek)
    : null;
  const duration = season ? CROP_DURATION[season.crop] : 16;
  const doneTasks = tasks.filter((t) => t.isDone).length;
  const progress = (doneTasks / tasks.length) * 100;

  function toggleTask(id: string) {
    setTasks((prev) => prev.map((t) => t.id === id ? { ...t, isDone: !t.isDone } : t));
  }

  async function requestNotifPermission() {
    if (!('Notification' in window)) {
      alert('Browser ini tidak mendukung notifikasi.');
      return;
    }
    const result = await Notification.requestPermission();
    setNotifStatus(result === 'granted' ? 'granted' : 'denied');
  }

  return (
    <div className="animate-fade-in space-y-6">
      <PageHeader
        title="Pengingat cek lahan"
        subtitle="Daftar kegiatan mingguan agar lahan selalu terpantau."
      />

      {/* Status musim */}
      {season && currentWeek ? (
        <div className="bg-[--primary-soft] rounded-2xl border border-[--primary]/20 p-4 flex items-center justify-between gap-4">
          <div>
            <p className="font-bold text-[--primary-ink]">
              {CROP_LABELS[season.crop]} · Minggu {currentWeek} dari {duration}
            </p>
            {currentPhase && (
              <p className="text-sm text-[--text-muted]">Fase: {PHASE_LABELS[currentPhase]}</p>
            )}
          </div>
          <StatusBadge label={`${doneTasks}/${tasks.length} selesai`} variant="success" size="sm" />
        </div>
      ) : (
        <div className="bg-[--surface-muted] rounded-2xl border border-[--border] p-4 text-center">
          <p className="text-sm text-[--text-muted]">
            Belum ada musim aktif. Checklist persiapan tetap bisa digunakan.
          </p>
        </div>
      )}

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-sm mb-2">
          <span className="font-bold text-[--text]">Progres minggu ini</span>
          <span className="font-bold text-[--primary]">{doneTasks}/{tasks.length}</span>
        </div>
        <div className="h-3 bg-[--border] rounded-full overflow-hidden">
          <div
            className="h-full bg-[--primary] rounded-full transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        {doneTasks === tasks.length && (
          <p className="text-sm text-[--success] font-bold mt-2 flex items-center gap-1">
            <Check size={16} /> Semua tugas selesai minggu ini! 🎉
          </p>
        )}
      </div>

      {/* Checklist */}
      <SectionCard title={`Checklist cek lahan${currentWeek ? ` — Minggu ${currentWeek}` : ''}`}>
        <ul className="space-y-2" role="list">
          {tasks.map((task) => (
            <li key={task.id}>
              <button
                onClick={() => toggleTask(task.id)}
                className={`w-full flex items-center gap-3 p-3.5 rounded-xl border transition-all text-left ${
                  task.isDone
                    ? 'bg-[--primary-soft] border-[--primary]/20'
                    : 'bg-[--surface] border-[--border] hover:border-[--primary]/30 hover:bg-[--surface-muted]'
                }`}
                aria-pressed={task.isDone}
              >
                <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-all ${
                  task.isDone ? 'bg-[--primary] border-[--primary]' : 'border-[--border]'
                }`}>
                  {task.isDone && <Check size={13} className="text-white" strokeWidth={3} />}
                </div>
                <span className={`text-sm font-semibold leading-tight ${
                  task.isDone ? 'text-[--text-muted] line-through' : 'text-[--text]'
                }`}>
                  {task.label}
                </span>
              </button>
            </li>
          ))}
        </ul>
        <p className="text-xs text-[--text-muted] mt-3">
          Progres disimpan sementara. Checklist baru setiap awal minggu.
        </p>
      </SectionCard>

      {/* Notifikasi browser */}
      <SectionCard title="Pengingat otomatis">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-sm text-[--text]">Aktifkan notifikasi browser</p>
            <p className="text-xs text-[--text-muted] mt-0.5">
              Status:{' '}
              {notifStatus === 'granted' ? (
                <span className="text-[--success] font-semibold">Diizinkan</span>
              ) : notifStatus === 'denied' ? (
                <span className="text-[--danger] font-semibold">Ditolak</span>
              ) : (
                <span className="text-[--text-muted]">Belum diminta</span>
              )}
            </p>
          </div>
          {notifStatus !== 'granted' && (
            <AppButton
              size="sm"
              variant="outline"
              leftIcon={notifStatus === 'denied' ? <BellOff size={15} /> : <Bell size={15} />}
              onClick={requestNotifPermission}
              disabled={notifStatus === 'denied'}
            >
              {notifStatus === 'denied' ? 'Ditolak' : 'Izinkan notifikasi'}
            </AppButton>
          )}
        </div>
        <p className="text-xs text-[--text-muted] mt-3">
          Notifikasi hanya muncul setelah Anda mengizinkan. Anda dapat mencabut izin kapan saja dari pengaturan browser.
        </p>
      </SectionCard>
    </div>
  );
}
