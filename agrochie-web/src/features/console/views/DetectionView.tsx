'use client';
import { useEffect, useRef, useState, type DragEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Camera, ImagePlus, LoaderCircle, ScanSearch, Upload } from 'lucide-react';
import { api, idr, shortDate, type Detection } from '../api';
import type { Workspace } from '../hooks';
import { Button, Card, Empty, ErrorLine, Heading, Message, Tag } from '../ui';
import { DISCLAIMER, QUALITY, ResultCard } from './DetectionResult';

// [REVISI] Deteksi kualitas tanaman. Batas ukuran hanya pemeriksaan awal di klien (bukan rahasia);
// backend tetap memeriksa tipe dari isi berkas dan ukuran. Kunci API hanya ada di backend.
const MAX_MB = (() => { const n = Number(process.env.NEXT_PUBLIC_DETECTION_MAX_MB ?? 5); return Number.isFinite(n) && n > 0 ? n : 5; })();
const ALLOWED = ['image/jpeg', 'image/png', 'image/webp'];
const ASSISTANT_CONTEXT_KEY = 'agrochie:assistant-context';

function validateFile(file: File): string | null {
  if (!ALLOWED.includes(file.type)) return 'Format foto tidak didukung. Gunakan JPG, PNG, atau WebP.';
  if (file.size === 0) return 'File foto kosong. Pilih foto lain.';
  if (file.size > MAX_MB * 1024 * 1024) return `Foto terlalu besar (maksimal ${MAX_MB} MB). Pilih foto yang lebih kecil.`;
  return null;
}

/** Ringkasan hasil untuk Asisten; dibatasi agar muat di batas pesan Asisten (1000 karakter). */
function assistantContext(d: Detection, farmName: string): string {
  const h = d.hasil;
  const masalah = (h?.masalah_terdeteksi ?? []).slice(0, 3).map(m => `${m.nama} (${m.tingkat_keparahan})`).join(', ') || 'tidak ada masalah spesifik';
  const text = `Hasil deteksi tanaman di lahan ${farmName}: kondisi "${h?.kondisi ?? '-'}", kualitas ${h?.kategori_kualitas ?? '-'}, masalah: ${masalah}. Saya ingin bertanya lebih lanjut: `;
  return text.length > 900 ? `${text.slice(0, 897)}...` : text;
}

function History({ w, shownId, onPick }: { w: Workspace; shownId: string | null; onPick: (id: string) => void }) {
  const farm = w.farm!;
  const history = useQuery({ queryKey: ['console', 'detections', farm.id], queryFn: () => api.detection.list(farm.id, 1, 10) });
  return <Card title="Riwayat deteksi" subtitle={`Lahan ${farm.name}`}>
    {history.isLoading ? <p className="text-sm text-slate-500">Memuat riwayat...</p>
      : history.error ? <ErrorLine error={history.error}/>
      : !history.data?.data.length ? <Empty icon={ScanSearch} title="Belum ada deteksi" detail="Hasil analisis foto akan muncul di sini."/>
      : <ul className="space-y-2">{history.data.data.map(item => {
        const q = item.hasil ? QUALITY[item.hasil.kategori_kualitas] : null;
        return <li key={item.id}><button type="button" onClick={() => onPick(item.id)} className={`w-full flex items-center gap-3 rounded-xl border p-2 text-left hover:bg-emerald-50 ${shownId === item.id ? 'border-emerald-500 bg-emerald-50' : 'border-slate-100 bg-slate-50'}`}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={api.detection.photoUrl(item.id)} alt="Foto deteksi" loading="lazy" className="h-14 w-14 rounded-lg object-cover bg-slate-200 shrink-0"/>
          <span className="flex-1 min-w-0"><span className="block text-xs text-slate-500">{shortDate(item.dibuat_pada)}</span><span className="block text-sm font-bold text-slate-800 truncate">{item.hasil?.kondisi ?? 'Foto kurang jelas'}</span></span>
          {q ? <Tag color={q.color}>{q.label}</Tag> : <Tag color="gray">Tidak yakin</Tag>}
        </button></li>;
      })}</ul>}
  </Card>;
}

