import { SignJWT, jwtVerify } from "jose";

/**
 * Sesi JWT HS256 di cookie httpOnly (bagian 17.3).
 * Dibuat sebagai pabrik agar bisa diuji tanpa membaca .env.
 * cfg: { jwtSecret, jwtTtlDays, guestTtlHours, cookieName, nodeEnv }
 */
export function createSessionTools(cfg) {
  const key = new TextEncoder().encode(cfg.jwtSecret);
  const ttlSec = (isGuest) => (isGuest ? cfg.guestTtlHours * 3600 : cfg.jwtTtlDays * 86400);

  /** Buat token. `nowSec` hanya untuk pengujian. */
  async function createToken(user, nowSec = Math.floor(Date.now() / 1000)) {
    const isGuest = Boolean(user.isGuest);
    // [REVISI] D1: klaim sv = User.sessionVersion saat token terbit (tanpa nilai -> 0).
    return new SignJWT({ role: user.role, isGuest, sv: Number(user.sessionVersion ?? 0) })
      .setProtectedHeader({ alg: "HS256" })
      .setSubject(String(user.id))
      .setIssuedAt(nowSec)
      .setExpirationTime(nowSec + ttlSec(isGuest))
      .sign(key);
  }

  /** Kembalikan { id, role, isGuest, iat, exp }, atau null bila tidak sah/kedaluwarsa. */
  async function verifyToken(token) {
    if (!token) return null;
    try {
      const { payload } = await jwtVerify(token, key, { algorithms: ["HS256"] });
      if (!payload.sub) return null;
      return {
        id: payload.sub,
        role: payload.role,
        isGuest: Boolean(payload.isGuest),
        // [REVISI] D1: token lama tanpa klaim sv dianggap 0.
        sv: Number.isInteger(payload.sv) ? payload.sv : 0,
        iat: payload.iat,
        exp: payload.exp,
      };
    } catch {
      return null;
    }
  }

  function cookieOptions(isGuest) {
    return {
      httpOnly: true,
      sameSite: "lax",
      secure: cfg.nodeEnv === "production",
      path: "/",
      maxAge: ttlSec(isGuest) * 1000,
    };
  }

  async function setSessionCookie(res, user) {
    const token = await createToken(user);
    res.cookie(cfg.cookieName, token, cookieOptions(Boolean(user.isGuest)));
  }

  function clearSessionCookie(res) {
    const { maxAge: _m, ...opts } = cookieOptions(false);
    res.clearCookie(cfg.cookieName, opts);
  }

  /** Perbarui token non-tamu bila sisa masa berlaku kurang dari separuh. Tamu tidak diperbarui. */
  async function refreshSession(res, session, nowSec = Math.floor(Date.now() / 1000)) {
    if (session.isGuest) return false;
    const half = ttlSec(false) / 2;
    if (session.exp - nowSec >= half) return false;
    await setSessionCookie(res, session);
    return true;
  }

  function readToken(req) {
    if (req.cookies) return req.cookies[cfg.cookieName];
    const raw = req.headers?.cookie ?? "";
    for (const part of raw.split(";")) {
      const i = part.indexOf("=");
      if (i > 0 && part.slice(0, i).trim() === cfg.cookieName) {
        return decodeURIComponent(part.slice(i + 1).trim());
      }
    }
    return undefined;
  }

  return { createToken, verifyToken, setSessionCookie, clearSessionCookie, refreshSession, readToken };
}

let defaultTools;
/** Instans bawaan dari env; dimuat saat pertama dipakai agar impor modul tidak butuh .env. */
export async function getSessionTools() {
  if (!defaultTools) {
    const { env } = await import("../config/env.js");
    defaultTools = createSessionTools(env);
  }
  return defaultTools;
}
