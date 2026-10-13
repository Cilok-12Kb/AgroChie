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
    geminiEmbedModel: src.GEMINI_EMBED_MODEL ?? "gemini-embedding-001",
    embedDims: Number(src.EMBED_DIMS ?? 768),
    ragMinScore: Number(src.RAG_MIN_SCORE ?? 0.5),

    // [REVISI] deteksi tanaman: foto disimpan di luar folder publik; batas ukuran dalam MB
    uploadDir: src.AGROCHIE_UPLOAD_DIR || "./uploads",
    detectionMaxBytes: Math.round(positive("DETECTION_MAX_MB", 5) * 1024 * 1024),
    // [REVISI] deteksi tanaman (sub-langkah 2): batas waktu Gemini, pilihan provider deteksi, ambang keyakinan 0..1
    geminiTimeoutMs: positive("GEMINI_TIMEOUT_MS", 30000),
    detectionProvider: (src.DETECTION_PROVIDER || "gemini").trim().toLowerCase(),
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
  };
}
