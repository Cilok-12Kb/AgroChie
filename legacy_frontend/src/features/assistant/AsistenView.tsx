'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { SectionCard } from '@/components/ui/SectionCard';
import { AppButton } from '@/components/ui/AppButton';
import { StatusBadge } from '@/components/ui/StatusBadge';
import { useActiveSeason, canViewFinancing } from '@/hooks/useActiveSeason';
import { MessageCircle, Bot, SendHorizonal, AlertCircle, Sprout } from 'lucide-react';
import { EmptyState } from '@/components/ui/FeedbackState';
import Link from 'next/link';
import { Lock } from 'lucide-react';

const SUGGESTED_QUESTIONS = [
  'Berapa biaya musim ini?',
  'Kapan modal saya habis?',
  'Apa pengeluaran minggu depan?',
  'Bagaimana cuaca minggu ini?',
  'Apakah ada biaya yang melenceng?',
];

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  isDemo?: boolean;
}

export function AsistenView() {
  const { season } = useActiveSeason();
  const hasFinancing = canViewFinancing(season);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');

  function handleSend(text?: string) {
    const msg = text ?? input;
    if (!msg.trim()) return;

    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: msg,
    };

    // Demo response
    const demoResponse: ChatMessage = {
      id: (Date.now() + 1).toString(),
      role: 'assistant',
      content: `[SIMULASI] Ini adalah respons demo. Asisten otomatis (Gemini) belum tersambung. Pertanyaan Anda: "${msg}" akan dijawab oleh asisten setelah integrasi backend tersedia.`,
      isDemo: true,
    };

    setMessages((prev) => [...prev, userMsg, demoResponse]);
    setInput('');
  }

  if (!hasFinancing) {
    return (
      <div className="animate-fade-in">
        <PageHeader title="Asisten AgroChie" />
        <EmptyState
          icon={<Lock size={40} className="text-[--text-muted]" />}
          title="Mulai pembiayaan untuk menggunakan asisten"
          description="Buka Musim tanam → Mulai pembiayaan terlebih dahulu."
        />
      </div>
    );
  }

  return (
    <div className="animate-fade-in space-y-4">
      <PageHeader
        title="Asisten AgroChie"
        subtitle="Tanya jawab seputar rencana biaya dan pertanian."
        action={<StatusBadge label="Asisten otomatis belum aktif" variant="demo" size="sm" />}
      />

      {/* Status notice */}
      <div className="flex gap-3 bg-yellow-50 border border-yellow-200 rounded-2xl p-4">
        <AlertCircle size={18} className="text-yellow-600 flex-shrink-0 mt-0.5" />
        <div>
          <p className="font-bold text-yellow-800 text-sm">Asisten otomatis belum aktif</p>
          <p className="text-xs text-yellow-700 mt-0.5">
            Integrasi Gemini melalui backend Express.js belum tersedia. Respons di bawah adalah <strong>simulasi demo</strong> dan berlabel jelas. Jangan gunakan sebagai saran pertanian atau keuangan yang akurat.
          </p>
        </div>
      </div>

      {/* Suggested questions */}
      <SectionCard title="Pertanyaan yang disarankan">
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_QUESTIONS.map((q) => (
            <button
              key={q}
              onClick={() => handleSend(q)}
              className="text-sm font-semibold bg-[--primary-soft] text-[--primary-ink] px-3 py-1.5 rounded-full hover:bg-[--primary] hover:text-white transition-all"
            >
              {q}
            </button>
          ))}
        </div>
      </SectionCard>

      {/* Chat area */}
      <div className="bg-[--surface] border border-[--border] rounded-2xl overflow-hidden flex flex-col" style={{ minHeight: '360px' }}>
        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-48 gap-3 text-center">
              <div className="w-12 h-12 rounded-2xl bg-[--primary-soft] flex items-center justify-center">
                <Bot size={24} className="text-[--primary]" />
              </div>
              <div>
                <p className="font-bold text-[--text]">Tanyakan apa saja tentang musim tanam Anda</p>
                <p className="text-sm text-[--text-muted]">Pilih pertanyaan di atas atau ketik di bawah.</p>
              </div>
            </div>
          ) : (
            messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full bg-[--primary-soft] flex items-center justify-center flex-shrink-0">
                    <Bot size={16} className="text-[--primary]" />
                  </div>
                )}
                <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-sm ${
                  msg.role === 'user'
                    ? 'bg-[--primary] text-white rounded-tr-sm'
                    : 'bg-[--surface-muted] text-[--text] rounded-tl-sm'
                }`}>
                  {msg.isDemo && (
                    <p className="text-xs font-bold text-[--warning] mb-1">[SIMULASI DEMO]</p>
                  )}
                  {msg.content}
                </div>
                {msg.role === 'user' && (
                  <div className="w-8 h-8 rounded-full bg-[--primary] flex items-center justify-center flex-shrink-0">
                    <Sprout size={16} className="text-white" />
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {/* Input */}
        <div className="border-t border-[--border] p-3 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Ketik pertanyaan Anda..."
            className="flex-1 rounded-xl border border-[--border] px-4 py-2.5 text-sm text-[--text] focus:outline-none focus:border-[--primary] focus:ring-2 focus:ring-[--primary]/10 transition bg-[--surface]"
          />
          <AppButton
            size="md"
            leftIcon={<SendHorizonal size={16} />}
            onClick={() => handleSend()}
            disabled={!input.trim()}
          >
            Kirim
          </AppButton>
        </div>
      </div>

      <p className="text-xs text-[--text-muted] text-center">
        Semua respons adalah simulasi demo. Bukan saran keuangan atau pertanian yang terverifikasi.
      </p>
    </div>
  );
}
