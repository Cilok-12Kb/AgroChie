'use client';
import {useState} from 'react';
import {useQuery,useMutation,useQueryClient} from '@tanstack/react-query';
import {Activity,CalendarDays,History,ShieldCheck,Wallet} from 'lucide-react';
import {api,CROP_NAME,CROP_WEEKS,rupiah,shortDate} from '../api';
import type {Workspace} from '../hooks';
import {Button,Busy,Card,Empty,ErrorLine,Field,FinanceGate,Heading,inputClass,Message,Metric,Tag} from '../ui';
export function HistoryPage({ w }: { w: Workspace }) {
  const history=useQuery({queryKey:['console','history'],queryFn:api.history.list,enabled:!!w.account.data});
  return <div className="space-y-5"><Heading title="Riwayat musim" description="Musim yang sudah ditutup, sumber data nyata untuk pelatihan model di masa depan." action={<Tag color="green">Database aktual</Tag>}/>
    <Card title="Daftar musim tersimpan" subtitle="Data berasal dari tabel SeasonRecord milik akun Anda.">
      {history.isLoading?<Busy/>:history.data?.length?<div className="overflow-x-auto"><table className="console-table"><thead><tr><th>Nama musim</th><th>Komoditas</th><th>Total biaya aktual</th><th>Kualitas data</th><th>Persetujuan pelatihan</th></tr></thead><tbody>{history.data.map(r=><tr key={r.id}><td className="font-bold">{r.label||r.id.slice(0,8)}</td><td>{CROP_NAME[r.crop]}</td><td>{rupiah(r.totalCostJt)}</td><td><Tag color={r.quality==='SIAP_DILATIH'?'green':'amber'}>{r.quality.replaceAll('_',' ')}</Tag></td><td>{r.consentTraining?'Diizinkan':'Belum disetujui'}</td></tr>)}</tbody></table></div>:<Empty icon={History} title="Belum ada riwayat" detail="Riwayat terbentuk setelah musim ditutup secara lengkap menggunakan data dan bukti yang valid." link="/musim-tanam"/>}
      <ErrorLine error={history.error}/></Card><Message>Ekspor dataset 32 kolom dan persetujuan pelatihan lanjutan belum memiliki endpoint publik di backend ini; belum diaktifkan dari antarmuka.</Message></div>;
}

