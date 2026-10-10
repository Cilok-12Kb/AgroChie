import "dotenv/config";

const required = (name) => {
  const v = process.env[name];
  if (!v) throw new Error(`${name} belum diisi. Salin .env.example menjadi .env lalu isi nilainya.`);
  return v;
};

export const env = {
  port: Number(process.env.PORT ?? 3000),
  databaseUrl: required("DATABASE_URL"),

  // engine Python (bagian 12). Kunci diperiksa saat dipakai, bukan saat server menyala.
  engineUrl: process.env.ENGINE_URL ?? "http://127.0.0.1:8000",
  engineKey: process.env.ENGINE_INTERNAL_KEY ?? "",

  // Gemini (bagian 14). Nama model bisa diganti lewat .env tanpa mengubah kode.
  geminiKey: process.env.GEMINI_API_KEY ?? "",
  geminiModel: process.env.GEMINI_MODEL ?? "gemini-3.5-flash",
  geminiEmbedModel: process.env.GEMINI_EMBED_MODEL ?? "gemini-embedding-001",
  embedDims: Number(process.env.EMBED_DIMS ?? 768),
  ragMinScore: Number(process.env.RAG_MIN_SCORE ?? 0.5),
};

/** Penanda model embedding. Vektor dari model/dimensi berbeda tidak boleh dibandingkan. */
export const embedTag = () => `${env.geminiEmbedModel}:${env.embedDims}`;