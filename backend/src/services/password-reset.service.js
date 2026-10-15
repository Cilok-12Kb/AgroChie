import argon2 from "argon2";
import { prisma } from "../config/prisma.js";
import { HttpError } from "../utils/http-error.js";
import { createTokenPair, hashToken } from "../utils/token.js";
import { getMailer } from "./mailer.service.js";
import { bumpSessionVersion } from "./auth.service.js";

// Lupa dan reset password lewat email. Hanya hash token yang disimpan.

export const FORGOT_MESSAGE = "Jika email terdaftar dan sudah terverifikasi, tautan reset kata sandi akan dikirim.";
export const RESET_INVALID = "Tautan reset tidak valid atau sudah kedaluwarsa";
const MAX_PER_HOUR = 3;
const HOUR_MS = 60 * 60_000;
const TX_OPTIONS = { maxWait: 5000, timeout: 20000 };

// Injeksi untuk tes: { cfg, mailer }. Di runtime kosong -> env dan mailer bawaan.
let testDeps = null;
/** Hanya untuk tes. Panggil tanpa argumen untuk mengembalikan ke bawaan. */
export function _setDepsForTests(deps = null) {
  testDeps = deps;
}
async function getDeps() {
  if (testDeps) return testDeps;
  const { env } = await import("../config/env.js");
  return { cfg: env, mailer: await getMailer() };
}

/** Hook khusus tes: Promise proses latar forgot-password terakhir (tidak pernah reject). */
export let _lastForgotJob = null;

const errKind = (err) => err?.code ?? err?.name ?? "error";

/** Dipanggil SEBELUM membalas: 503 bila email belum dikonfigurasi (kondisi global, tidak membocorkan akun). */
export async function assertMailReady() {
  const { cfg } = await getDeps();
  if (!cfg.mailConfigured) throw new HttpError(503, "Layanan email belum dikonfigurasi");
}

async function runForgot({ email, lang }) {
  const { cfg, mailer } = await getDeps();
  const user = await prisma.user.findUnique({
    where: { email },
    select: { id: true, name: true, isGuest: true, emailVerifiedAt: true },
  });
  if (!user || user.isGuest || !user.emailVerifiedAt) return;

  const recent = await prisma.passwordReset.count({
    where: { userId: user.id, createdAt: { gte: new Date(Date.now() - HOUR_MS) } },
  });
  if (recent >= MAX_PER_HOUR) return;

  const now = new Date();
  const { token, tokenHash } = createTokenPair();
  // Transaksi hanya untuk DB: cabut token lama lalu buat yang baru.
  const issued = await prisma.$transaction(async (tx) => {
    await tx.passwordReset.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } });
    return tx.passwordReset.create({
      data: { userId: user.id, tokenHash, expiresAt: new Date(now.getTime() + cfg.passwordResetTtlMinutes * 60_000) },
      select: { id: true },
    });
  }, TX_OPTIONS);

  try {
    await mailer.sendPasswordResetEmail({ to: email, name: user.name, token, lang });
  } catch (err) {
    console.error("[mail] gagal mengirim email reset password:", errKind(err));
    await prisma.passwordReset.updateMany({ where: { id: issued.id, usedAt: null }, data: { usedAt: new Date() } });
  }
}

/**
 * Mulai proses latar setelah respons dikirim (setImmediate). Galat hanya dicatat (jenisnya saja),
 * tidak pernah menjadi unhandled rejection.
 */
export function startForgotJob(input) {
  _lastForgotJob = new Promise((resolve) => {
    setImmediate(() => {
      runForgot(input)
        .catch((err) => console.error("[auth] proses lupa password gagal:", errKind(err)))
        .finally(resolve);
    });
  });
  return _lastForgotJob;
}

/** POST /auth/reset-password. Token tidak ada / kedaluwarsa / terpakai: pesan 400 yang sama. */
export async function resetPassword({ token, passwordBaru, lang }) {
  const now = new Date();
  const row = await prisma.passwordReset.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { name: true, email: true, isGuest: true } } },
  });
  if (!row || row.usedAt || row.expiresAt <= now || row.user.isGuest) throw new HttpError(400, RESET_INVALID);

  const passwordHash = await argon2.hash(passwordBaru);
  await prisma.$transaction(async (tx) => {
    // updateMany bersyarat: token hanya bisa dipakai sekali walau ada dua permintaan bersamaan.
    const used = await tx.passwordReset.updateMany({
      where: { id: row.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (used.count !== 1) throw new HttpError(400, RESET_INVALID);
    await tx.user.update({ where: { id: row.userId }, data: { passwordHash } });
    await tx.passwordReset.updateMany({ where: { userId: row.userId, usedAt: null }, data: { usedAt: now } });
    await bumpSessionVersion(tx, row.userId); // cabut semua sesi lama
  }, TX_OPTIONS);

  // Setelah commit: pemberitahuan. Kegagalan hanya dicatat.
  try {
    if (row.user.email) {
      const { mailer } = await getDeps();
      await mailer.sendPasswordChangedEmail({ to: row.user.email, name: row.user.name, lang });
    }
  } catch (err) {
    console.error("[mail] gagal mengirim pemberitahuan password diganti:", errKind(err));
  }
  return { ok: true };
}