export function Credit({ w }: { w: Workspace }) {
  const s=w.season; const p=s?.costPlan;
  const [value,setValue]=useState('');const [weeks,setWeeks]=useState('10');const [purpose,setPurpose]=useState('Pembelian kebutuhan sarana produksi');const [consent,setConsent]=useState(false);
  const loans=useQuery({queryKey:['console','loans',s?.id],queryFn:()=>api.loans.list(s!.id),enabled:!!s?.id});
  const qc=useQueryClient();
  const submit=useMutation({mutationFn:()=>api.loans.create(s!.id,{amountJt:value,tenorWeeks:Number(weeks),purpose,consentShare:consent}),onSuccess:()=>qc.invalidateQueries({queryKey:['console','loans',s?.id]})});
  return <div className="space-y-5"><Heading title="Risiko & kredit" description="Tinjau kebutuhan modal dan buat kode rujukan untuk pengajuan manual."/>
    {!s||s.status==='DRAFT'||!p?<FinanceGate season={s}/>:<>
      <div className="grid sm:grid-cols-3 gap-4"><Metric icon={Wallet} label="Biaya diproyeksikan" value={rupiah(p.p50Jt)}/><Metric icon={Activity} label="Modal tersedia" value={p.capitalJt===null?'Belum diisi':rupiah(p.capitalJt)}/><Metric icon={ShieldCheck} label="Kekurangan dana" value={rupiah(p.shortfallJt)}/></div>
      <div className="grid lg:grid-cols-2 gap-5"><Card title="Ajukan pinjaman musiman" subtitle="Kode rujukan dibuat di backend, tetapi belum dikirim ke bank.">
        <Message>Pengajuan tersimpan sebagai <strong>DIAJUKAN</strong> dan menghasilkan kode rujukan, bukan persetujuan kredit. Skor heuristik belum divalidasi.</Message>
        <div className="space-y-4 mt-5"><Field label="Jumlah pinjaman (juta rupiah)"><input className={inputClass} type="number" min="0.01" step="0.01" value={value} onChange={e=>setValue(e.target.value)} placeholder="Contoh: 12.5"/></Field><Field label="Tenor (minggu)"><input className={inputClass} type="number" min="1" max="52" step="1" value={weeks} onChange={e=>setWeeks(e.target.value)}/></Field><Field label="Tujuan pembiayaan"><textarea className={`${inputClass} !h-24`} maxLength={300} value={purpose} onChange={e=>setPurpose(e.target.value)}/></Field>
        <label className="text-xs flex gap-2 items-start text-slate-600"><input type="checkbox" checked={consent} onChange={e=>setConsent(e.target.checked)} className="mt-0.5"/> Saya menyetujui penyimpanan dan penggunaan data untuk keperluan kode rujukan pembiayaan.</label>
        <Button busy={submit.isPending} disabled={!consent || !value || !weeks || purpose.trim().length<3} onClick={()=>submit.mutate()}>Buat kode rujukan</Button><ErrorLine error={submit.error}/>{submit.isSuccess&&<Message color="green">Kode rujukan berhasil dibuat dan tersimpan di server.</Message>}</div>
      </Card><Card title="Riwayat rujukan" subtitle="Tidak ada integrasi keputusan dengan sistem bank.">
        {loans.isLoading?<Busy/>:loans.data?.length?<div className="space-y-3">{loans.data.map(l=><div className="rounded-xl border border-slate-100 p-4" key={l.id}><div className="flex justify-between gap-2"><span className="font-black text-emerald-800 text-sm">{l.referralCode}</span><Tag color="amber">{l.status}</Tag></div><p className="font-extrabold text-slate-800 mt-2">{rupiah(l.amountJt)}</p><p className="text-xs text-slate-500 mt-1">Tenor {l.tenorWeeks} minggu · Berlaku sampai {shortDate(l.expiresAt)}</p></div>)}</div>:<Empty icon={ShieldCheck} title="Belum ada pengajuan" detail="Kode rujukan yang Anda buat akan muncul di sini."/>}<ErrorLine error={loans.error}/>
      </Card></div>
    </>}
  </div>;
}
const REMINDER_LABEL:Record<string,string>={cek_hama:'Periksa tanda hama dan penyakit',cek_air:'Periksa kebutuhan air dan irigasi',cek_nutrisi:'Periksa kondisi nutrisi/pupuk',catat_biaya:'Catat pengeluaran minggu ini'};
export function ReminderPage({w}:{w:Workspace}) {
  const s=w.season;
  const [now] = useState<number>(() => Date.now());
  const week=s?.plantedOn?Math.max(1,Math.min(CROP_WEEKS[s.crop],Math.floor((now-Date.parse(s.plantedOn))/604800000)+1)):1;
  const qc=useQueryClient();
  const items=useQuery({queryKey:['console','checklist',s?.id,week],queryFn:()=>api.checklist.get(s!.id,week),enabled:!!s?.id&&!!s.plantedOn});
  const mutation=useMutation({mutationFn:(value:{key:string;done:boolean})=>api.checklist.set(s!.id,week,value.key,value.done),onSuccess:()=>qc.invalidateQueries({queryKey:['console','checklist',s?.id,week]})});
  return <div className="space-y-5"><Heading title="Pengingat cek lahan" description="Checklist mingguan tersimpan pada backend; gunakan sebagai panduan kegiatan lapangan." action={<Tag color="green">Checklist aktual</Tag>}/>
    <Card title={`Checklist minggu ${week}`} subtitle="Empat aktivitas yang bisa ditandai selesai dan diakses kembali dari server.">
    {!s?.plantedOn?<Empty icon={CalendarDays} title="Belum mulai penanaman" detail="Checklist mengikuti tanggal mulai penanaman." link="/musim-tanam"/>:items.isLoading?<Busy/>:<div className="space-y-2">{items.data?.items.map(item=><label key={item.key} className="flex items-center gap-3 rounded-xl p-4 border border-slate-100 hover:bg-emerald-50/30 text-sm cursor-pointer"><input type="checkbox" className="w-4 h-4 accent-emerald-700" checked={item.done} disabled={mutation.isPending} onChange={e=>mutation.mutate({key:item.key,done:e.target.checked})}/><span className={`font-bold ${item.done?'text-slate-400 line-through':'text-slate-700'}`}>{REMINDER_LABEL[item.key]||item.key}</span></label>)}</div>}
      <ErrorLine error={items.error}/><ErrorLine error={mutation.error}/>
    </Card></div>;
}

