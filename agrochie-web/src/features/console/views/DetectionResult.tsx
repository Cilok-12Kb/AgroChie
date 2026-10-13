'use client';
import { CheckCircle2, MessageCircle, Wallet } from 'lucide-react';
import { idr, shortDate, type Detection, type DetectionPriority, type DetectionQuality, type DetectionSeverity } from '../api';
import { Button, Card, ErrorLine, Message, Tag } from '../ui';

// [REVISI] Kartu hasil deteksi tanaman (dipisah dari DetectionView agar berkas tetap ringkas).
export const DISCLAIMER = 'Hasil bersifat perkiraan. Konsultasikan dengan penyuluh pertanian untuk kasus berat.';
type Color = 'green' | 'amber' | 'red';
export const QUALITY: Record<DetectionQuality, { label: string; color: Color }> = {
  baik: { label: 'Kualitas baik', color: 'green' }, sedang: { label: 'Kualitas sedang', color: 'amber' }, buruk: { label: 'Kualitas buruk', color: 'red' },
};
const SEVERITY: Record<DetectionSeverity, { label: string; color: Color }> = {
  ringan: { label: 'Ringan', color: 'green' }, sedang: { label: 'Sedang', color: 'amber' }, berat: { label: 'Berat', color: 'red' },
};
const PRIORITY: Record<DetectionPriority, { label: string; color: Color }> = {
  segera: { label: 'Segera', color: 'red' }, minggu_ini: { label: 'Minggu ini', color: 'amber' }, pencegahan: { label: 'Pencegahan', color: 'green' },
};
const rangeRp = (min: number, max: number) => min === max ? idr(min) : `${idr(min)} – ${idr(max)}`;
const H3 = ({ children }: { children: string }) => <h3 className="font-extrabold text-sm mb-2">{children}</h3>;
const Bullets = ({ items }: { items: string[] }) => <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">{items.map((c, i) => <li key={i}>{c}</li>)}</ul>;

// [REVISI] label sumber deteksi (field opsional dari backend)
const sourceLabel = (s: NonNullable<Detection["sumber_deteksi"]>) => s.provider === "engine" ? `Dianalisis oleh model AgroChie${s.model_versi ? ` v${s.model_versi.split("@").pop()}` : ""}` : `Dianalisis oleh ${s.provider}`;
interface Props { d: Detection; farmName: string; saved: string | null; noteBusy: boolean; noteError: unknown; onNote: () => void; onAsk: () => void }

export function ResultCard({ d, farmName, saved, noteBusy, noteError, onNote, onAsk }: Props) {
  const sub = `Lahan ${farmName} · ${shortDate(d.dibuat_pada)}`;
  if (d.status === 'TIDAK_YAKIN' || !d.hasil) {
    return <Card title="Hasil analisis" subtitle={sub}>
      <Message color="amber"><b>Hasil belum yakin.</b> {d.pesan ?? 'Foto kurang jelas.'} Unggah foto yang lebih jelas: dekat dengan daun atau buah, cahaya cukup, tidak buram, dan tanaman memenuhi bingkai.</Message>
      <p className="text-xs text-slate-500 mt-3">{DISCLAIMER}</p>
    </Card>;
  }
  const h = d.hasil; const s = d.solusi; const q = QUALITY[h.kategori_kualitas]; const note = d.ke_catatan;
  return <Card title="Hasil analisis" subtitle={sub} action={<div className="flex items-center gap-2"><Tag color={q.color}>{q.label}</Tag><Tag color="gray">Keyakinan {Math.round(h.skor_kepercayaan * 100)}%</Tag></div>}>
    <div className="space-y-6">
      <div><p className="text-sm text-slate-900 font-bold">{h.kondisi}</p>{s && <p className="text-sm text-slate-600 mt-1">{s.ringkasan}</p>}</div>
      <section><H3>Masalah terdeteksi</H3>
        {h.masalah_terdeteksi.length === 0 ? <p className="text-sm text-slate-500">Tidak ada masalah spesifik yang terlihat.</p>
          : <ul className="space-y-2">{h.masalah_terdeteksi.map((m, i) => <li key={i} className="rounded-xl border border-slate-100 p-3"><div className="flex flex-wrap items-center gap-2"><span className="font-bold text-sm">{m.nama}</span><Tag color={SEVERITY[m.tingkat_keparahan].color}>{SEVERITY[m.tingkat_keparahan].label}</Tag></div><p className="text-xs text-slate-500 mt-1">{m.gejala_terlihat}</p></li>)}</ul>}
      </section>
      {s && <Solution s={s}/>}
      {d.sumber_deteksi && <p className="text-xs text-slate-500">{sourceLabel(d.sumber_deteksi)}</p>}
      <Message color="amber">{DISCLAIMER}</Message>
      <div className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Button icon={Wallet} busy={noteBusy} disabled={!note.tersedia || !!saved} onClick={onNote}>Tambahkan ke Catatan biaya</Button>
          <Button variant="secondary" icon={MessageCircle} onClick={onAsk}>Tanya lanjutan ke Asisten</Button>
        </div>
        {!note.tersedia && !saved && note.alasan && <p className="text-xs text-slate-600">{note.alasan}</p>}
        {saved && <Message color="green"><span className="inline-flex items-center gap-2"><CheckCircle2 size={15}/>{saved}</span></Message>}
        <ErrorLine error={noteError}/>
      </div>
    </div>
  </Card>;
}