export function DetectionView({ w }: { w: Workspace }) {
  const farm = w.farm;
  const qc = useQueryClient();
  const router = useRouter();
  const fileInput = useRef<HTMLInputElement>(null);
  const cameraInput = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [note, setNote] = useState('');
  const [fileError, setFileError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [shownId, setShownId] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);

  const pick = (f: File | undefined) => {
    if (!f) return;
    const problem = validateFile(f);
    setFileError(problem);
    if (problem) return;
    setFile(f);
    setPreview(URL.createObjectURL(f));
  };
  const clearFile = () => { setFile(null); setPreview(null); setFileError(null); if (fileInput.current) fileInput.current.value = ''; if (cameraInput.current) cameraInput.current.value = ''; };
  const onDrop = (e: DragEvent) => { e.preventDefault(); setDragging(false); pick(e.dataTransfer.files?.[0]); };

  const detail = useQuery({ queryKey: ['console', 'detection', shownId], queryFn: () => api.detection.get(shownId!), enabled: !!shownId });
  const analyze = useMutation({
    mutationFn: () => api.detection.analyze(farm!.id, file!, note),
    onSuccess: (res) => {
      qc.setQueryData(['console', 'detection', res.id], res);
      void qc.invalidateQueries({ queryKey: ['console', 'detections'] });
      setShownId(res.id); setSaved(null); clearFile(); setNote('');
    },
  });
  const toNote = useMutation({
    mutationFn: (id: string) => api.detection.toNote(id),
    onSuccess: (res) => {
      setSaved(`Tersimpan ke Catatan biaya: ${idr(Number(res.jumlah_jt) * 1_000_000)} (kategori ${res.kategori}).`);
      void qc.invalidateQueries({ queryKey: ['console'] });
    },
  });

  if (!farm) return <div className="space-y-5"><Heading title="Deteksi kualitas tanaman" description="Unggah foto tanaman untuk dianalisis."/><Card><Empty icon={ScanSearch} title="Belum ada lahan" detail="Tambahkan lahan di Profil terlebih dahulu agar hasil deteksi tersimpan per lahan." link="/profil" linkText="Buka profil"/></Card></div>;

  const result = detail.data;
  const askAssistant = (d: Detection) => { window.sessionStorage.setItem(ASSISTANT_CONTEXT_KEY, assistantContext(d, farm.name)); router.push('/asisten'); };

  return <div className="space-y-5">
    <Heading title="Deteksi kualitas tanaman" description="Unggah foto daun atau tanaman untuk mengetahui kondisi, penyebab, dan langkah penanganannya." action={<Tag>Lahan: {farm.name}</Tag>}/>
    <Message color="amber">{DISCLAIMER}</Message>
    <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(280px,.8fr)] gap-5">  {/* [REVISI] grid-cols-1 = minmax(0,1fr) agar kolom tidak melebar mengikuti konten */}
      <Card className="min-w-0 max-w-full" title="Unggah foto" subtitle={`Lahan yang dianalisis: ${farm.name}. Format JPG, PNG, atau WebP, maksimal ${MAX_MB} MB.`}>
        <div onDragOver={(e) => { e.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={onDrop}
          className={`w-full max-w-full min-w-0 box-border rounded-2xl border-2 border-dashed p-4 sm:p-5 text-center transition ${dragging ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
          {preview
            // eslint-disable-next-line @next/next/no-img-element
            ? <img src={preview} alt="Pratinjau foto tanaman" className="mx-auto h-auto max-h-72 max-w-full rounded-xl object-contain"/>
            : <div className="py-6"><ImagePlus className="mx-auto text-emerald-700" size={34}/><p className="mt-3 text-sm font-bold text-slate-700">Tarik dan lepas foto di sini</p><p className="text-xs text-slate-500 mt-1">atau pilih dari perangkat Anda</p></div>}
          <div className="mt-4 flex flex-wrap justify-center gap-2">
            <Button variant="secondary" icon={Upload} onClick={() => fileInput.current?.click()}>Pilih foto</Button>
            <span className="sm:hidden"><Button variant="secondary" icon={Camera} onClick={() => cameraInput.current?.click()}>Kamera</Button></span>
            {file && <Button variant="ghost" onClick={clearFile}>Hapus foto</Button>}
          </div>
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(e) => pick(e.target.files?.[0])}/>
          <input ref={cameraInput} type="file" accept="image/*" capture="environment" className="hidden" onChange={(e) => pick(e.target.files?.[0])}/>
        </div>
        {fileError && <div className="mt-3"><Message color="red">{fileError}</Message></div>}
        <label className="block mt-4"><span className="block text-xs font-bold text-slate-700 mb-2">Catatan (opsional)</span>
          <textarea className="console-input w-full max-w-full box-border" rows={2} maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Contoh: daun menguning sejak 3 hari lalu, habis hujan deras"/>
          <span className="block mt-1.5 text-xs text-slate-500">{note.length}/500 karakter</span></label>
        <div className="mt-4 [&>button]:w-full sm:[&>button]:w-auto"><Button icon={ScanSearch} busy={analyze.isPending} disabled={!file} onClick={() => analyze.mutate()}>Analisis</Button></div>
        {analyze.isPending && <div className="mt-4 flex items-center gap-3 text-sm text-slate-600" role="status"><LoaderCircle className="animate-spin text-emerald-700" size={18}/> Menganalisis foto... Proses ini bisa memakan waktu sekitar setengah menit.</div>}
        <div className="mt-4"><ErrorLine error={analyze.error}/></div>
      </Card>
      <History w={w} shownId={shownId} onPick={(id) => { setShownId(id); setSaved(null); }}/>
    </div>
    {shownId && detail.isLoading && <Card><div className="space-y-3 animate-pulse" role="status"><div className="h-6 w-1/3 rounded bg-slate-200"/><div className="h-4 w-full rounded bg-slate-100"/><div className="h-4 w-2/3 rounded bg-slate-100"/></div></Card>}
    {shownId && detail.error && <ErrorLine error={detail.error}/>}
    {result && <ResultCard d={result} farmName={farm.name} saved={saved} noteBusy={toNote.isPending} noteError={toNote.error} onNote={() => toNote.mutate(result.id)} onAsk={() => askAssistant(result)}/>}
  </div>;
}

