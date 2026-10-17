// Pemanas cache terjemahan: memindai teks antarmuka di agrochie-web/src, lalu menerjemahkan yang belum ada di cache
// lewat service terjemahan yang sudah ada (Qwen via Ollama). Normalisasi dan penyaring DIIMPOR dari logic.ts
// milik AutoTranslate (sumber tunggal, tanpa duplikasi) agar kunci cache cocok persis.
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { env } from "../src/config/env.js";
import {
  TranslationCache, createTranslateService, loadGlossary, DEFAULT_CACHE_PATH, TARGETS, REJECT_REASONS,
} from "../src/services/translate.service.js";
import {
  normalizeKey, shouldSkipText, containsProtected, TRANSLATABLE_ATTRS,
} from "../../agrochie-web/src/features/i18n-auto/logic.ts";

export { normalizeKey, shouldSkipText, containsProtected };

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const DEFAULT_WEB_ROOT = path.resolve(HERE, "../../agrochie-web");
export const DEFAULT_REPORT_PATH = path.resolve(HERE, "../data/warm-report.md");

/* ───────── TypeScript compiler API (dari agrochie-web, tanpa paket baru) ───────── */

export function loadTypescript(webRoot = DEFAULT_WEB_ROOT) {
  try {
    return createRequire(path.join(webRoot, "package.json"))("typescript");
  } catch {
    throw new Error(`Paket typescript tidak ditemukan di ${webRoot}. Jalankan "npm install" di agrochie-web dulu.`);
  }
}

/* ───────── pemindaian ───────── */

const TEST_FILE = /(\.test\.|\.spec\.|[\\/]__tests__[\\/])/;
const IGNORED_DIRS = new Set(["node_modules", ".next"]);

function listSourceFiles(srcDir) {
  const out = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (!IGNORED_DIRS.has(e.name)) walk(full); continue; }
      if (!/\.tsx?$/.test(e.name) || e.name.endsWith(".d.ts") || TEST_FILE.test(full)) continue;
      if (path.relative(srcDir, full).split(path.sep).join("/") === "i18n/translations.ts") continue;
      out.push(full);
    }
  };
  walk(srcDir);
  return out.sort();
}

/** Kandidat sah untuk dikirim: lolos penyaring AutoTranslate untuk bahasa target (daftar akun/lahan tidak ada saat build). */
export const isCandidate = (key, target) => !shouldSkipText(key, target) && !containsProtected(key, []);

/**
 * Memindai srcDir. Mengembalikan { occurrences: [{key,file,line}], skippedByFile: {file: jumlah} }.
 * Teks di dalam elemen data-no-translate / translate="no" dihitung ke skippedByFile; teks di <option> tanpa value dibuang.
 */
