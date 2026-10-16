'use client';
import {useState} from 'react';
import {useMutation} from '@tanstack/react-query';
import {Plus,Trash2,ClipboardList} from 'lucide-react';
import {api,amount,CATEGORY_NAME,dateOnly,idr,rupiah,shortDate} from '../api';
import type {Workspace} from '../hooks';
import {Button,Busy,Card,Empty,ErrorLine,Field,FinanceGate,Heading,inputClass,Tag} from '../ui';
export function ExpenseForm({ w }: { w: Workspace }) {
  const s = w.season;
  const [category, setCategory] = useState<keyof typeof CATEGORY_NAME>('PUPUK');
  const [on, setOn] = useState(dateOnly()); const [idrAmount, setAmount] = useState(''); const [note,setNote] = useState('');
  const add = useMutation({ mutationFn: () => api.expenses.create(s!.id, { category, spentOn: on, amountJt: (Number(idrAmount)/1_000_000).toFixed(3), ...(note ? { note } : {}) }), onSuccess: () => { setAmount(''); setNote(''); w.reload(); } });
  const remove = useMutation({ mutationFn: (id: string) => api.expenses.remove(s!.id,id), onSuccess: () => w.reload() });
  const expenses = w.expenses.data ?? [];
  const total = expenses.reduce((t,x)=>t+(x.simulated?0:amount(x.amountJt)),0);
  return <div className="space-y-5"><Heading title="Catatan pengeluaran" description="Transaksi aktual dicatat per tanggal untuk perbandingan biaya dan dataset musim." action={s && <Tag>{s.status}</Tag>}/>
  {s?.status === 'DRAFT' ? <FinanceGate season={s}/> : !s ? <Card><Empty icon={ClipboardList} title="Belum ada musim" detail="Buat musim dulu sebelum memasukkan pengeluaran." link="/musim-tanam"/></Card> : <>
    <Card title="Tambahkan transaksi" subtitle="Setiap transaksi tersimpan langsung ke PostgreSQL melalui API Express.">
      <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Field label="Tanggal"><input type="date" className={inputClass} max={dateOnly()} value={on} onChange={e=>setOn(e.target.value)}/></Field>
        <Field label="Kategori"><select className={inputClass} value={category} onChange={e=>setCategory(e.target.value as keyof typeof CATEGORY_NAME)}>{Object.entries(CATEGORY_NAME).map(([key,value])=><option key={key} value={key}>{value}</option>)}</select></Field>
        <Field label="Jumlah (rupiah)" hint="Kelipatan Rp1.000"><input type="number" className={inputClass} step="1000" min="1000" value={idrAmount} onChange={e=>setAmount(e.target.value)} placeholder="Contoh: 350000"/></Field>
        <Field label="Catatan (opsional)"><input className={inputClass} value={note} maxLength={500} onChange={e=>setNote(e.target.value)} placeholder="Beli pupuk ..."/></Field>
      </div><div className="mt-5"><Button icon={Plus} busy={add.isPending} disabled={s.status === 'SELESAI' || !idrAmount || Number(idrAmount)%1000!==0 || Number(idrAmount)<=0} onClick={()=>add.mutate()}>Simpan pengeluaran</Button></div><ErrorLine error={add.error}/>
    </Card>
    <Card title="Daftar transaksi" subtitle={`${expenses.length} transaksi · total ${rupiah(total)}`}>
      {w.expenses.isLoading ? <Busy/> : expenses.length ? <div className="overflow-x-auto"><table className="console-table"><thead><tr><th>Tanggal</th><th>Kategori</th><th>Catatan</th><th>Nominal</th><th>Aksi</th></tr></thead><tbody>{[...expenses].reverse().map(e=><tr key={e.id}><td>{shortDate(e.spentOn)}</td><td>{CATEGORY_NAME[e.category] ?? e.category}</td><td data-no-translate>{e.note || '—'}</td><td className="font-extrabold">{idr(amount(e.amountJt)*1_000_000)}</td><td><button className="text-red-600 p-2 hover:bg-red-50 rounded-xl" title="Hapus transaksi" disabled={remove.isPending || s.status === 'SELESAI'} onClick={()=>{if(window.confirm('Hapus transaksi ini?')) remove.mutate(e.id);}}><Trash2 size={16}/></button></td></tr>)}</tbody></table></div> : <Empty title="Belum ada pengeluaran" detail="Transaksi yang Anda simpan akan tampil di sini. Tidak ada catatan demo yang dicampur dengan data aktual."/>}<ErrorLine error={remove.error}/><ErrorLine error={w.expenses.error}/>
    </Card>
  </>}
  </div>;
}
