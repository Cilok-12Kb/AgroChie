import argon2 from "argon2";
import { prisma } from "../config/prisma.js";
import { HttpError } from "../utils/http-error.js";
import { failureLimiter } from "../middleware/rate-limit.js";
import { maskEmail } from "./email-templates.js";
import { emailSchema } from "../validators/auth-email.validator.js";
import { ME_SELECT, toPublicUser } from "./auth.service.js";

// Login dengan Google (POST /auth/google). ID token TIDAK PERNAH dicatat ke log, dan pesan galat
// dari pustaka Google tidak diteruskan ke klien.

export const GOOGLE_INVALID = "Token Google tidak valid";
export const GOOGLE_UNVERIFIED_CONFLICT =
  "Email sudah terdaftar tetapi belum terverifikasi. Masuk dengan metode lain lalu verifikasi emailmu.";
export const GOOGLE_OTHER_LINKED = "Email ini sudah tertaut ke akun Google lain.";
const NAME_MAX = 100; // sama dengan batas name di register
const ISSUERS = ["accounts.google.com", "https://accounts.google.com"];

// Injeksi untuk tes: { cfg, verifier, db }. Di runtime kosong -> env, OAuth2Client, dan prisma.
let testDeps = null;
/** Hanya untuk tes. Panggil tanpa argumen untuk mengembalikan ke bawaan. */
export function _setDepsForTests(deps = null) {
  testDeps = deps;
}

let oauthClient;
/** Verifier bawaan: tanda tangan, kedaluwarsa, dan aud diperiksa oleh google-auth-library. */
async function defaultVerifier(idToken, audience) {
  const { OAuth2Client } = await import("google-auth-library");
  oauthClient ??= new OAuth2Client();
  const ticket = await oauthClient.verifyIdToken({ idToken, audience });
  return ticket.getPayload();
}

async function getDeps() {
  const { env } = testDeps?.cfg ? { env: testDeps.cfg } : await import("../config/env.js");
  return { cfg: env, verifier: testDeps?.verifier ?? defaultVerifier, db: testDeps?.db ?? prisma };
}

/** Wajib dipanggil sebelum verifikasi: 503 bila GOOGLE_CLIENT_ID belum diisi. */
export async function assertGoogleReady() {
  const { cfg } = await getDeps();
  if (!cfg.googleConfigured) throw new HttpError(503, "Login Google belum dikonfigurasi");
}

/**
 * Pemeriksaan eksplisit klaim (fungsi murni): aud, iss, email_verified === true, sub, dan email.
 * Mengembalikan { sub, email, name } atau melempar 401 umum.
 */
export function validateGooglePayload(payload, clientId) {
  const fail = () => new HttpError(401, GOOGLE_INVALID);
  if (!payload || typeof payload !== "object") throw fail();
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!clientId || !aud.includes(clientId)) throw fail();
  if (!ISSUERS.includes(payload.iss)) throw fail();
  if (payload.email_verified !== true) throw fail();
  if (typeof payload.sub !== "string" || !payload.sub) throw fail();
  if (typeof payload.email !== "string") throw fail();
  const parsed = emailSchema.safeParse(payload.email); // trim + lowercase (D2)
  if (!parsed.success) throw fail();
  return { sub: payload.sub, email: parsed.data, name: typeof payload.name === "string" ? payload.name : "" };
}

/** Nama dari klaim `name`; bila kosong, bagian sebelum @ pada email. Dipotong sesuai batas name. */
export function pickName(name, email) {
  const n = String(name ?? "").trim().slice(0, NAME_MAX).trim();
  return n || email.split("@")[0].slice(0, NAME_MAX);
}

const RACE = Symbol("race");