export function scanSource(ts, srcDir) {
  const occurrences = [];
  const skippedByFile = {};
  const attrNames = new Set(TRANSLATABLE_ATTRS);

  for (const file of listSourceFiles(srcDir)) {
    const rel = path.relative(srcDir, file).split(path.sep).join("/");
    const sf = ts.createSourceFile(file, fs.readFileSync(file, "utf8"), ts.ScriptTarget.Latest, true,
      file.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);

    const lineOf = (pos) => sf.getLineAndCharacterOfPosition(pos).line + 1;
    const emit = (ctx, text, pos) => {
      const key = normalizeKey(text);
      if (!key) return;
      if (ctx.noTr) { if (isCandidate(key, "en")) skippedByFile[rel] = (skippedByFile[rel] ?? 0) + 1; return; }
      if (ctx.option) return;
      occurrences.push({ key, file: rel, line: lineOf(pos) });
    };

    const unwrap = (e) => {
      while (e && (ts.isParenthesizedExpression(e) || ts.isAsExpression(e) || ts.isNonNullExpression(e))) e = e.expression;
      return e;
    };
    const strings = (expr) => {
      const e = unwrap(expr);
      if (!e) return [];
      if (ts.isStringLiteral(e) || ts.isNoSubstitutionTemplateLiteral(e)) return [e];
      if (ts.isConditionalExpression(e)) return [...strings(e.whenTrue), ...strings(e.whenFalse)];
      return [];
    };
    const attrOf = (attrs, name) => attrs.properties.find((p) => ts.isJsxAttribute(p) && p.name.getText(sf) === name);
    const attrValue = (a) => {
      const i = a.initializer;
      if (!i) return null;
      if (ts.isStringLiteral(i)) return i.text;
      if (ts.isJsxExpression(i)) { const s = strings(i.expression); return s.length === 1 ? s[0].text : null; }
      return null;
    };
    const childCtx = (tagName, attrs, ctx) => {
      const tr = attrOf(attrs, "translate");
      const noTr = ctx.noTr || !!attrOf(attrs, "data-no-translate") || (!!tr && attrValue(tr) === "no");
      const option = ctx.option || (tagName === "option" && !attrOf(attrs, "value"));
      return { noTr, option };
    };

    const visit = (node, ctx) => {
      if (ts.isJsxElement(node)) {
        const open = node.openingElement;
        const inner = childCtx(open.tagName.getText(sf), open.attributes, ctx);
        // Atribut milik elemen ini ikut konteks noTr elemennya sendiri, tapi bukan konteks option.
        visit(open.attributes, { noTr: inner.noTr, option: ctx.option });
        for (const c of node.children) visit(c, inner);
        return;
      }
      if (ts.isJsxSelfClosingElement(node)) {
        const inner = childCtx(node.tagName.getText(sf), node.attributes, ctx);
        visit(node.attributes, { noTr: inner.noTr, option: ctx.option });
        return;
      }
      if (ts.isJsxText(node)) {
        const offset = node.text.search(/\S/);
        if (offset >= 0) emit(ctx, node.text, node.pos + offset);
        return;
      }
      if (ts.isJsxAttribute(node)) {
        if (attrNames.has(node.name.getText(sf)) && node.initializer) {
          const i = node.initializer;
          const lits = ts.isStringLiteral(i) ? [i] : ts.isJsxExpression(i) ? strings(i.expression) : [];
          for (const l of lits) emit(ctx, l.text, l.getStart(sf));
        }
        return;
      }
      if (ts.isJsxExpression(node) && node.parent && (ts.isJsxElement(node.parent) || ts.isJsxFragment(node.parent))) {
        for (const l of strings(node.expression)) emit(ctx, l.text, l.getStart(sf));
      }
      ts.forEachChild(node, (c) => visit(c, ctx));
    };
    visit(sf, { noTr: false, option: false });
  }
  return { occurrences, skippedByFile };
}

/** Teks unik per target (sudah disaring) dengan lokasinya, urut kemunculan. Map<key, ["file:baris", ...]>. */
export function textsForTarget(occurrences, target) {
  const map = new Map();
  for (const o of occurrences) {
    if (!isCandidate(o.key, target)) continue;
    if (!map.has(o.key)) map.set(o.key, []);
    map.get(o.key).push(`${o.file}:${o.line}`);
  }
  return map;
}

/** Teks yang terlihat seperti data pengguna (email, deretan angka panjang, nama orang) untuk dicek manual. */
export function userDataWarnings(occurrences) {
  const seen = new Map();
  for (const o of occurrences) {
    if (seen.has(o.key)) continue;
    let why = null;
    if (o.key.includes("@")) why = "memuat @ (email?)";
    else if (/\d{8,}/.test(o.key.replace(/[\s.-]/g, ""))) why = "deretan angka panjang (nomor HP?)";
    else if (/^\p{Lu}\p{Ll}+( \p{Lu}\p{Ll}+){1,2}$/u.test(o.key)) why = "pola nama orang (2-3 kata kapital)";
    if (why && isCandidate(o.key, "en")) seen.set(o.key, { text: o.key, why, loc: `${o.file}:${o.line}` });
  }
  return [...seen.values()];
}

/* ───────── CLI ───────── */

