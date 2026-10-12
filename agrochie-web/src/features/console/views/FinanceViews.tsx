'use client';
import Link from 'next/link';
import {Activity,ArrowRight,BarChart3,CalendarDays,ShieldCheck,Wallet} from 'lucide-react';
import {amount,CROP_NAME,rupiah,type Season} from '../api';
import type {Workspace} from '../hooks';
import {Card,Empty,FinanceGate,Heading,Message,Metric,Tag} from '../ui';
export function Prediction({ w }: { w: Workspace }) {
  const s = w.season; const p = s?.costPlan;
  return <div className="space-y-5"><Heading title="Prediksi biaya musim" description="Rentang hasil model disajikan bersama rincian rencana pengeluaran." action={<Tag color={p?'green':'gray'}>{p ? `Model: ${p.modelVersion}` : 'Belum aktif'}</Tag>}/>
    {!s || s.status === 'DRAFT' || !p ? <FinanceGate season={s}/> : <>
      {p.needsRecalc && <Message>Profil lahan berubah setelah rencana dibuat. Gunakan hitung ulang dengan parameter valid pada backend sebelum memakai angka ini untuk keputusan.</Message>}
      <div className="grid sm:grid-cols-3 gap-4"><Metric icon={BarChart3} label="Estimasi rendah (P10)" value={rupiah(p.p10Jt)} caption="Persentil 10"/><Metric icon={Wallet} label="Estimasi tengah (P50)" value={rupiah(p.p50Jt)} caption="Titik tengah model"/><Metric icon={Activity} label="Estimasi tinggi (P90)" value={rupiah(p.p90Jt)} caption="Persentil 90"/></div>
      <Card title="Rentang prediksi biaya" subtitle="P10–P90 adalah interval prediksi model, bukan jaminan biaya akhir.">
        <div className="flex justify-between text-xs font-extrabold text-emerald-800"><span>{rupiah(p.p10Jt)}</span><span>{rupiah(p.p90Jt)}</span></div><div className="h-7 bg-emerald-100 rounded-full mt-3 relative overflow-hidden"><div className="absolute top-0 bottom-0 left-[10%] right-[10%] bg-gradient-to-r from-emerald-300 to-emerald-700 rounded-full"/><div className="absolute w-1 h-full bg-white left-1/2 shadow-md"/></div><p className="text-xs text-slate-500 mt-4">Perkiraan pertengahan: <strong className="text-slate-900">{rupiah(p.p50Jt)}</strong>. Nilai dihitung oleh mesin prediksi yang dikonfigurasi pada backend.</p>
      </Card><WeeklyBars season={s}/>
      </>}
    </div>;
}

function WeeklyBars({ season }: { season: Season }) {
  const p = season.costPlan;
  if (!p) return null;
  const weekly = Array.isArray(p.weeklyJt) ? p.weeklyJt.map(amount) : [];
  const max = Math.max(1, ...weekly);
  return <Card title="Distribusi biaya mingguan" subtitle="Angka berasal dari rencana biaya yang tersimpan di server, bukan data demo.">
    {weekly.length ? <><div className="console-bars">{weekly.map((v,i)=><div className="console-bar-cell" key={i} title={`Minggu ${i+1}: ${rupiah(v)}`}><div className={`console-bar ${v===max?'console-bar-peak':''}`} style={{ height: `${Math.max(4,v/max*100)}%` }}/><small>{i+1}</small></div>)}</div><div className="flex justify-between gap-3 text-[11px] text-slate-500 mt-4"><span>Minggu 1</span><span>Batang lebih tinggi = kebutuhan lebih besar</span><span>Minggu {weekly.length}</span></div></> : <Empty title="Belum ada pola mingguan" detail="Mesin biaya belum mengembalikan rencana biaya per minggu."/>}
  </Card>;
}

