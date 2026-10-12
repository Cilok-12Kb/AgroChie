import { HttpError } from "../utils/http-error.js";
import { getSessionTools } from "../utils/session.js";

// [REVISI] bagian 17.3: header x-user-id diganti sesi JWT di cookie httpOnly.
// Pabrik agar bisa diuji dengan alat sesi buatan sendiri.
export function makeRequireUser(getTools) {
  return async function requireUser(req, res, next) {
    try {
      const tools = await getTools();
      const session = await tools.verifyToken(tools.readToken(req));
      if (!session) return next(new HttpError(401, "Belum masuk"));
      req.user = { id: session.id, role: session.role, isGuest: session.isGuest };
      req.userId = session.id;
      await tools.refreshSession(res, session);
      next();
    } catch (err) {
      next(err);
    }
  };
}

export const requireUser = makeRequireUser(getSessionTools);

// bagian 17.6: untuk logout. Mengisi req.user bila sesi sah; bila tidak, lanjut tanpa galat dan tanpa
// memperbarui token, supaya sesi kedaluwarsa tetap bisa keluar (cookie dihapus).
export function makeOptionalUser(getTools) {
  return async function optionalUser(req, _res, next) {
    try {
      const tools = await getTools();
      const session = await tools.verifyToken(tools.readToken(req));
      if (session) {
        req.user = { id: session.id, role: session.role, isGuest: session.isGuest };
        req.userId = session.id;
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
