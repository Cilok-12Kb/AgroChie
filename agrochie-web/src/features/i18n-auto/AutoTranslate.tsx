'use client';
/**
 * AutoTranslate — menerjemahkan teks antarmuka berbahasa Indonesia saat halaman tampil (runtime).
 * Aktif hanya bila bahasa aktif 'en' atau 'zh'. Hanya mengganti nodeValue / atribut (tanpa innerHTML).
 * Teks asli disimpan per node dan dikembalikan saat bahasa kembali ke 'id'.
 * Endpoint /api/translate publik, jadi sengaja TIDAK memakai request() yang punya penanganan 401 global.
 */
import { useEffect } from 'react';
import { useTranslation } from '@/i18n';
import {
  TRANSLATABLE_ATTRS, NO_TRANSLATE_SELECTOR, isSkippedTag, shouldSkipText, normalizeKey, rewrap,
  chunkBatches, cacheKey, storageKey, type TargetLang,
} from './logic';

type TextRec = { orig: string; applied: string };
type AttrRec = { el: Element; attr: string; orig: string; applied: string };
type Item = { raw: string; key: string; apply: (value: string) => void; current: () => string | null };

const DEBOUNCE_MS = 150;
const MAX_STORED = 4000; // batas entri localStorage per bahasa

export function AutoTranslate() {
  const { lang } = useTranslation();

  useEffect(() => {
    if (lang !== 'en' && lang !== 'zh') return;
    const target: TargetLang = lang;

    const memory = new Map<string, string>(); // cacheKey -> hasil (termasuk yang sama dengan sumber)
    const persisted: Record<string, string> = {}; // yang disimpan ke localStorage
    try {
      const raw = localStorage.getItem(storageKey(target));
      const parsed = raw ? JSON.parse(raw) : null;
      if (parsed && typeof parsed === 'object') {
        for (const [k, v] of Object.entries(parsed)) {
          if (typeof v === 'string') { persisted[k] = v; memory.set(cacheKey(target, k), v); }
        }
      }
    } catch { /* localStorage tidak tersedia / rusak: lanjut tanpa cache */ }

    const texts = new Map<Text, TextRec>(); // teks asli per text node
    const attrRecs = new WeakMap<Element, Record<string, AttrRec>>();
    const tracked = new Set<AttrRec>();
    let disposed = false;
    let running = false;
    let dirty = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const collect = (): Item[] => {
      const items: Item[] = [];
      for (const node of texts.keys()) if (!node.isConnected) texts.delete(node);
      for (const rec of tracked) if (!rec.el.isConnected) tracked.delete(rec);

      const addText = (node: Text) => {
        const value = node.nodeValue ?? '';
        let rec = texts.get(node);
        if (rec && value === rec.applied) return; // sudah diterjemahkan oleh kita
        if (!rec) { rec = { orig: value, applied: value }; texts.set(node, rec); } else { rec.orig = value; rec.applied = value; }
        const key = normalizeKey(value);
        if (shouldSkipText(key, target)) return;
        const r = rec;
        items.push({
          raw: value, key,
          current: () => node.nodeValue,
          apply: (out) => { const next = rewrap(value, out); node.nodeValue = next; r.applied = next; },
        });
      };

      const addAttr = (el: Element, attr: string) => {
        const value = el.getAttribute(attr);
        if (value == null) return;
        const byAttr = attrRecs.get(el) ?? {};
        let rec = byAttr[attr];
        if (rec && value === rec.applied) return;
        if (!rec) { rec = { el, attr, orig: value, applied: value }; byAttr[attr] = rec; attrRecs.set(el, byAttr); tracked.add(rec); } else { rec.orig = value; rec.applied = value; }
        const key = normalizeKey(value);
        if (shouldSkipText(key, target)) return;
        const r = rec;
        items.push({
          raw: value, key,
          current: () => el.getAttribute(attr),
          apply: (out) => { const next = rewrap(value, out); el.setAttribute(attr, next); r.applied = next; },
        });
      };

      const walk = (el: Element) => {
        if (el.matches(NO_TRANSLATE_SELECTOR)) return; // elemen + turunannya dilewati
        const isField = el.tagName === 'INPUT' || el.tagName === 'TEXTAREA';
        if (isSkippedTag(el.tagName) && !isField) return; // script, style, code, pre, noscript
        for (const a of TRANSLATABLE_ATTRS) addAttr(el, a); // placeholder/title/aria-label/alt (bukan value)
        if (isField) return; // nilai input/textarea tidak disentuh
        for (const child of Array.from(el.childNodes)) {
          if (child.nodeType === Node.TEXT_NODE) addText(child as Text);
          else if (child.nodeType === Node.ELEMENT_NODE) walk(child as Element);
        }
      };
      if (document.body) walk(document.body);
      return items;
    };

    // Ganti DOM tanpa memicu observer kita sendiri: putuskan dulu, terapkan, sambungkan lagi.
    const observer = new MutationObserver(() => schedule());
    const observe = () => observer.observe(document.body, {
      subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: [...TRANSLATABLE_ATTRS],
    });
    const applyAll = (items: Item[]) => {
      observer.disconnect();
      try {
        for (const it of items) {
          const out = memory.get(cacheKey(target, it.key));
          if (out !== undefined && out !== it.key && it.current() === it.raw) it.apply(out);
        }
      } finally {
        if (!disposed) observe();
      }
    };

    const save = () => {
      try {
        const entries = Object.entries(persisted);
        const trimmed = entries.length > MAX_STORED ? Object.fromEntries(entries.slice(-MAX_STORED)) : persisted;
        localStorage.setItem(storageKey(target), JSON.stringify(trimmed));
      } catch { /* kuota penuh / diblokir: abaikan */ }
    };

    const fetchBatch = async (batch: string[]) => {
      const res = await fetch('/api/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target, texts: batch }),
      });
      if (!res.ok) throw new Error(`status ${res.status}`);
      const data = (await res.json()) as { translations?: Record<string, string> };
      return data.translations ?? {};
    };

    const run = async () => {
      if (disposed) return;
      if (running) { dirty = true; return; }
      running = true;
      try {
        const items = collect();
        applyAll(items);
        const missing = [...new Set(items.filter((i) => !memory.has(cacheKey(target, i.key))).map((i) => i.key))];
        if (!missing.length) return;
        let changed = false;
        for (const batch of chunkBatches(missing)) {
          try {
            const got = await fetchBatch(batch);
            if (disposed) return;
            for (const k of batch) {
              const v = got[k];
              if (typeof v !== 'string' || !v) continue;
              memory.set(cacheKey(target, k), v);
              // Hasil sama dengan sumber = gagal/tidak perlu: tidak disimpan ke localStorage.
              if (v !== k) { persisted[k] = v; changed = true; }
            }
          } catch { /* jaringan gagal: biarkan teks asli, coba lagi pada perubahan DOM berikutnya */ }
        }
        if (changed) save();
        if (!disposed) applyAll(collect());
      } finally {
        running = false;
        if (dirty && !disposed) { dirty = false; schedule(); }
      }
    };

    function schedule() {
      if (disposed) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => { timer = null; void run(); }, DEBOUNCE_MS);
    }

    const restore = () => {
      for (const [node, rec] of texts) {
        if (node.nodeValue === rec.applied && rec.applied !== rec.orig) node.nodeValue = rec.orig;
      }
      for (const rec of tracked) {
        if (rec.el.getAttribute(rec.attr) === rec.applied && rec.applied !== rec.orig) rec.el.setAttribute(rec.attr, rec.orig);
      }
    };

    observe();
    schedule();

    return () => { // ganti bahasa / kembali ke 'id' / lepas komponen: kembalikan teks asli
      disposed = true;
      if (timer) clearTimeout(timer);
      observer.disconnect();
      restore();
    };
  }, [lang]);

  return null;
}

