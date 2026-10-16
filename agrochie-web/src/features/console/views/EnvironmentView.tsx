'use client';
import {useQuery} from '@tanstack/react-query';
import Link from 'next/link';
import {ArrowRight,Droplets,Thermometer,Wind} from 'lucide-react';
import {api} from '../api';
import type {Workspace} from '../hooks';
import {Card,ErrorLine,Heading,Message,Metric,Tag} from '../ui';
// [REVISI] angka aman: null/undefined/NaN -> '-' (tanpa .toFixed pada null)
const fmt=(v:number|null|undefined,unit='')=>typeof v==='number'&&Number.isFinite(v)?`${v.toFixed(1)}${unit}`:'-';
// [REVISI] kartu cuaca musim: tidak pernah return null; selalu ada empty state / pesan galat.
function SeasonWeatherCard({ seasonId }: { seasonId?: string }) {
  const sw=useQuery({queryKey:['console','season-weather',seasonId],queryFn:()=>api.weather.season(seasonId!),enabled:!!seasonId,staleTime:10*60_000,retry:false});
  const d=sw.data;
  let body:React.ReactNode;
  if(!seasonId) body=<div className="text-sm text-slate-500">Belum ada musim tanam. Buat musim terlebih dahulu.</div>;
  else if(sw.isLoading) body=<div className="text-sm text-slate-500">Mengambil data cuaca musim...</div>;
  else if(sw.error) body=<Message color="red">{sw.error instanceof Error&&sw.error.message?sw.error.message:'Data cuaca musim belum dapat diambil. Coba lagi nanti.'}</Message>;
  else if(!d) body=<div className="text-sm text-slate-500">Data cuaca musim belum tersedia.</div>;
  else {
    const weeks=Array.isArray(d.weeks)?d.weeks:[];
    const max=Math.max(1,...weeks.map(x=>typeof x.rainMm==='number'&&Number.isFinite(x.rainMm)?x.rainMm:0));
    body=<div className="space-y-4">
      {!d.weeksCounted&&<div className="text-sm text-slate-600 bg-slate-50 rounded-xl p-4">Musim baru dimulai. Data cuaca musim akan muncul setelah minggu pertama selesai.</div>}
      <div className="grid sm:grid-cols-3 gap-4"><Metric icon={Droplets} label="Rata-rata hujan/minggu" value={fmt(d.rainAvgMm,' mm')} caption={`${d.weeksCounted??0} minggu dihitung`}/><Metric icon={Droplets} label="Minggu hujan lebat" value={String(d.heavyRainWks??0)} caption="Total hujan mingguan ≥ 150 mm"/><Metric icon={Thermometer} label="Suhu maks rata-rata" value={fmt(d.tempMaxAvg,'°C')} caption={d.source||'Open-Meteo'}/></div>
      {weeks.length>0&&<div className="flex gap-1 items-end h-28 overflow-x-auto">{weeks.map(x=>{const ok=typeof x.rainMm==='number'&&Number.isFinite(x.rainMm);return <div key={x.minggu} className="flex-1 min-w-5 flex flex-col items-center justify-end h-full" title={`Minggu ${x.minggu}: ${fmt(x.rainMm,' mm')} · ${fmt(x.tempMaxAvg,'°C')}`}><div className={`w-full rounded-t ${ok?'bg-emerald-400':'bg-slate-200'}`} style={{height:ok?`${Math.max(4,(x.rainMm as number)/max*100)}%`:'4%'}}/><small className="text-[10px] text-slate-500 mt-1">{x.minggu}</small></div>})}</div>}
    </div>;
  }
  return <Card title="Cuaca musim tanam" subtitle="Ringkasan hujan dan suhu per minggu sejak tanam.">{body}</Card>;
}
export function FieldWeather({ w }: { w: Workspace }) {
  const farm=w.farm;
  const weather=useQuery({queryKey:['console','weather',farm?.latitude,farm?.longitude],queryFn:()=>api.weather.current(Number(farm?.latitude),Number(farm?.longitude)),enabled:!!farm?.latitude&&!!farm?.longitude,staleTime:10*60_000,retry:false});
  const forecast=useQuery({queryKey:['console','forecast',farm?.latitude,farm?.longitude],queryFn:()=>api.weather.forecast(Number(farm?.latitude),Number(farm?.longitude)),enabled:!!farm?.latitude&&!!farm?.longitude,staleTime:20*60_000,retry:false});
  return <div className="space-y-5"><Heading title="Cuaca & lahan" description="Informasi kondisi lingkungan dan profil tanah yang memengaruhi kebutuhan usaha tani." action={<Tag>Open-Meteo</Tag>}/>
    <div className="grid sm:grid-cols-3 gap-4"><Metric icon={Thermometer} label="Suhu terkini" value={weather.data?.tempC==null?'—':`${weather.data.tempC}°C`} caption="Open-Meteo, data terkini"/><Metric icon={Droplets} label="Curah hujan" value={weather.data?.rainMm==null?'—':`${weather.data.rainMm} mm`} caption="Open-Meteo, saat pengamatan"/><Metric icon={Wind} label="Kecepatan angin" value={weather.data?.windKmh==null?'—':`${weather.data.windKmh} km/j`} caption="Open-Meteo"/></div>
    <Card title="Prakiraan cuaca 7 hari" subtitle="Perkiraan hujan dan suhu maksimum harian di koordinat lahan.">
      {forecast.data?.days?.length ? <div className="grid grid-cols-7 gap-1 sm:gap-3">{forecast.data.days.map((d)=>{const rain=d.rainMm??0;return <div className="text-center p-2 rounded-xl bg-slate-50" key={d.date}><span className="text-[11px] font-black text-slate-600">{new Date(`${d.date}T00:00:00`).toLocaleDateString('id-ID',{weekday:'short'})}</span><div className="h-24 flex items-end justify-center my-3"><div className="w-full max-w-9 rounded-t-lg bg-emerald-400" style={{height:`${Math.max(3,Math.min(100,rain*2))}%`}} title={`${rain} mm`}/></div><strong className="text-xs text-slate-800 block">{rain} mm</strong><small className="text-[10px] text-slate-500 block mt-1">{d.maxTempC??'—'}°C</small></div>})}</div> : <div className="text-sm text-slate-500">{forecast.isLoading?'Mengambil data prakiraan dari Open-Meteo...':'Tambahkan koordinat lahan atau periksa koneksi cuaca untuk melihat prakiraan.'}</div>}
      <ErrorLine error={forecast.error}/>
    </Card>
    <SeasonWeatherCard seasonId={w.season?.plantedOn?w.season.id:undefined}/>
    <div className="grid lg:grid-cols-2 gap-5"><Card title="Kondisi tanah" subtitle="Data dari hasil pengukuran petani."><div className="space-y-3 text-sm">{[['Nama',farm?.name],['Jenis tanah',farm?.soilType],['pH tanah',farm?.ph],['Nitrogen',farm?.nitrogen],['Fosfor',farm?.phosphorus],['Kalium',farm?.potassium],['Sumber air',farm?.waterSource]].map(([label,v])=><div className="flex justify-between gap-3 pb-3 border-b border-slate-100 last:border-0" key={label}><span className="text-slate-500">{label}</span><strong data-no-translate={label==='Nama'?true:undefined} className="text-slate-800 text-right">{v||'Belum tersedia'}</strong></div>)}</div><Link href="/profil" className="text-emerald-700 font-extrabold text-sm inline-flex items-center gap-2 mt-4">Perbarui profil <ArrowRight size={15}/></Link></Card>
    <Card title="Keterangan data" subtitle="Dari mana informasi ini berasal?"><p className="text-sm text-slate-600 leading-relaxed">Cuaca diambil oleh Express.js dari layanan Open-Meteo berdasarkan titik koordinat yang Anda simpan. Informasi NPK dan pH berasal dari profil petani, bukan sensor IoT atau prediksi AI.</p><p className="text-sm text-slate-600 leading-relaxed mt-3">Kualitas daun menggunakan CNN belum diimplementasikan pada aplikasi ini. Jangan gunakan indikasi demo sebagai diagnosis tanaman.</p>{!farm?.latitude&&<Message>Isi latitude dan longitude di Profil untuk mengambil cuaca aktual.</Message>}<ErrorLine error={weather.error}/></Card></div>
  </div>;
}

