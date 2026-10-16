import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { env } from "../config/env.js";
import { generateStructured } from "./llm.service.js";

// [REVISI] Terjemahan otomatis antarmuka (ID -> EN / ZH). Cache permanen di file JSON, penerjemah ollama/gemini.
// Aturan log: HANYA jenis galat, tidak pernah isi teks (bisa memuat data pengguna).

const DATA_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../data");
export const DEFAULT_CACHE_PATH = path.join(DATA_DIR, "translation-cache.json");
export const DEFAULT_GLOSSARY_PATH = path.join(DATA_DIR, "glossary.json");

export const TARGETS = ["en", "zh"];
export const LIMITS = { maxTexts: 50, maxTextChars: 500, maxTotalChars: 10_000 };
const PROVIDER_CHUNK = 20; // teks per panggilan model, agar jawaban JSON tetap pendek
const PROTECTED = /AgroChie|Google|Rp/g;
const TARGET_NAME = { en: "English", zh: "简体中文 (Simplified Chinese)" };

/* ───────── glosarium ───────── */

/** Membaca glosarium { istilah: { en, zh } }. Berkas hilang/rusak = glosarium kosong. */
export function loadGlossary(file = DEFAULT_GLOSSARY_PATH) {
  try {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"));
    return raw && typeof raw === "object" && !Array.isArray(raw) ? raw : {};
  } catch {
    return {};
  }
}

/* ───────── cache berkas ───────── */

/** Cache { en: {id: hasil}, zh: {...} } di memori, ditulis atomik (berkas sementara lalu rename) dengan debounce. */
export class TranslationCache {
  constructor(file, { debounceMs = 1500 } = {}) {
    this.file = file;
    this.debounceMs = debounceMs;
    this.maps = Object.fromEntries(TARGETS.map((t) => [t, new Map()]));
    this.timer = null;
    this.writing = Promise.resolve();
    this.load();
  }

  load() {
    try {
      const raw = JSON.parse(fs.readFileSync(this.file, "utf8"));
      for (const t of TARGETS) {
        for (const [k, v] of Object.entries(raw?.[t] ?? {})) if (typeof v === "string" && v) this.maps[t].set(k, v);
      }
    } catch {
      /* belum ada / rusak: mulai kosong */
    }
  }

  get(target, text) {
    return this.maps[target].get(text);
  }

  set(target, text, value) {
    this.maps[target].set(text, value);
    this.schedule();
  }

  schedule() {
    if (this.timer) return;
    this.timer = setTimeout(() => {
      this.timer = null;
      this.flush().catch((e) => console.error("[translate] gagal menulis cache:", e?.code ?? e?.name ?? "error"));
    }, this.debounceMs);
    this.timer.unref?.();
  }

  /** Tulis ulang seluruh cache secara atomik. Penulisan diserialkan agar tidak saling timpa. */
  flush() {
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    const data = JSON.stringify(Object.fromEntries(TARGETS.map((t) => [t, Object.fromEntries(this.maps[t])])), null, 2) + "\n";
    const run = async () => {
      const tmp = `${this.file}.${process.pid}.tmp`;
      await fs.promises.mkdir(path.dirname(this.file), { recursive: true });
      await fs.promises.writeFile(tmp, data, "utf8");
      await fs.promises.rename(tmp, this.file);
    };
    this.writing = this.writing.then(run, run);
    return this.writing;
  }
}

/* ───────── prompt & parsing ───────── */

export function buildSystemPrompt(target, glossary) {
  const lines = Object.entries(glossary)
    .filter(([, v]) => v && typeof v[target] === "string")
    .map(([id, v]) => `- ${id} => ${v[target]}`);
  return [
    `Terjemahkan NILAI objek JSON dari Bahasa Indonesia ke ${TARGET_NAME[target]}.`,
    "Gaya: singkat, jelas, dan ramah untuk petani.",
    "Pertahankan placeholder (mis. {nama}, %s) dan semua angka apa adanya.",
    'Jangan terjemahkan "AgroChie", "Google", dan "Rp".',
    "Kunci JSON harus sama persis dengan masukan; ubah hanya nilainya. Keluarkan HANYA satu objek JSON, tanpa penjelasan.",
    lines.length ? `Glosarium (wajib diikuti):\n${lines.join("\n")}` : "",
  ].filter(Boolean).join("\n");
}

