import "dotenv/config";

import { buildEnv } from "./env-parse.js";

// [REVISI] bagian 17: isi objek dipindah ke buildEnv (env-parse.js) agar bisa diuji; bentuk `env` tidak berubah
// kecuali tambahan kunci sesi.
export const env = buildEnv(process.env);

/** Penanda model embedding. Vektor dari model/dimensi berbeda tidak boleh dibandingkan. */
export const embedTag = () => `${env.geminiEmbedModel}:${env.embedDims}`;