export function parseArgs(argv) {
  const o = { dryRun: false, targets: [...TARGETS], limit: Infinity, batch: 25 };
  const val = (i, name) => {
    if (i + 1 >= argv.length) throw new Error(`Opsi ${name} butuh nilai.`);
    return argv[i + 1];
  };
  const posInt = (v, name) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 1) throw new Error(`${name} harus bilangan bulat >= 1.`);
    return n;
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--dry-run") o.dryRun = true;
    else if (a === "--target") o.targets = val(i++, a).split(",").map((s) => s.trim()).filter(Boolean);
    else if (a === "--limit") o.limit = posInt(val(i++, a), a);
    else if (a === "--batch") o.batch = posInt(val(i++, a), a);
    else if (a === "--model") o.model = val(i++, a);
    else if (a === "--host") o.host = val(i++, a).replace(/\/+$/, "");
    else if (a === "--cache") o.cachePath = path.resolve(val(i++, a));
    else if (a === "--src") o.srcDir = path.resolve(val(i++, a));
    else if (a === "--report") o.reportPath = path.resolve(val(i++, a));
    else throw new Error(`Opsi tidak dikenal: ${a}`);
  }
  for (const t of o.targets) if (!TARGETS.includes(t)) throw new Error(`Target tidak didukung: ${t} (pilihan: ${TARGETS.join(", ")}).`);
  if (!o.targets.length) throw new Error("--target kosong.");
  return o;
}

async function defaultCheckOllama(host) {
  const res = await fetch(`${host}/api/tags`, { signal: AbortSignal.timeout(5000) });
  if (!res.ok) throw new Error(`status ${res.status}`);
}

/* ───────── laporan ───────── */

function buildReport({ opts, stats, failures, skippedByFile, warnings, aborted }) {
  const L = [];
  L.push("# Laporan pemanas cache terjemahan", "");
  L.push(`Model: ${opts.model}`, `Cache: ${opts.cachePath}`, "");
  if (aborted) L.push(`> BERHENTI DINI: ${aborted}`, "");
  L.push("## Ringkasan per bahasa", "", "| Bahasa | Ditemukan | Sudah di cache | Baru diterjemahkan | Gagal | Belum diproses |", "|---|---|---|---|---|---|");
  for (const [t, s] of Object.entries(stats)) L.push(`| ${t} | ${s.found} | ${s.cached} | ${s.translated} | ${s.failed} | ${s.pending} |`);
  L.push("", "## Teks gagal", "");
  if (!failures.length) L.push("Tidak ada.");
  for (const f of failures) L.push(`- [${f.target}] ${JSON.stringify(f.text)} — ${f.reason} — ${f.locs.slice(0, 3).join(", ")}`);
  L.push("", "## Dilewati karena data-no-translate / translate=\"no\" (per file)", "");
  const sk = Object.entries(skippedByFile).sort();
  if (!sk.length) L.push("Tidak ada.");
  for (const [f, n] of sk) L.push(`- ${f}: ${n}`);
  L.push("", "## Peringatan: mirip data pengguna (periksa manual)", "");
  if (!warnings.length) L.push("Tidak ada.");
  for (const w of warnings) L.push(`- ${JSON.stringify(w.text)} — ${w.why} — ${w.loc}`);
  return L.join("\n") + "\n";
}

/* ───────── proses utama ───────── */

/**
 * deps (untuk uji): providers { ollama }, checkOllama(host), glossary, log, logError, ts.
 * Mengembalikan { exitCode, stats, failures, ... }.
 */
