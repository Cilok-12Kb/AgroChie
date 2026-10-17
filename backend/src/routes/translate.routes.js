import { Router } from "express";
import { asyncHandler } from "../utils/async-handler.js";
import { translateRateLimit } from "../middleware/rate-limit.js";
import { parseTranslateBody } from "../validators/translate.validator.js";
import { getTranslateService } from "../services/translate.service.js";

// [REVISI] Publik (tanpa login): halaman masuk/daftar juga perlu terjemahan. Dibatasi per IP.
// Controller tipis: validasi -> service. Tidak ada query DB. `getService` bisa disuntik untuk uji.
export function createTranslateRoutes(getService = getTranslateService) {
  const router = Router();
  router.post("/", translateRateLimit(), asyncHandler(async (req, res) => {
    const { target, texts } = parseTranslateBody(req.body);
    const translations = await getService().translate(target, texts);
    res.json({ translations });
  }));
  return router;
}

// [REVISI] Layanan dimuat lazy (saat request pertama), bukan saat modul diimpor, agar tes yang mengimpor rute tidak menyentuh cache asli.
export const translateRoutes = createTranslateRoutes();
