import { prisma } from "../config/prisma.js";
import { HttpError } from "../utils/http-error.js";
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
