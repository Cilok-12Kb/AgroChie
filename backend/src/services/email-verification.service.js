import { prisma } from "../config/prisma.js";
import { HttpError } from "../utils/http-error.js";
import { createTokenPair, hashToken } from "../utils/token.js";
import { getMailer } from "./mailer.service.js";
import { getMe } from "./auth.service.js";

// Tambah dan verifikasi email. Hanya hash token yang disimpan; token mentah hanya dikirim lewat email.

export const VERIFY_INVALID = "Tautan verifikasi tidak valid atau sudah kedaluwarsa";
const RESEND_MAX_PER_HOUR = 3;
const HOUR_MS = 60 * 60_000;

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

async function loadUser(userId) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, name: true, email: true, emailVerifiedAt: true, isGuest: true },
  });
  if (!user) throw new HttpError(401, "Belum masuk");
  if (user.isGuest) throw new HttpError(403, "Akun tamu tidak dapat memakai email");
  return user;
}

function ensureMail(cfg) {
  if (!cfg.mailConfigured) throw new HttpError(503, "Layanan email belum dikonfigurasi");
}

async function assertResendQuota(userId) {
  const recent = await prisma.emailVerification.count({
    where: { userId, createdAt: { gte: new Date(Date.now() - HOUR_MS) } },
  });
  if (recent >= RESEND_MAX_PER_HOUR) {
    throw new HttpError(429, "Terlalu banyak permintaan verifikasi. Coba lagi dalam satu jam.");
  }
}

/**
 * Di dalam transaksi: matikan SEMUA token verifikasi dan reset yang belum terpakai milik user
 * (tabel PasswordReset tidak menyimpan alamat email), buat token baru, lalu kirim email.
 * Bila pengiriman gagal, transaksi dibatalkan sehingga tidak ada perubahan yang tersimpan.
 */
async function issueAndSend(tx, user, email, lang, { cfg, mailer }) {
  const now = new Date();
  await tx.emailVerification.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } });
  await tx.passwordReset.updateMany({ where: { userId: user.id, usedAt: null }, data: { usedAt: now } });
  const { token, tokenHash } = createTokenPair();
  await tx.emailVerification.create({
    data: {
      userId: user.id,
      email,
      tokenHash,
      expiresAt: new Date(now.getTime() + cfg.emailVerifyTtlHours * HOUR_MS),
    },
  });
  try {
    await mailer.sendVerificationEmail({ to: email, name: user.name, token, lang });
  } catch (err) {
    // Hanya jenis galat yang dicatat; isi pesan bisa memuat detail server surat.
    console.error("[mail] gagal mengirim email verifikasi:", err?.code ?? err?.name ?? "error");
    throw new HttpError(502, "Gagal mengirim email verifikasi. Coba lagi nanti.");
  }
}

const TX_OPTIONS = { maxWait: 5000, timeout: 20000 };

/** POST /auth/email */
export async function setEmail(userId, { email, lang }) {
  const deps = await getDeps();
  const user = await loadUser(userId);
  if (user.email === email && user.emailVerifiedAt) return getMe(userId); // tidak ada perubahan

  ensureMail(deps.cfg);
  // Email yang sama tapi belum terverifikasi = permintaan ulang: kuota per user berlaku.
  if (user.email === email) await assertResendQuota(userId);

  const taken = await prisma.user.findFirst({ where: { email, id: { not: userId } }, select: { id: true } });
  if (taken) throw new HttpError(409, "Email tidak dapat digunakan");

  try {
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: userId }, data: { email, emailVerifiedAt: null } });
      await issueAndSend(tx, user, email, lang, deps);
    }, TX_OPTIONS);
  } catch (err) {
    if (err.code === "P2002") throw new HttpError(409, "Email tidak dapat digunakan");
    throw err;
  }
  return getMe(userId);
}

/** POST /auth/email/resend-verification */
export async function resendVerification(userId, { lang }) {
  const deps = await getDeps();
  const user = await loadUser(userId);
  if (!user.email) throw new HttpError(400, "Belum ada email di akun ini");
  if (user.emailVerifiedAt) throw new HttpError(400, "Email sudah terverifikasi");
  ensureMail(deps.cfg);
  await assertResendQuota(userId);
  await prisma.$transaction((tx) => issueAndSend(tx, user, user.email, lang, deps), TX_OPTIONS);
  return { ok: true };
}

/** POST /auth/verify-email. Token tidak ada / kedaluwarsa / terpakai: pesan 400 yang sama. */
export async function verifyEmail({ token }) {
  const now = new Date();
  const row = await prisma.emailVerification.findUnique({
    where: { tokenHash: hashToken(token) },
    include: { user: { select: { email: true } } },
  });
  // Alamat di token harus masih sama dengan email akun (lapisan tambahan di luar pencabutan token).
  if (!row || row.usedAt || row.expiresAt <= now || row.user.email !== row.email) {
    throw new HttpError(400, VERIFY_INVALID);
  }
  await prisma.$transaction(async (tx) => {
    // updateMany bersyarat menjamin token hanya bisa dipakai sekali walau ada dua permintaan bersamaan.
    const used = await tx.emailVerification.updateMany({
      where: { id: row.id, usedAt: null, expiresAt: { gt: now } },
      data: { usedAt: now },
    });
    if (used.count !== 1) throw new HttpError(400, VERIFY_INVALID);
    await tx.user.update({ where: { id: row.userId }, data: { emailVerifiedAt: now } });
  });
  return { ok: true };
}
