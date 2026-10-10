import { GoogleGenAI } from "@google/genai";
import { env } from "./env.js";
import { HttpError } from "../utils/http-error.js";

let client;

/** Satu klien Gemini untuk seluruh aplikasi. Kunci diperiksa saat dipakai. */
export function gemini() {
  if (!env.geminiKey) throw new HttpError(503, "GEMINI_API_KEY belum diisi di backend/.env");
  return (client ??= new GoogleGenAI({ apiKey: env.geminiKey }));
}