export async function runWarm(options, deps = {}) {
  const log = deps.log ?? console.log;
  const logError = deps.logError ?? console.error;
  const opts = {
    dryRun: false, targets: [...TARGETS], limit: Infinity, batch: 25,
    srcDir: path.join(DEFAULT_WEB_ROOT, "src"), cachePath: DEFAULT_CACHE_PATH, reportPath: DEFAULT_REPORT_PATH,
    ...options,
  };
  opts.host ??= env.ollamaHost;
  opts.model ??= env.ollamaModel;

  const ts = deps.ts ?? loadTypescript();
  const { occurrences, skippedByFile } = scanSource(ts, opts.srcDir);
  const warnings = userDataWarnings(occurrences);
  const cache = new TranslationCache(opts.cachePath);

  const plan = {};
  const stats = {};
  for (const t of opts.targets) {
    const texts = textsForTarget(occurrences, t);
    const missingAll = [...texts.keys()].filter((k) => cache.get(t, k) === undefined);
    plan[t] = { texts, missing: missingAll.slice(0, opts.limit) };
    stats[t] = { found: texts.size, cached: texts.size - missingAll.length, translated: 0, failed: 0, pending: missingAll.length };
  }

  if (opts.dryRun) {
    for (const t of opts.targets) log(`[dry-run] ${t}: ditemukan ${stats[t].found}, sudah di cache ${stats[t].cached}, belum diterjemahkan ${stats[t].pending}`);
    log(`[dry-run] tidak ada cache atau laporan yang ditulis. Peringatan mirip data pengguna: ${warnings.length}.`);
    return { exitCode: 0, stats, failures: [], warnings, skippedByFile };
  }

  if (opts.targets.some((t) => plan[t].missing.length)) {
    try {
      await (deps.checkOllama ?? defaultCheckOllama)(opts.host);
    } catch (e) {
      const msg = `Ollama tidak bisa dihubungi di ${opts.host} (${e?.name ?? "error"}). Pastikan Ollama berjalan dan model "${opts.model}" sudah diunduh. Cache tidak diubah.`;
      logError(msg);
      return { exitCode: 2, stats, failures: [], error: msg };
    }
  }

  const cfg = { ...env, translateProvider: "ollama", translateFallbackProvider: "", ollamaHost: opts.host, ollamaModel: opts.model };
  let errs = [];
  const rejects = new Map(); // [REVISI] "target\u0000teks" -> kode alasan dari validasi service
  const svc = createTranslateService({
    cache, glossary: deps.glossary ?? loadGlossary(), cfg, chunkSize: opts.batch,
    onReject: (tg, text, why) => rejects.set(`${tg}\u0000${text}`, why),
    ...(deps.providers ? { providers: deps.providers } : {}),
    logError: (...a) => errs.push(String(a[a.length - 1] ?? "error")),
  });

  const failures = [];
  let aborted = null;
  outer:
  for (const t of opts.targets) {
    const { texts, missing } = plan[t];
    let down = 0;
    for (let i = 0; i < missing.length; i += opts.batch) {
      const batch = missing.slice(i, i + opts.batch);
      errs = [];
      await svc.translate(t, batch);
      let ok = 0;
      for (const k of batch) {
        stats[t].pending--;
        if (cache.get(t, k) !== undefined) { ok++; stats[t].translated++; continue; }
        stats[t].failed++;
        failures.push({
          target: t, text: k, locs: texts.get(k),
          reason: errs.length ? `penerjemah gagal (${errs[0]})` : `hasil model tidak valid: ${REJECT_REASONS[rejects.get(`${t}\u0000${k}`)] ?? "tidak diketahui"}`,
        });
      }
      await cache.flush(); // simpan tiap batch agar pekerjaan tidak hilang bila dihentikan
      log(`[${t}] batch ${Math.floor(i / opts.batch) + 1}: ${ok}/${batch.length} tersimpan`);
      down = errs.length && !ok ? down + 1 : 0;
      if (down >= 2) {
        aborted = `Ollama berhenti merespons pada bahasa ${t}; cache yang sudah tersimpan aman. Jalankan ulang untuk melanjutkan.`;
        break outer;
      }
    }
  }

  const report = buildReport({ opts, stats, failures, skippedByFile, warnings, aborted });
  fs.mkdirSync(path.dirname(opts.reportPath), { recursive: true });
  fs.writeFileSync(opts.reportPath, report, "utf8");
  for (const t of opts.targets) log(`[${t}] ditemukan ${stats[t].found}, di cache ${stats[t].cached}, baru ${stats[t].translated}, gagal ${stats[t].failed}, belum diproses ${stats[t].pending}`);
  log(`Laporan: ${opts.reportPath}`);
  if (aborted) logError(aborted);
  return { exitCode: aborted ? 2 : 0, stats, failures, warnings, skippedByFile, report };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = await runWarm(parseArgs(process.argv.slice(2)));
    process.exitCode = result.exitCode;
  } catch (e) {
    console.error(`Gagal: ${e.message}`);
    process.exitCode = 1;
  }
}
