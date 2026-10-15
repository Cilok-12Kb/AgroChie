import argon2 from "argon2";
import { countLoginMethods, wouldLoseLastLoginMethod } from "../utils/login-methods.js";
import { HttpError } from "../utils/http-error.js";
import { failureLimiter } from "../middleware/rate-limit.js";
import { maskEmail } from "./email-templates.js";
import { getMailer } from "./mailer.service.js";
import { ME_SELECT, toPublicUser, bumpSessionVersion } from "./auth.service.js";
import {
  passwordFailures, verifyGoogleToken, assertGoogleReady, LINK_WRONG_PASSWORD, GOOGLE_INVALID,
} from "./google-auth.service.js";

// [REVISI] B7: aturan murni perubahan metode login (nomor HP, hapus email, lepas Google).
// Tanpa DB dan tanpa efek samping; service HTTP/DB ditambahkan di langkah berikutnya.

const has = (v) => v !== null && v !== undefined && v !== "";

export const MSG = {
  guest: "Akun tamu tidak dapat mengubah data akun",
  forbidden: "Tidak diizinkan",
  noEmail: "Belum ada email di akun ini",
  noGoogle: "Akun ini belum tertaut ke Google",
  lastMethod: "Tidak bisa menghapus metode masuk terakhir.",
};

/** Jenis re-autentikasi untuk akun ini: "password", "google", atau null bila mustahil. */
export function reauthKindFor(user) {
  if (has(user?.passwordHash)) return "password";
  if (has(user?.googleId)) return "google";
  return null;
}

const deny = (status, message) => ({ allowed: false, reauth: null, noop: false, status, message });
const allow = (reauth, noop = false) => ({ allowed: true, reauth, noop, status: 200, message: null });

/**
 * Putuskan apakah perubahan boleh dilakukan.
 * user: { isGuest, passwordHash, phone, email, googleId }
 * action: { type: "phone", phone } | { type: "removeEmail" } | { type: "unlinkGoogle" }
 * Hasil: { allowed, reauth: "none"|"password"|"google"|null, noop, status, message }
 */
export function planAccountChange(user, action) {
  if (user?.isGuest) return deny(403, MSG.guest);
  const kind = reauthKindFor(user);

  switch (action?.type) {
    case "phone": {
      if (has(user.phone) && action.phone === user.phone) return allow("none", true);
      if (!has(user.phone)) {
        // Menambah: tanpa re-auth, tetapi akun tanpa cara re-auth sama sekali tidak wajar -> tolak.
        return kind ? allow("none") : deny(403, MSG.forbidden);
      }
      return kind ? allow(kind) : deny(403, MSG.forbidden);
    }
    case "removeEmail": {
      if (countLoginMethods(user) === 0) return deny(409, MSG.lastMethod); // baris 13 tabel keputusan
      if (!has(user.email)) return deny(400, MSG.noEmail);
      if (wouldLoseLastLoginMethod(user, { email: null })) return deny(409, MSG.lastMethod);
      return kind ? allow(kind) : deny(403, MSG.forbidden);
    }
    case "unlinkGoogle": {
      if (countLoginMethods(user) === 0) return deny(409, MSG.lastMethod); // baris 13 tabel keputusan
      if (!has(user.googleId)) return deny(400, MSG.noGoogle);
      if (wouldLoseLastLoginMethod(user, { googleId: null })) return deny(409, MSG.lastMethod);
      return kind ? allow(kind) : deny(403, MSG.forbidden);
    }
    default:
      return deny(400, "Aksi tidak dikenal");
  }
}

/** Samarkan nomor HP: *** + 3 digit terakhir. */
export function maskPhone(phone) {
  const d = String(phone ?? "").replace(/\D/g, "");
  return d ? `***${d.slice(-3)}` : "***";
}

