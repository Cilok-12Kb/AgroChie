import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { requireUser } from "../middleware/auth.js";
import { rateLimit } from "../middleware/rate-limit.js";
import { uploadFoto } from "../utils/upload.js";
import * as detection from "../controllers/detection.controller.js";

// [REVISI] Deteksi kualitas tanaman (sub-langkah 3). Semua rute wajib masuk; foto hanya lewat /:id/foto.
export const detectionRoutes = Router();
detectionRoutes.use(requireUser);

// Rate limit per pengguna: 10 analisis per 10 menit (tiap analisis memanggil Gemini dua kali). Dipasang sebelum unggahan
// agar permintaan berlebih ditolak tanpa membaca berkasnya.
const analyzeLimit = rateLimit({ windowMs: 10 * 60_000, max: 10, message: "Terlalu banyak analisis foto. Coba lagi beberapa menit lagi." });
const noteLimit = rateLimit({ windowMs: 10 * 60_000, max: 30, message: "Terlalu banyak permintaan. Coba lagi beberapa menit lagi." });

detectionRoutes.post("/", analyzeLimit, uploadFoto, asyncHandler(detection.create));
detectionRoutes.get("/", asyncHandler(detection.list));
detectionRoutes.get("/:id", asyncHandler(detection.detail));
detectionRoutes.get("/:id/foto", asyncHandler(detection.photo));
detectionRoutes.post("/:id/ke-catatan", noteLimit, asyncHandler(detection.toNote));
