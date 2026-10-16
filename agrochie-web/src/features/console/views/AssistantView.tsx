'use client';
import {useState,type FormEvent} from 'react';
import {MessageCircle,Send} from 'lucide-react';
import {api} from '../api';
import type {Workspace} from '../hooks';
import {Button,Card,Empty,ErrorLine,Heading,inputClass,Tag} from '../ui';
import {useTranslation} from '@/i18n';
import {requestLang,showDevBadge} from '@/features/i18n-auto/logic';
export function Assistant({ w }: { w: Workspace }) {
  const {t,lang}=useTranslation(); // [REVISI] B4 lang untuk backend
  const copy=t.assistant;
  const [messages,setMessages]=useState<{role:'user'|'assistant';text:string}[]>([]);
  const [draft,setDraft]=useState(()=>{ /* [REVISI] konteks awal dari Deteksi tanaman (sekali pakai): hanya mengisi kolom tulis, tidak otomatis terkirim */ if(typeof window==='undefined')return '';const ctx=window.sessionStorage.getItem('agrochie:assistant-context');if(!ctx)return '';window.sessionStorage.removeItem('agrochie:assistant-context');return ctx.slice(0,1000);}); const [sessionId,setSessionId]=useState<string>();
  const [loading,setLoading]=useState(false); const [error,setError]=useState<unknown>(null);
  const send=async(text:string)=>{if(!text.trim()||loading)return;setMessages(prev=>[...prev,{role:'user',text}]);setDraft('');setLoading(true);setError(null);try{const res=await api.assistant.chat(text,w.season?.id,sessionId,w.farm?.id,requestLang(lang));setSessionId(res.sessionId);setMessages(prev=>[...prev,{role:'assistant',text:res.answer}]);}catch(e){setError(e);}finally{setLoading(false);}};
  const submit=(e:FormEvent)=>{e.preventDefault();void send(draft);};
  return <div className="space-y-5"><Heading title={copy.title} description={copy.description} action={showDevBadge(process.env.NODE_ENV)?<span data-no-translate><Tag>Gemini via Express API</Tag></span>:undefined} /* [REVISI] B5 *//><div className="grid lg:grid-cols-[minmax(0,1.6fr)_minmax(250px,.65fr)] gap-5">
  <Card className="min-h-[490px] flex flex-col" title={copy.conversation} subtitle={copy.conversationSubtitle}><div className="flex-1 space-y-4 mb-5 max-h-[520px] overflow-y-auto" aria-live="polite">{messages.length===0?<Empty icon={MessageCircle} title={copy.emptyTitle} detail={copy.emptyDetail}/>:messages.map((m,i)=><div className={`flex ${m.role==='user'?'justify-end':'justify-start'}`} key={i}><div data-no-translate className={`rounded-2xl px-4 py-3 max-w-[88%] text-sm whitespace-pre-wrap ${m.role==='user'?'bg-emerald-800 text-white':'bg-slate-100 text-slate-800'}`}>{m.text}</div></div>)}{loading&&<p className="text-sm text-slate-500">{copy.responding}</p>}</div><ErrorLine error={error}/><form onSubmit={submit} className="flex gap-2"><input className={inputClass} maxLength={1000} placeholder={copy.placeholder} value={draft} onChange={e=>setDraft(e.target.value)}/><Button type="submit" icon={Send} busy={loading} disabled={!draft.trim()}>{copy.send}</Button></form></Card>
  <Card title={copy.examplesTitle} subtitle={copy.examplesSubtitle}><div className="space-y-2">{copy.examples.map(q=><button key={q} onClick={()=>void send(q)} className="block w-full text-left rounded-xl border border-slate-100 bg-slate-50 hover:bg-emerald-50 p-3 text-sm font-bold text-slate-700">{q}</button>)}</div><div className="mt-5 text-xs text-slate-500">{copy.weatherNote}</div></Card></div></div>;
}