function Solution({ s }: { s: NonNullable<Detection['solusi']> }) {
  return <>
    {s.kemungkinan_penyebab.length > 0 && <section><H3>Kemungkinan penyebab</H3><Bullets items={s.kemungkinan_penyebab}/></section>}
    <section><H3>Langkah penanganan</H3>
      <ol className="space-y-2">{[...s.langkah_penanganan].sort((a, b) => a.urutan - b.urutan).map(l => <li key={l.urutan} className="flex flex-wrap sm:flex-nowrap gap-3 rounded-xl bg-slate-50 p-3"><span className="font-black text-emerald-700">{l.urutan}.</span><span className="flex-1 min-w-0 text-sm text-slate-800">{l.langkah}</span><Tag color={PRIORITY[l.prioritas].color}>{PRIORITY[l.prioritas].label}</Tag></li>)}</ol>
    </section>
    <section><H3>Bahan dan alat</H3>
      {s.bahan_dan_alat.length === 0 ? <p className="text-sm text-slate-500">Tidak ada bahan atau alat khusus.</p> :
        <div className="overflow-x-auto"><table className="w-full text-sm"><thead><tr className="text-left text-xs text-slate-500"><th className="py-2 pr-3">Bahan / alat</th><th className="py-2 pr-3">Dosis / jumlah</th><th className="py-2 text-right">Estimasi biaya</th></tr></thead>
          <tbody>{s.bahan_dan_alat.map((b, i) => <tr key={i} className="border-t border-slate-100"><td className="py-2 pr-3 font-bold">{b.nama}</td><td className="py-2 pr-3 text-slate-600">{b.dosis_atau_jumlah}</td><td className="py-2 text-right tabular-nums whitespace-nowrap">{rangeRp(b.estimasi_biaya_min, b.estimasi_biaya_max)}</td></tr>)}</tbody></table></div>}
    </section>
    <section className="rounded-2xl bg-emerald-50 border border-emerald-100 p-4">
      <p className="text-xs font-bold text-emerald-800">Total estimasi biaya ({s.estimasi_total_biaya.per_hektar_atau_per_lahan})</p>
      <p className="text-[clamp(22px,3vw,30px)] font-black text-emerald-900 tabular-nums">{rangeRp(s.estimasi_total_biaya.min, s.estimasi_total_biaya.max)}</p>
      <p className="text-xs font-bold text-slate-700 mt-3">Asumsi:</p>
      <ul className="list-disc pl-5 text-xs text-slate-600 space-y-0.5">{s.estimasi_total_biaya.asumsi.map((a, i) => <li key={i}>{a}</li>)}</ul>
    </section>
    <section><H3>Risiko jika tidak ditangani</H3><p className="text-sm text-slate-700">{s.risiko_jika_tidak_ditangani}</p></section>
    {s.pencegahan.length > 0 && <section><H3>Pencegahan</H3><Bullets items={s.pencegahan}/></section>}
    <section><H3>Kapan perlu konsultasi ahli</H3><p className="text-sm text-slate-700">{s.kapan_konsultasi_ahli}</p></section>
  </>;
}

