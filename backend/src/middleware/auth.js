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

/** Pakai setelah requireUser. Peran tidak cocok dijawab 403. */
export function requireRole(...roles) {
  return function (req, _res, next) {
    if (!req.user) return next(new HttpError(401, "Belum masuk"));
    if (!roles.includes(req.user.role)) return next(new HttpError(403, "Tidak diizinkan"));
    next();
  };
}