/** Satu percobaan menerapkan aturan akun a-d. Melempar RACE bila terjadi tabrakan data bersamaan. */
async function applyRules(db, { sub, email, name }) {
  // a. googleId sudah dikenal -> login
  const byGoogle = await db.user.findUnique({ where: { googleId: sub }, select: ME_SELECT });
  if (byGoogle) return { row: byGoogle, created: false };

  // Akun tamu tidak pernah dicocokkan atau ditautkan.
  const byEmail = await db.user.findFirst({ where: { email, isGuest: false }, select: ME_SELECT });
  if (byEmail) {
    // c. email sama tetapi belum terverifikasi -> tolak, akun tidak disentuh
    if (!byEmail.emailVerifiedAt) throw new HttpError(409, GOOGLE_UNVERIFIED_CONFLICT);
    // b. terverifikasi: tautkan, kecuali sudah punya googleId lain
    if (byEmail.googleId) throw new HttpError(409, GOOGLE_OTHER_LINKED);
    try {
      const upd = await db.user.updateMany({ where: { id: byEmail.id, googleId: null }, data: { googleId: sub } });
      if (upd.count !== 1) throw RACE;
    } catch (err) {
      if (err?.code === "P2002") throw RACE;
      throw err;
    }
    const row = await db.user.findUnique({ where: { id: byEmail.id }, select: ME_SELECT });
    return { row, created: false };
  }

  // d. tidak ada yang cocok -> akun baru (phone dan passwordHash kosong, tidak ditebak)
  try {
    const row = await db.user.create({
      data: {
        name: pickName(name, email),
        email,
        emailVerifiedAt: new Date(),
        googleId: sub,
        passwordHash: null,
        phone: null,
        role: "PETANI",
        isGuest: false,
      },
      select: ME_SELECT,
    });
    return { row, created: true };
  } catch (err) {
    if (err?.code === "P2002") throw RACE;
    throw err;
  }
}

// ---------------------------------------------------------------------------------------------
// [REVISI] langkah 10: POST /auth/google/link (wajib login, re-autentikasi password).
// ---------------------------------------------------------------------------------------------
export const LINK_WRONG_PASSWORD = "Kata sandi salah";
export const LINK_OWN_OTHER = "Akun ini sudah tertaut ke akun Google lain.";
export const LINK_TAKEN = "Akun Google ini sudah dipakai akun lain.";
// Maksimal 5 percobaan password gagal per user per 15 menit (selain pembatas per IP di rute).
const passwordFailures = failureLimiter({ windowMs: 15 * 60_000, max: 5 });

/** Terapkan aturan penautan dalam satu transaksi. Melempar RACE bila P2002. */
async function applyLink(db, userId, { sub, email }) {
  try {
    return await db.$transaction(async (tx) => {
      const user = await tx.user.findUnique({ where: { id: userId }, select: ME_SELECT });
      if (!user) throw new HttpError(401, "Belum masuk");
      if (user.googleId === sub) return { changed: false, user };
      if (user.googleId) throw new HttpError(409, LINK_OWN_OTHER);
      const holder = await tx.user.findUnique({ where: { googleId: sub }, select: { id: true } });
      if (holder) throw new HttpError(409, LINK_TAKEN);

      const now = new Date();
      const data = { googleId: sub };
      let revokeTokens = false;
      const emailTaken = await tx.user.findFirst({ where: { email, id: { not: userId } }, select: { id: true } });
      if (!user.email && !emailTaken) {
        data.email = email; // akun tanpa email mendapat email Google (terverifikasi oleh Google)
        data.emailVerifiedAt = now;
        revokeTokens = true;
      } else if (user.email === email && !user.emailVerifiedAt) {
        data.emailVerifiedAt = now;
        revokeTokens = true;
      } // kasus lain: email akun tidak diubah
      // Hanya googleId yang dijaga dengan "googleId: null" agar dua permintaan bersamaan tidak saling menimpa.
      const upd = await tx.user.updateMany({ where: { id: userId, googleId: null }, data });
      if (upd.count !== 1) throw RACE;
      if (revokeTokens) {
        await tx.emailVerification.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } });
      }
      const fresh = await tx.user.findUnique({ where: { id: userId }, select: ME_SELECT });
      // Penerima pemberitahuan: email akun yang sudah terverifikasi SEBELUM penautan.
      const before = user.email && user.emailVerifiedAt ? { email: user.email, name: user.name } : null;
      return { changed: true, user: fresh, when: now, before };
    });
  } catch (err) {
    if (err?.code === "P2002") throw RACE;
    throw err;
  }
}

