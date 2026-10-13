import "dotenv/config";

import { buildEnv, modelNameWarnings } from "./env-parse.js";

// [REVISI] peringatan (bukan crash) bila nama model Gemini salah format
export const env = buildEnv(process.env);
for (const m of [...modelNameWarnings("GEMINI_MODEL", env.geminiModel), ...modelNameWarnings("GEMINI_FALLBACK_MODEL", env.geminiFallbackModel)]) console.warn(m);

/** Penanda model embedding. Vektor dari model/dimensi berbeda tidak boleh dibandingkan. */
export const embedTag = () => `${env.geminiEmbedModel}:${env.embedDims}`;