// ---------------------------------------------------------------------------------------------
// [REVISI] B7-2: service HTTP/DB. Urutan: muat user -> kebijakan -> blokir -> re-auth -> transaksi
// (cek ulang kebijakan, ubah, bump sessionVersion) -> email pemberitahuan di luar transaksi.
// ---------------------------------------------------------------------------------------------
export const PHONE_TAKEN = "Nomor HP tidak dapat digunakan.";
export const BUSY = "Akun sedang diproses. Coba lagi.";
const REAUTH_BLOCKED = "Terlalu banyak percobaan verifikasi gagal. Coba lagi nanti.";
const PHONE_BLOCKED = "Terlalu banyak percobaan nomor HP. Coba lagi nanti.";
// Maksimal 5 konflik nomor (409) per user per 15 menit, agar nomor milik orang lain tidak bisa dicari-cari.
const phoneConflicts = failureLimiter({ windowMs: 15 * 60_000, max: 5 });

// Injeksi untuk tes: { db, cfg, mailer }. Di runtime kosong -> prisma, env, dan mailer bawaan.
let testDeps = null;
/** Hanya untuk tes. Panggil tanpa argumen untuk mengembalikan ke bawaan. */
export function _setDepsForTests(deps = null) {
  testDeps = deps;
}
async function getDb() {
  if (testDeps?.db) return testDeps.db;
  return (await import("../config/prisma.js")).prisma;
}
async function getCfg() {
  if (testDeps?.cfg) return testDeps.cfg;
  return (await import("../config/env.js")).env;
}

const USER_SELECT = {
  id: true, name: true, phone: true, email: true, emailVerifiedAt: true,
  passwordHash: true, googleId: true, isGuest: true,
};

/** Re-autentikasi sesuai jenis dari rencana. Melempar 400/401/429/503. */
async function reauthenticate(userId, user, kind, { password, idToken }) {
  if (kind === "password") {
    if (!password) throw new HttpError(400, "Kata sandi wajib diisi");
    if (passwordFailures.isBlocked(userId)) throw new HttpError(429, REAUTH_BLOCKED);
    if (!(await argon2.verify(user.passwordHash, password))) {
      passwordFailures.recordFailure(userId);
      throw new HttpError(401, LINK_WRONG_PASSWORD);
    }
  } else {
    if (!idToken) throw new HttpError(400, "idToken wajib diisi");
    await assertGoogleReady();
    if (passwordFailures.isBlocked(userId)) throw new HttpError(429, REAUTH_BLOCKED);
    try {
      const claims = await verifyGoogleToken(idToken);
      if (claims.sub !== user.googleId) throw new HttpError(401, GOOGLE_INVALID); // seragam, tidak membedakan sebab
    } catch (err) {
      if (err instanceof HttpError && err.status === 401) passwordFailures.recordFailure(userId);
      throw err;
    }
  }
  passwordFailures.clear(userId);
}

async function notify(send) {
  try {
    const cfg = await getCfg();
    if (!cfg.mailConfigured) return;
    const mailer = testDeps?.mailer ?? (await getMailer());
    await send(mailer);
  } catch (err) {
    // Hanya jenis galat yang dicatat; tanpa alamat email dan tanpa pesan server surat.
    console.error("[mail] gagal mengirim pemberitahuan perubahan akun:", err?.code ?? err?.name ?? "error");
  }
}



/**
 * Kerangka bersama. `apply(tx, user)` mengubah data dan mengembalikan { bump, mail }.
 * Hasil: { user (publik), sessionVersion (angka baru atau null bila tidak berubah) }.
 */
