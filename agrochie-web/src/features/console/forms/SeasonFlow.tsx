'use client';
import {useState} from 'react';
import {useMutation,useQuery} from '@tanstack/react-query';
import {ArrowRight,Plus,Wallet,Sprout,Camera} from 'lucide-react';
import Link from 'next/link';
import {api,type Crop,CROP_NAME,CROP_WEEKS,dateOnly,rupiah,shortDate} from '../api';
import type {Workspace} from '../hooks';
import {Button,Card,Empty,ErrorLine,Field,Heading,inputClass,Message,Tag} from '../ui';
import {useTranslation} from '@/i18n'; // [REVISI] catatan regionFallback
export function SeasonFlow({ w }: { w: Workspace }) {
  const {t}=useTranslation();
  const [crop, setCrop] = useState<Crop>('CABAI');
  const [capital, setCapital] = useState('');
  const [month, setMonth] = useState(String(new Date().getMonth() + 1));
  const [rain, setRain] = useState('');
  const [heavy, setHeavy] = useState('');
  const [temp, setTemp] = useState('');
  const [fert, setFert] = useState('100');
  const [wage, setWage] = useState('100');
  const [pest, setPest] = useState('100');
  const [startDate, setStartDate] = useState(dateOnly());
  const [sampleKg, setSampleKg] = useState(''); const [sampleArea, setSampleArea] = useState('');
  const [harvestKg, setHarvestKg] = useState(''); const [price, setPrice] = useState(''); const [buyer, setBuyer] = useState('');
  const [cost, setCost] = useState('');
  const [consentTraining, setConsentTraining] = useState(false);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const photos = useQuery({ queryKey: ['console','photos',w.season?.id], queryFn: () => api.photos.list(w.season!.id), enabled: !!w.season?.id });
  const sampleSaved = useQuery({ queryKey: ['console','sample',w.season?.id], queryFn: () => api.harvests.getSample(w.season!.id), enabled: !!w.season?.id });
  const create = useMutation({ mutationFn: () => api.seasons.create(w.farm!.id, crop), onSuccess: () => w.reload() });
  const finance = useMutation({ mutationFn: () => api.seasons.startFinancing(w.season!.id, { ...(capital ? { capitalJt: capital } : {}), startMonth: Number(month), weather: { rainAvgMm: Number(rain), heavyRainWks: Number(heavy), tempMaxAvg: Number(temp) }, indices: { fertIndex: Number(fert), wageIndex: Number(wage), pestIndex: Number(pest) } }), onSuccess: () => w.reload() });
  const plant = useMutation({ mutationFn: () => api.seasons.startPlanting(w.season!.id, startDate), onSuccess: () => w.reload() });
  const harvest = useMutation({ mutationFn: () => api.harvests.create(w.season!.id, { kg: harvestKg, pricePerKg: price, harvestedOn: dateOnly(), grade: 'A', ...(buyer ? { buyer } : {}) }), onSuccess: () => { setHarvestKg(''); setPrice(''); w.reload(); } });
  const sample = useMutation({ mutationFn: () => api.harvests.sample(w.season!.id, { sampleKg, sampleM2: sampleArea }), onSuccess: () => w.reload() });
  const photo = useMutation({ mutationFn: () => api.photos.upload(w.season!.id, photoFile!), onSuccess: () => { setPhotoFile(null); w.reload(); } });
  const close = useMutation({ mutationFn: () => api.seasons.close(w.season!.id, { totalCostJt: cost, consentTraining }), onSuccess: () => w.reload() });
  if (!w.farm) return <><Heading title="Musim tanam" description="Mulai dari lahan yang sudah terdaftar."/><Card><Empty title="Profil lahan belum tersedia" detail="Buat lahan sebelum memulai musim tanam." link="/profil" linkText="Buka profil"/></Card></>;
  const s = w.season;
  return <div className="space-y-5"><Heading title="Musim tanam" description="Satu musim dikelola melalui tiga tahap yang saling berurutan." action={<Tag>{s ? s.status : 'Belum ada musim'}</Tag>}/>
    <div className="grid md:grid-cols-3 gap-4">{[{ n: '01', name: 'Pembiayaan', active: !!s && s.status !== 'DRAFT' },{ n: '02', name: 'Penanaman', active: !!s && ['TANAM','PANEN'].includes(s.status) },{ n: '03', name: 'Panen', active: s?.status === 'PANEN' }].map(x=><div key={x.n} className={`console-stage ${x.active?'console-stage-active':''}`}><span>{x.n}</span><strong>{x.name}</strong><small>{x.active ? 'Sedang / sudah berjalan':'Menunggu tahap sebelumnya'}</small></div>)}</div>
    <Card title="1. Perhitungan pembiayaan" subtitle="Buat musim dan hitung rencana biaya dari data nyata/proyeksi yang Anda masukkan." action={<Tag color={s && s.status !== 'DRAFT' ? 'green':'amber'}>{s && s.status !== 'DRAFT' ? 'Dimulai':'Belum aktif'}</Tag>}>
      {!s ? <div className="space-y-4"><div className="grid sm:grid-cols-2 gap-4"><Field label="Komoditas musim baru"><select className={inputClass} value={crop} onChange={e=>setCrop(e.target.value as Crop)}>{(Object.keys(CROP_NAME) as Crop[]).map(k=><option value={k} key={k}>{CROP_NAME[k]}</option>)}</select></Field><Field label="Lahan terpilih"><input readOnly className={inputClass} value={`${w.farm.name} · ${w.farm.areaHa} ha`}/></Field></div><Button icon={Plus} busy={create.isPending} onClick={()=>create.mutate()}>Buat musim baru</Button><ErrorLine error={create.error}/></div> : s.status === 'DRAFT' ? <div className="space-y-4">
        <Message>Prediksi dijalankan oleh mesin Python melalui Express. Isi seluruh parameter; angka cuaca ini adalah <strong>perkiraan/asumsi Anda</strong>, bukan data cuaca aktual otomatis.</Message>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          <Field label="Bulan mulai musim"><select className={inputClass} value={month} onChange={e=>setMonth(e.target.value)}>{Array.from({length:12},(_,i)=><option key={i} value={i+1}>{new Date(2026,i,1).toLocaleString('id-ID',{month:'long'})}</option>)}</select></Field>
          <Field label="Modal (juta rupiah)" hint="Opsional. Kosong = modal dari profil."><input className={inputClass} type="number" step="0.01" min="0" value={capital} onChange={e=>setCapital(e.target.value)} placeholder={w.farm.capitalJt ?? 'Boleh kosong'}/></Field>
          <Field label="Rata-rata hujan (mm/minggu)"><input className={inputClass} type="number" step="0.1" min="0" required value={rain} onChange={e=>setRain(e.target.value)}/></Field>
          <Field label="Jumlah minggu hujan lebat"><input className={inputClass} type="number" step="1" min="0" required value={heavy} onChange={e=>setHeavy(e.target.value)}/></Field>
          <Field label="Suhu maksimum rata-rata (°C)"><input className={inputClass} type="number" step="0.1" required value={temp} onChange={e=>setTemp(e.target.value)}/></Field>
          <Field label="Indeks harga pupuk" hint="100 = harga normal"><input className={inputClass} type="number" step="0.1" min="0" value={fert} onChange={e=>setFert(e.target.value)}/></Field>
          <Field label="Indeks upah"><input className={inputClass} type="number" step="0.1" min="0" value={wage} onChange={e=>setWage(e.target.value)}/></Field>
          <Field label="Indeks pestisida"><input className={inputClass} type="number" step="0.1" min="0" value={pest} onChange={e=>setPest(e.target.value)}/></Field>
        </div><Button icon={Wallet} busy={finance.isPending} disabled={!rain || !heavy || !temp} onClick={()=>finance.mutate()}>Hitung & mulai pembiayaan</Button><ErrorLine error={finance.error}/></div>
        : <div className="flex flex-wrap justify-between items-center gap-3"><div><p className="text-sm text-slate-500">Estimasi biaya musim · {CROP_NAME[s.crop]}</p><p className="font-black text-2xl mt-1">{rupiah(s.costPlan?.p50Jt)}</p></div><Link className="console-button console-button-secondary" href="/prediksi">Lihat prediksi <ArrowRight size={16}/></Link></div>}
      {finance.data?.regionFallback && <div className="mt-4"><Message>{t.prediction.regionFallback}</Message></div>}{/* [REVISI] catatan wilayah di luar data latih */}
    </Card>
    <Card title="2. Mulai penanaman" subtitle="Tanggal mulai menjadi minggu pertama, termasuk persiapan lahan." action={<Tag color={s?.plantedOn ? 'green':'gray'}>{s?.plantedOn ? 'Aktif':'Menunggu'}</Tag>}>
      {s?.status === 'PEMBIAYAAN' ? <div className="flex flex-col sm:flex-row sm:items-end gap-3"><Field label="Tanggal mulai tanam"><input type="date" className={inputClass} value={startDate} onChange={e=>setStartDate(e.target.value)} max={dateOnly()}/></Field><Button onClick={()=>plant.mutate()} busy={plant.isPending} icon={Sprout}>Mulai penanaman</Button></div> : s?.plantedOn ? <p className="text-sm text-slate-600">Penanaman mulai <strong>{shortDate(s.plantedOn)}</strong>. Lama musim {CROP_WEEKS[s.crop]} minggu.</p> : <p className="text-sm text-slate-500">Selesaikan pembiayaan agar tahap ini terbuka.</p>}<ErrorLine error={plant.error}/>
    </Card>
    <Card title="3. Panen & penutupan" subtitle="Hasil, sampel panen, dan bukti foto harus lengkap sebelum menutup musim." action={<Tag color={s?.status === 'PANEN'?'green':'gray'}>{s?.status === 'PANEN'?'Mencatat panen':'Menunggu'}</Tag>}>
      {s && ['TANAM','PANEN'].includes(s.status) ? <div className="space-y-5">
        <div className="grid sm:grid-cols-3 gap-4"><Field label="Berat panen (kg)"><input className={inputClass} type="number" min="0.01" step="0.01" value={harvestKg} onChange={e=>setHarvestKg(e.target.value)}/></Field><Field label="Harga per kg (Rp)"><input className={inputClass} type="number" min="1" step="0.01" value={price} onChange={e=>setPrice(e.target.value)}/></Field><Field label="Pembeli"><input className={inputClass} value={buyer} onChange={e=>setBuyer(e.target.value)} placeholder="Opsional"/></Field></div>
        <Button icon={Plus} disabled={!harvestKg || !price} busy={harvest.isPending} onClick={()=>harvest.mutate()}>Tambah hasil panen</Button>
        <div className="text-sm text-slate-600 bg-slate-50 rounded-xl p-4">{w.harvests.data?.length ?? 0} catatan panen tersimpan · {Number((w.harvests.data ?? []).reduce((t,h)=>t+Number(h.weightKg),0)).toLocaleString('id-ID')} kg</div>
        {s.status === 'PANEN' && <><div className="grid sm:grid-cols-2 gap-4"><Field label="Berat sampel panen (kg)"><input className={inputClass} type="number" min="0.01" step="0.01" value={sampleKg} onChange={e=>setSampleKg(e.target.value)}/></Field><Field label="Luas petak sampel (m²)"><input className={inputClass} type="number" min="0.01" step="0.01" value={sampleArea} onChange={e=>setSampleArea(e.target.value)}/></Field></div><Button variant="secondary" disabled={!sampleKg || !sampleArea} busy={sample.isPending} onClick={()=>sample.mutate()}>Simpan sampel panen</Button><div className="rounded-xl p-4 bg-emerald-50 border border-emerald-100 space-y-3"><p className="font-extrabold text-sm text-emerald-900 flex items-center gap-2"><Camera size={18}/> Unggah foto bukti sampel panen</p><p className="text-xs text-emerald-800">File asli JPEG/PNG/WebP tersimpan secara privat pada server lokal (maks 6 MB). Ini belum verifikasi GPS atau foto anti-manipulasi.</p><input aria-label="Pilih foto bukti" type="file" accept="image/jpeg,image/png,image/webp" className="block text-xs w-full" onChange={e=>setPhotoFile(e.target.files?.[0]??null)}/><Button variant="secondary" busy={photo.isPending} disabled={!photoFile} onClick={()=>photo.mutate()}>Simpan foto ke server</Button><ErrorLine error={photo.error}/>{photos.data?.length ? <div><p className="text-xs font-bold text-emerald-800">{photos.data.length} foto sudah tersimpan</p><div className="flex gap-2 flex-wrap mt-2">{photos.data.map(p=><a key={p.id} href={api.photos.fileUrl(s.id,p.id)} target="_blank" rel="noreferrer" title="Buka foto bukti"><img src={api.photos.fileUrl(s.id,p.id)} alt="Foto bukti sampel" className="h-20 w-20 object-cover rounded-lg border border-emerald-200"/></a>)}</div></div> : null}</div>
          <Field label="Total biaya aktual musim (juta Rp)"><input className={inputClass} type="number" min="0.01" step="0.01" value={cost} onChange={e=>setCost(e.target.value)}/></Field>
          <label className="text-xs text-slate-600 flex gap-2"><input type="checkbox" checked={consentTraining} onChange={e=>setConsentTraining(e.target.checked)}/> Saya menyetujui penggunaan data musim yang dianonimkan untuk melatih model selanjutnya (opsional).</label>
          {(!photos.data?.length || !sampleSaved.data) && <Message>Untuk menutup musim, simpan sampel dan minimal satu foto asli lebih dahulu.</Message>}
          <Button variant="secondary" busy={close.isPending} disabled={!cost || !photos.data?.length || !sampleSaved.data || !w.harvests.data?.length} onClick={()=>close.mutate()}>Tutup musim & buat riwayat</Button><ErrorLine error={close.error}/>
        </>}
        <ErrorLine error={harvest.error}/><ErrorLine error={sample.error}/>
      </div> : <p className="text-sm text-slate-500">Catatan panen tersedia setelah penanaman dimulai.</p>}
    </Card>
  </div>;
}