export function Budget({ w }: { w: Workspace }) {
  const s = w.season; const plan = s?.costPlan;
  const phases = [{name:'Persiapan lahan',pct:19},{name:'Penanaman',pct:16},{name:'Perawatan',pct:50},{name:'Panen & pascapanen',pct:15}];
  return <div className="space-y-5"><Heading title="Rencana biaya" description="Gambaran biaya per fase untuk membantu menyusun kebutuhan modal."/>
    {!s || s.status === 'DRAFT' || !plan ? <FinanceGate season={s}/> : <><div className="grid sm:grid-cols-3 gap-4"><Metric icon={Wallet} label="Total rencana" value={rupiah(plan.p50Jt)} caption="Estimasi P50"/><Metric icon={Activity} label="Modal tersedia" value={plan.capitalJt !== null ? rupiah(plan.capitalJt) : 'Belum diisi'} caption="Dari pembiayaan"/><Metric icon={ShieldCheck} label="Kekurangan modal" value={rupiah(plan.shortfallJt)} caption="Perkiraan awal"/></div>
      <div className="grid lg:grid-cols-2 gap-5"><Card title="Distribusi fase" subtitle="Porsi indikatif berdasarkan baseline dokumen AgroChie (19/16/50/15%).">{phases.map((p,i)=><div key={p.name} className="mb-5 last:mb-0"><div className="flex justify-between text-sm"><span className="font-bold text-slate-700">{p.name}</span><span className="font-extrabold text-slate-900">{rupiah(amount(plan.p50Jt)*p.pct/100)}</span></div><div className="bg-emerald-50 h-2.5 mt-3 rounded-full overflow-hidden"><div className="h-full rounded-full bg-emerald-700" style={{width:`${p.pct}%`, opacity:1-i*.13}}/></div><p className="text-xs text-slate-500 mt-1">{p.pct}% dari total biaya · alokasi indikatif</p></div>)}</Card><Card title="Dasar perencanaan" subtitle="Keterangan angka dan sumbernya"><div className="space-y-4 text-sm text-slate-600"><p><strong className="text-slate-900">Prediksi:</strong> keluaran model biaya yang tersimpan di backend.</p><p><strong className="text-slate-900">Porsi fase:</strong> aturan baseline, bukan pembelajaran AI pada setiap kategori.</p><p><strong className="text-slate-900">Catatan aktual:</strong> diperoleh dari transaksi pada menu Catatan.</p><p><strong className="text-slate-900">Akurasi:</strong> perlu pengujian menggunakan data petani nyata.</p></div><Link href="/catatan" className="text-emerald-700 font-bold text-sm inline-flex items-center gap-2 mt-7">Lihat catatan aktual <ArrowRight size={16}/></Link></Card></div>
    </>}
  </div>;
}

export function Cashflow({ w }: { w: Workspace }) {
  const s=w.season; const p=s?.costPlan;
  if (!s || s.status==='DRAFT' || !p) return <div className="space-y-5"><Heading title="Kalender uang" description="Jadwal kebutuhan modal sepanjang musim tanam."/><FinanceGate season={s}/></div>;
  const weeks=Array.isArray(p.weeklyJt)?p.weeklyJt.map(amount):[];
  const start=s.plantedOn ? Date.parse(s.plantedOn) : null;
  const spentByWeek = new Map<number,number>();
  if(start!==null) for(const e of w.expenses.data??[]) if(!e.simulated){let wk=Math.floor((Date.parse(e.spentOn)-start)/604800000)+1;wk=Math.max(1,Math.min(weeks.length,wk));spentByWeek.set(wk,(spentByWeek.get(wk)??0)+amount(e.amountJt));}
  const cumulatives = weeks.reduce<number[]>((acc, v) => { acc.push((acc.at(-1) ?? 0) + v); return acc; }, []);
  return <div className="space-y-5"><Heading title="Kalender uang" description="Jadwal biaya mingguan untuk mengantisipasi pengeluaran besar."/><div className="grid sm:grid-cols-3 gap-4"><Metric icon={CalendarDays} label="Minggu perencanaan" value={`${weeks.length} minggu`} caption={CROP_NAME[s.crop]}/><Metric icon={Wallet} label="Biaya total" value={rupiah(p.p50Jt)} caption="Rencana musim"/><Metric icon={Activity} label="Modal awal" value={p.capitalJt===null?'Belum ada':rupiah(p.capitalJt)} caption="Dari perhitungan"/></div><Card title="Arus keluar per minggu" subtitle={start===null?'Tanggal kalender dimulai setelah penanaman aktif.':'Rencana model dibanding transaksi aktual.'}>
    {!weeks.length ? <Empty title="Belum ada pola mingguan" detail="Tidak ada rincian mingguan dari mesin prediksi."/>:<div className="overflow-x-auto"><table className="console-table"><thead><tr><th>Minggu</th><th>Estimasi biaya</th><th>Realisasi tercatat</th><th>Sisa modal proyeksi</th></tr></thead><tbody>{weeks.map((v,i)=>{const cumulative=cumulatives[i];const left=p.capitalJt===null?null:amount(p.capitalJt)-cumulative;return <tr key={i}><td className="font-bold">Minggu {i+1}</td><td>{rupiah(v)}</td><td>{start===null?'Menunggu tanggal tanam':rupiah(spentByWeek.get(i+1)??0)}</td><td className={left!==null&&left<0?'font-black text-red-600':'font-black text-slate-800'}>{left===null?'Modal belum diisi':rupiah(left)}</td></tr>})}</tbody></table></div>}
  </Card></div>;
}