/**
 * Tautkan Google ke akun yang sedang login. Urutan: tamu 403 -> 503 -> pembatas password 429 ->
 * password (argon2) 401/400 -> BARU token Google 401 -> transaksi -> email pemberitahuan (di luar transaksi).
 */
export async function linkGoogle(userId, { idToken, password, lang }) {
  const { cfg, verifier, db } = await getDeps();
  const me = await db.user.findUnique({ where: { id: userId }, select: { isGuest: true, passwordHash: true } });
  if (!me) throw new HttpError(401, "Belum masuk");
  if (me.isGuest) throw new HttpError(403, "Akun tamu tidak dapat menautkan akun Google");
  if (!cfg.googleConfigured) throw new HttpError(503, "Login Google belum dikonfigurasi");

  if (passwordFailures.isBlocked(userId)) {
    throw new HttpError(429, "Terlalu banyak percobaan kata sandi salah. Coba lagi nanti.");
  }
  if (!me.passwordHash) throw new HttpError(400, "Akun ini tidak memiliki kata sandi");
  if (!(await argon2.verify(me.passwordHash, password))) {
    passwordFailures.recordFailure(userId);
    throw new HttpError(401, LINK_WRONG_PASSWORD);
  }
  passwordFailures.clear(userId);

  // Token Google baru diperiksa setelah password benar.
  let payload;
  try {
    payload = await verifier(idToken, cfg.googleClientId);
  } catch {
    throw new HttpError(401, GOOGLE_INVALID);
  }
  const claims = validateGooglePayload(payload, cfg.googleClientId);

  let result;
  for (let attempt = 0; attempt < 2 && !result; attempt++) {
    try {
      result = await applyLink(db, userId, claims);
    } catch (err) {
      if (err !== RACE) throw err;
    }
  }
  if (!result) throw new HttpError(409, "Akun sedang diproses. Coba lagi.");

  // Email pemberitahuan ke email akun yang SUDAH terverifikasi sebelum penautan; kegagalan hanya dicatat.
  const before = result.before;
  if (result.changed && before) {
    try {
      const mailer = testDeps?.mailer ?? (await (await import("./mailer.service.js")).getMailer());
      await mailer.sendGoogleLinkedEmail({
        to: before.email, name: before.name, masked: maskEmail(claims.email), when: result.when, lang,
      });
    } catch (err) {
      console.error("[mail] gagal mengirim pemberitahuan tautan Google:", err?.code ?? err?.name ?? "error");
    }
  }
  return toPublicUser(result.user);
}

/**
 * Verifikasi ID token lalu terapkan aturan akun. Hasil: { user, sessionVersion, created }.
 * Balapan (P2002): pencarian diulang sekali; bila masih bentrok dibalas 409, bukan 500.
 */
export async function loginWithGoogle({ idToken }) {
  const { cfg, verifier, db } = await getDeps();
  if (!cfg.googleConfigured) throw new HttpError(503, "Login Google belum dikonfigurasi");

  let payload;
  try {
    payload = await verifier(idToken, cfg.googleClientId);
  } catch {
    throw new HttpError(401, GOOGLE_INVALID); // detail galat Google tidak diteruskan maupun dicatat
  }
  const claims = validateGooglePayload(payload, cfg.googleClientId);

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { row, created } = await applyRules(db, claims);
      return { user: toPublicUser(row), sessionVersion: row.sessionVersion, created };
    } catch (err) {
      if (err !== RACE) throw err;
    }
  }
  throw new HttpError(409, "Akun sedang diproses. Coba masuk lagi.");
}
