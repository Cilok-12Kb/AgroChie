'use client';
import {useState,type FormEvent} from 'react';
import {MessageCircle,Send} from 'lucide-react';
import {api} from '../api';
import type {Workspace} from '../hooks';
import {Button,Card,Empty,ErrorLine,Heading,inputClass,Tag} from '../ui';
export function Assistant({ w }: { w: Workspace }) {
  const [messages,setMessages]=useState<{role:'user'|'assistant';text:string}[]>([]);
  const [draft,setDraft]=useState(''); const [sessionId,setSessionId]=useState<string>();
  const [loading,setLoading]=useState(false); const [error,setError]=useState<unknown>(null);
  const send=async(text:string)=>{if(!text.trim()||loading)return;setMessages(prev=>[...prev,{role:'user',text}]);setDraft('');setLoading(true);setError(null);try{const res=await api.assistant.chat(text,w.season?.id,sessionId);setSessionId(res.sessionId);setMessages(prev=>[...prev,{role:'assistant',text:res.answer}]);}catch(e){setError(e);}finally{setLoading(false);}};
  const submit=(e:FormEvent)=>{e.preventDefault();void send(draft);};
  return <div className="space-y-5"><Heading title="Asisten AgroChie" description="Konsultasi berdasarkan data akun dan pengetahuan agronomi yang tersedia di backend." action={<Tag>Gemini via Express API</Tag>}/><div className="grid lg:grid-cols-[minmax(0,1.6fr)_minmax(250px,.65fr)] gap-5">
  <Card className="min-h-[490px] flex flex-col" title="Percakapan" subtitle="Jawaban hanya muncul jika layanan AI berhasil merespons."><div className="flex-1 space-y-4 mb-5 max-h-[520px] overflow-y-auto" aria-live="polite">{messages.length===0?<Empty icon={MessageCircle} title="Apa yang ingin Anda tanyakan?" detail="Tanyakan rencana biaya, pengeluaran, atau istilah pertanian yang ingin dipahami."/>:messages.map((m,i)=><div className={`flex ${m.role==='user'?'justify-end':'justify-start'}`} key={i}><div className={`rounded-2xl px-4 py-3 max-w-[88%] text-sm whitespace-pre-wrap ${m.role==='user'?'bg-emerald-800 text-white':'bg-slate-100 text-slate-800'}`}>{m.text}</div></div>)}{loading&&<p className="text-sm text-slate-500">Asisten sedang merespons...</p>}</div><ErrorLine error={error}/><form onSubmit={submit} className="flex gap-2"><input className={inputClass} maxLength={1000} placeholder="Tulis pertanyaan..." value={draft} onChange={e=>setDraft(e.target.value)}/><Button type="submit" icon={Send} busy={loading} disabled={!draft.trim()}>Kirim</Button></form></Card>
  <Card title="Contoh pertanyaan" subtitle="Pilih untuk bertanya ke asisten."><div className="space-y-2">{['Berapa biaya musim saya?','Apa yang paling memengaruhi biaya tani?','Apa langkah setelah memulai pembiayaan?','Bagaimana memahami pH tanah?'].map(q=><button key={q} onClick={()=>void send(q)} className="block w-full text-left rounded-xl border border-slate-100 bg-slate-50 hover:bg-emerald-50 p-3 text-sm font-bold text-slate-700">{q}</button>)}</div><div className="mt-5 text-xs text-slate-500">Diperlukan konfigurasi GEMINI_API_KEY dan RAG di backend. Jika layanan tidak tersedia, pesan error ditampilkan tanpa membuat jawaban simulasi.</div></Card></div></div>;
}

