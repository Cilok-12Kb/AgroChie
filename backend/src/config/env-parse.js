/** [REVISI] Pola id model Gemini: huruf kecil, angka, titik, tanda hubung. Mengembalikan daftar peringatan (kosong = baik). */
export function modelNameWarnings(label, name) {
  if (!name) return [];
  const w = [];
  if (/[A-Z]/.test(name)) w.push("mengandung huruf kapital");
  if (/\s/.test(name)) w.push("mengandung spasi");
  if (!/^[a-z0-9][a-z0-9.-]*$/.test(name)) w.push("tidak cocok pola id model (huruf kecil, angka, titik, tanda hubung)");
  return w.length ? [`[config] PERINGATAN: ${label}="${name}" ${w.join(", ")}. Panggilan Gemini kemungkinan gagal (HTTP 400). Periksa backend/.env.`] : [];
}

/**
 * Membentuk objek konfigurasi dari sebuah sumber (mis. process.env).
 * Dipisah dari env.js agar bisa diuji tanpa membaca berkas .env.
 */
export function buildEnv(src) {
  const required = (name) => {
    const v = src[name];
    if (!v) throw new Error(`${name} belum diisi. Salin .env.example menjadi .env lalu isi nilainya.`);
    return v;
  };

  const positive = (name, fallback) => {
    const n = Number(src[name] ?? fallback);
    if (!Number.isFinite(n) || n <= 0) throw new Error(`${name} harus berupa angka lebih dari 0.`);
    return n;
  };

  const jwtSecret = required("JWT_SECRET");
  if (jwtSecret.length < 32) throw new Error("JWT_SECRET minimal 32 karakter.");

  // [REVISI] bagian 17.8: TRUST_PROXY = kosong/false (bawaan), true, atau jumlah hop (bilangan bulat > 0)
  const parseTrustProxy = (v) => {
    if (v === undefined || v === "" || v === "false") return false;
    if (v === "true") return true;
    if (/^[1-9]\d*$/.test(v)) return Number(v);
    throw new Error("TRUST_PROXY harus kosong, true, false, atau bilangan bulat lebih dari 0.");
  };

  // CORS dengan credentials tidak boleh memakai "*"; satu alamat http(s) tanpa path.
  const frontendOrigin = (src.FRONTEND_ORIGIN ?? "http://localhost:3001").replace(/\/+$/, "");
  let originOk = false;
  try {
    const u = new URL(frontendOrigin);
    originOk = ["http:", "https:"].includes(u.protocol) && u.origin === frontendOrigin;
  } catch {
    /* tidak valid */
  }
  if (!originOk) throw new Error("FRONTEND_ORIGIN harus berupa satu alamat http(s) seperti http://localhost:3001 (bukan *).");

  return {
    port: Number(src.PORT ?? 3000),
    nodeEnv: src.NODE_ENV ?? "development",
    databaseUrl: required("DATABASE_URL"),

    // engine Python (bagian 12). Kunci diperiksa saat dipakai, bukan saat server menyala.
    engineUrl: src.ENGINE_URL ?? "http://127.0.0.1:8000",
    engineKey: src.ENGINE_INTERNAL_KEY ?? "",

    // Gemini (bagian 14). Nama model bisa diganti lewat .env tanpa mengubah kode.
    geminiKey: src.GEMINI_API_KEY ?? "",
    geminiModel: src.GEMINI_MODEL ?? "gemini-3.5-flash",
    // [REVISI] retry hemat (hanya untuk 503) dan model cadangan opsional (kosong = nonaktif; harus beda dari GEMINI_MODEL)
    geminiMaxRetries: (() => {
      const n = Number(src.GEMINI_MAX_RETRIES ?? 1);
      if (!Number.isInteger(n) || n < 0) throw new Error("GEMINI_MAX_RETRIES harus bilangan bulat 0 atau lebih.");
      return n;
    })(),
    geminiRetryBaseMs: (() => {
      const n = Number(src.GEMINI_RETRY_BASE_MS ?? 2000);
      if (!Number.isFinite(n) || n < 0) throw new Error("GEMINI_RETRY_BASE_MS harus angka 0 atau lebih.");
      return n;
    })(),
    geminiFallbackModel: (() => {
      const f = (src.GEMINI_FALLBACK_MODEL ?? "").trim();
      if (f && f === (src.GEMINI_MODEL ?? "gemini-3.5-flash")) throw new Error("GEMINI_FALLBACK_MODEL harus berbeda dari GEMINI_MODEL (atau kosongkan).");
      return f;
    })(),
    geminiEmbedModel: src.GEMINI_EMBED_MODEL ?? "gemini-embedding-001",
    embedDims: Number(src.EMBED_DIMS ?? 768),
    ragMinScore: Number(src.RAG_MIN_SCORE ?? 0.5),

    // [REVISI] deteksi tanaman: foto disimpan di luar folder publik; batas ukuran dalam MB
    uploadDir: src.AGROCHIE_UPLOAD_DIR || "./uploads",
    detectionMaxBytes: Math.round(positive("DETECTION_MAX_MB", 5) * 1024 * 1024),
    // [REVISI] deteksi tanaman (sub-langkah 2): batas waktu Gemini, pilihan provider deteksi, ambang keyakinan 0..1
    geminiTimeoutMs: positive("GEMINI_TIMEOUT_MS", 30000),
    // [REVISI] provider utama sekarang "engine" (model CNN sendiri); fallback kosong = nonaktif; margin minimal skor #1 - #2
    detectionProvider: (src.DETECTION_PROVIDER || "engine").trim().toLowerCase(),
    detectionFallbackProvider: (src.DETECTION_FALLBACK_PROVIDER || "").trim().toLowerCase(),
    detectionMinMargin: (() => {
      const n = Number(src.DETECTION_MIN_MARGIN ?? 0.15);
      if (!Number.isFinite(n) || n < 0 || n > 1) throw new Error("DETECTION_MIN_MARGIN harus angka 0 sampai 1.");
      return n;
    })(),
    detectionMinConfidence: (() => {
      const n = Number(src.DETECTION_MIN_CONFIDENCE ?? 0.5);
      if (!Number.isFinite(n) || n < 0 || n > 1) throw new Error("DETECTION_MIN_CONFIDENCE harus angka 0 sampai 1.");
      return n;
    })(),

    // [REVISI] bagian 17: sesi JWT di cookie httpOnly
    jwtSecret,
    jwtTtlDays: positive("JWT_TTL_DAYS", 7),
    guestTtlHours: positive("GUEST_TTL_HOURS", 24),
    cookieName: src.COOKIE_NAME ?? "agro_session",
    frontendOrigin,
    trustProxy: parseTrustProxy(src.TRUST_PROXY),

    // [REVISI] auth email + Google: semua opsional (lazy). Server tetap menyala tanpa SMTP/Google;
    // fitur terkait memeriksa kelengkapan lewat mailConfigured / googleConfigured saat dipakai.
    smtpHost: (src.SMTP_HOST ?? "").trim(),
    smtpPort: (() => {
      const n = Number(src.SMTP_PORT || 587);
      if (!Number.isInteger(n) || n < 1 || n > 65535) throw new Error("SMTP_PORT harus bilangan bulat 1 sampai 65535.");
      return n;
    })(),
    smtpSecure: (() => {
      const v = (src.SMTP_SECURE ?? "").trim().toLowerCase();
      if (v === "" || v === "false") return false;
      if (v === "true") return true;
      throw new Error("SMTP_SECURE harus kosong, true, atau false.");
    })(),
    smtpUser: (src.SMTP_USER ?? "").trim(),
    smtpPass: src.SMTP_PASS ?? "",
    mailFrom: (src.MAIL_FROM ?? "").trim(),
    appBaseUrl: (() => {
      const raw = (src.APP_BASE_URL || frontendOrigin).replace(/\/+$/, "");
      try {
        const u = new URL(raw);
        if (!["http:", "https:"].includes(u.protocol)) throw new Error("protokol");
        return raw;
      } catch {
        throw new Error("APP_BASE_URL harus berupa alamat http(s) seperti http://localhost:3001.");
      }
    })(),
    googleClientId: (src.GOOGLE_CLIENT_ID ?? "").trim(),
    passwordResetTtlMinutes: positive("PASSWORD_RESET_TTL_MINUTES", 30),
    emailVerifyTtlHours: positive("EMAIL_VERIFY_TTL_HOURS", 24),
    // SMTP dianggap siap bila host, pengirim (MAIL_FROM) terisi; user/pass boleh kosong (mis. relay lokal)
    mailConfigured: Boolean((src.SMTP_HOST ?? "").trim() && (src.MAIL_FROM ?? "").trim()),
    googleConfigured: Boolean((src.GOOGLE_CLIENT_ID ?? "").trim()),
  };
}
