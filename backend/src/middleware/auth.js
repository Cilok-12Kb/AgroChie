import { HttpError } from "../utils/http-error.js";
import { getSessionTools } from "../utils/session.js";

// [REVISI] bagian 17.3: header x-user-id diganti sesi JWT di cookie httpOnly.
// Pabrik agar bisa diuji dengan alat sesi buatan sendiri.
// [REVISI] D1: sessionVersion dibaca dari DB (satu query per request terautentikasi). Dimuat lazy agar
// impor modul ini tidak butuh .env/DB; tes menyuntikkan pemuat buatan sendiri.
async function defaultLoadSessionVersion(userId) {
  const { getSessionVersion } = await import("../services/auth.service.js");
  return getSessionVersion(userId);
}

/**
 * [REVISI] D1: sesi sah bila user masih ada dan klaim sv (tanpa sv = 0) sama dengan User.sessionVersion.
 * Kembalikan versi dari DB bila sah, atau null bila user tidak ada / sv berbeda.
 */
async function validSessionVersion(loadVersion, session) {
  const current = await loadVersion(session.id);
  if (current === null || current === undefined) return null;
  return (session.sv ?? 0) === current ? current : null;
}

export function makeRequireUser(getTools, loadVersion = defaultLoadSessionVersion) {
  return async function requireUser(req, res, next) {
    try {
      const tools = await getTools();
      const session = await tools.verifyToken(tools.readToken(req));
      if (!session) return next(new HttpError(401, "Belum masuk"));
      const version = await validSessionVersion(loadVersion, session);
      if (version === null) {
        // Sesi dicabut (sv berbeda) atau user sudah tidak ada: hapus cookie dan tolak.
        tools.clearSessionCookie(res);
        return next(new HttpError(401, "Belum masuk"));
      }
      req.user = { id: session.id, role: session.role, isGuest: session.isGuest };
      req.userId = session.id;
      // Pembaruan otomatis memakai sv dari DB, bukan salinan dari token lama.
      await tools.refreshSession(res, { ...session, sessionVersion: version });
      next();
    } catch (err) {
      next(err);
    }
  };
}

export const requireUser = makeRequireUser(getSessionTools);

// bagian 17.6: untuk logout. Mengisi req.user bila sesi sah; bila tidak, lanjut tanpa galat dan tanpa
// memperbarui token, supaya sesi kedaluwarsa tetap bisa keluar (cookie dihapus).
export function makeOptionalUser(getTools, loadVersion = defaultLoadSessionVersion) {
  return async function optionalUser(req, res, next) {
    try {
      const tools = await getTools();
      const session = await tools.verifyToken(tools.readToken(req));
      if (session) {
        // [REVISI] D1: sesi dicabut dianggap tidak login (bukan galat) dan cookie dihapus.
        if ((await validSessionVersion(loadVersion, session)) === null) {
          tools.clearSessionCookie(res);
        } else {
          req.user = { id: session.id, role: session.role, isGuest: session.isGuest };
          req.userId = session.id;
        }
      }
      next();
    } catch (err) {
      next(err);
    }
  };
}
export const optionalUser = makeOptionalUser(getSessionTools);

/** Pakai setelah requireUser. Peran tidak cocok dijawab 403. */
export function requireRole(...roles) {
  return function (req, _res, next) {
    if (!req.user) return next(new HttpError(401, "Belum masuk"));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, "Tidak diizinkan"));
    next();
  };
}