async function change(userId, action, body, apply) {
  const db = await getDb();
  const user = await db.user.findUnique({ where: { id: userId }, select: USER_SELECT });
  if (!user) throw new HttpError(401, "Belum masuk");

  const plan = planAccountChange(user, action);
  if (!plan.allowed) throw new HttpError(plan.status, plan.message);
  if (plan.noop) {
    const row = await db.user.findUnique({ where: { id: userId }, select: ME_SELECT });
    return { user: toPublicUser(row), sessionVersion: null };
  }
  if (action.type === "phone" && phoneConflicts.isBlocked(userId)) throw new HttpError(429, PHONE_BLOCKED);
  if (plan.reauth === "password" || plan.reauth === "google") {
    await reauthenticate(userId, user, plan.reauth, body);
  }

  const now = new Date();
  let out;
  try {
    out = await db.$transaction(async (tx) => {
      const fresh = await tx.user.findUnique({ where: { id: userId }, select: USER_SELECT });
      if (!fresh) throw new HttpError(401, "Belum masuk");
      const again = planAccountChange(fresh, action); // cek ulang kebijakan di dalam transaksi
      if (!again.allowed) throw new HttpError(again.status, again.message);
      if (again.noop) throw new HttpError(409, BUSY);
      const r = await apply(tx, fresh);
      const sessionVersion = r.bump ? await bumpSessionVersion(tx, userId) : null;
      return { sessionVersion, mail: r.mail };
    });
  } catch (err) {
    const taken = err?.code === "P2002" || (err instanceof HttpError && err.message === PHONE_TAKEN);
    if (action.type === "phone" && taken) {
      phoneConflicts.recordFailure(userId);
      throw new HttpError(409, PHONE_TAKEN);
    }
    throw err;
  }

  const row = await db.user.findUnique({ where: { id: userId }, select: ME_SELECT });
  if (out.mail) await notify((mailer) => out.mail(mailer, { when: now, lang: body.lang }));
  return { user: toPublicUser(row), sessionVersion: out.sessionVersion };
}

const verifiedTo = (u) => (u.email && u.emailVerifiedAt ? u.email : null);

/** POST /auth/phone. */
export async function setPhone(userId, { phone, password, idToken, lang }) {
  return change(userId, { type: "phone", phone }, { password, idToken, lang }, async (tx, u) => {
    const holder = await tx.user.findUnique({ where: { phone }, select: { id: true } });
    if (holder && holder.id !== userId) throw new HttpError(409, PHONE_TAKEN);
    const upd = await tx.user.updateMany({ where: { id: userId, phone: u.phone }, data: { phone } });
    if (upd.count !== 1) throw new HttpError(409, BUSY);
    const replaced = Boolean(u.phone);
    const to = verifiedTo(u);
    return {
      bump: replaced,
      mail: replaced && to
        ? (mailer, ctx) => mailer.sendPhoneChangedEmail({
            to, name: u.name, oldMasked: maskPhone(u.phone), newMasked: maskPhone(phone), ...ctx,
          })
        : null,
    };
  });
}

/** POST /auth/email/remove. */
export async function removeEmail(userId, body) {
  return change(userId, { type: "removeEmail" }, body, async (tx, u) => {
    const upd = await tx.user.updateMany({
      where: { id: userId, email: u.email },
      data: { email: null, emailVerifiedAt: null },
    });
    if (upd.count !== 1) throw new HttpError(409, BUSY);
    const now = new Date();
    await tx.emailVerification.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } });
    await tx.passwordReset.updateMany({ where: { userId, usedAt: null }, data: { usedAt: now } });
    const to = verifiedTo(u); // email lama yang belum terverifikasi tidak dikirimi apa pun
    return {
      bump: true,
      mail: to
        ? (mailer, ctx) => mailer.sendEmailRemovedEmail({ to, name: u.name, masked: maskEmail(u.email), ...ctx })
        : null,
    };
  });
}

/** POST /auth/google/unlink. */
export async function unlinkGoogle(userId, body) {
  return change(userId, { type: "unlinkGoogle" }, body, async (tx, u) => {
    const upd = await tx.user.updateMany({ where: { id: userId, googleId: u.googleId }, data: { googleId: null } });
    if (upd.count !== 1) throw new HttpError(409, BUSY);
    const to = verifiedTo(u);
    return {
      bump: true,
      mail: to ? (mailer, ctx) => mailer.sendGoogleUnlinkedEmail({ to, name: u.name, ...ctx }) : null,
    };
  });
}