/** Ambil objek JSON dari jawaban model: abaikan <think>…</think> dan pagar kode. Mengembalikan null bila tidak valid. */
export function parseModelJson(text) {
  if (typeof text !== "string") return null;
  let s = text.replace(/<think>[\s\S]*?<\/think>/gi, "").trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  if (fence) s = fence[1].trim();
  try {
    const obj = JSON.parse(s);
    return obj && typeof obj === "object" && !Array.isArray(obj) ? obj : null;
  } catch {
    return null;
  }
}

/* ───────── validasi hasil ───────── */

const numbersIn = (s) => s.match(/\d+/g) ?? [];

/** Hasil sah: tidak kosong, semua angka sumber ada, dan untuk zh memuat aksara Han bila sumber berisi kata. */
export function isValidTranslation(source, result, target) {
  if (typeof result !== "string" || !result.trim()) return false;
  for (const n of numbersIn(source)) if (!result.includes(n)) return false;
  if (target === "zh") {
    const hasWords = /\p{L}/u.test(source.replace(PROTECTED, ""));
    if (hasWords && !/\p{Script=Han}/u.test(result)) return false;
  }
  return true;
}

/* ───────── penerjemah (provider) ───────── */

async function ollamaChat({ system, user }, cfg) {
  const res = await fetch(`${cfg.ollamaHost}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: cfg.ollamaModel,
      stream: false,
      format: "json",
      think: false,
      options: { temperature: 0.1 },
      messages: [{ role: "system", content: system }, { role: "user", content: user }],
    }),
    signal: AbortSignal.timeout(cfg.ollamaTimeoutMs ?? 120_000),
  });
  if (!res.ok) throw Object.assign(new Error("ollama"), { name: `HttpStatus${res.status}` });
  const body = await res.json();
  return body?.message?.content ?? "";
}

/** Klien Gemini yang sudah ada (generateStructured di llm.service.js); tanpa klien baru. */
async function geminiChat({ system, user }) {
  return generateStructured({ system, userText: user, temperature: 0.1 });
}

const DEFAULT_PROVIDERS = { ollama: ollamaChat, gemini: geminiChat };

/* ───────── layanan ───────── */

/**
 * deps (untuk uji): cache, glossary, providers { nama: async ({system,user}, cfg) => teks JSON }, cfg, logError.
 * translate(target, texts) -> { teksAsli: hasil }; teks gagal/tidak valid dikembalikan apa adanya.
 */
export function createTranslateService({ cache, glossary = {}, providers = DEFAULT_PROVIDERS, cfg = env, logError = console.error } = {}) {
  const chain = [cfg.translateProvider, cfg.translateFallbackProvider]
    .filter((p, i, a) => p && p !== "none" && providers[p] && a.indexOf(p) === i);

  async function askProvider(name, target, batch) {
    const system = buildSystemPrompt(target, glossary);
    const user = JSON.stringify(Object.fromEntries(batch.map((t) => [t, t])));
    const raw = await providers[name]({ system, user }, cfg);
    return parseModelJson(raw) ?? {};
  }

  async function translate(target, texts) {
    const out = {};
    let missing = [];
    for (const t of new Set(texts)) {
      const hit = cache.get(target, t);
      if (hit !== undefined) out[t] = hit;
      else if (!t.trim()) out[t] = t;
      else missing.push(t);
    }
    for (const name of chain) {
      if (!missing.length) break;
      const still = [];
      for (let i = 0; i < missing.length; i += PROVIDER_CHUNK) {
        const batch = missing.slice(i, i + PROVIDER_CHUNK);
        let parsed;
        try {
          parsed = await askProvider(name, target, batch);
        } catch (e) {
          logError(`[translate] penerjemah ${name} gagal:`, e?.name ?? "error"); // jenis galat saja, tanpa teks
          still.push(...batch);
          continue;
        }
        for (const t of batch) {
          const r = Object.hasOwn(parsed, t) ? parsed[t] : undefined;
          if (isValidTranslation(t, r, target)) {
            const value = r.trim();
            cache.set(target, t, value);
            out[t] = value;
          } else still.push(t);
        }
      }
      missing = still;
    }
    for (const t of missing) out[t] = t; // gagal/tidak valid: teks asli, tidak disimpan ke cache
    return out;
  }

  return { translate };
}

let defaultService;
/** Layanan bawaan: cache dan glosarium dibaca sekali saat pertama dibuat (rute dibuat saat start). */
export function getTranslateService() {
  if (!defaultService) {
    const cache = new TranslationCache(DEFAULT_CACHE_PATH);
    process.once("beforeExit", () => { cache.flush().catch(() => {}); });
    defaultService = createTranslateService({ cache, glossary: loadGlossary() });
  }
  return defaultService;
}

