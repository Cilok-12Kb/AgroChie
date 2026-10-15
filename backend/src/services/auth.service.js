import { randomBytes } from "node:crypto";
import argon2 from "argon2";
import { prisma } from "../config/prisma.js";
import { HttpError } from "../utils/http-error.js";

// Hanya kolom aman; passwordHash tidak pernah dipilih untuk respons.
const PUBLIC = { id: true, name: true, phone: true, role: true, isGuest: true };

// [REVISI] bagian 17.4: validasi dipindah ke validators/auth.validator.js (zod);
// role selalu PETANI dan hasilnya memuat role/isGuest untuk membuat sesi.
export async function registerUser({ name, phone, password }) {
  try {
    // [REVISI] D3: respons register memakai bentuk publik yang sama dengan /auth/me (hanya menambah field).
    const row = await prisma.user.create({
      data: { name, phone, passwordHash: await argon2.hash(password), role: "PETANI", isGuest: false },
      select: ME_SELECT,
    });
    // [REVISI] D1: sessionVersion dikembalikan terpisah untuk klaim sv; tidak ikut ke respons.
    return { user: toPublicUser(row), sessionVersion: row.sessionVersion };
  } catch (err) {
    if (err.code === "P2002") throw new HttpError(409, "Nomor HP sudah terdaftar");
    throw err;
  }
}

let dummyHash;
/** Hash tiruan (parameter argon2 sama) agar waktu respons login tidak membocorkan keberadaan akun. */
async function getDummyHash() {
  dummyHash ??= await argon2.hash("kata-sandi-tiruan-tidak-dipakai");
  return dummyHash;
}

// [REVISI] D3: pesan umum untuk HP maupun email (tidak membedakan akun tak ada / sandi salah / akun Google-only).
const LOGIN_FAILED = "Nomor HP/email atau kata sandi salah";

// [REVISI] D3: cari lewat email (bila ada) atau HP; kembalikan bentuk publik yang sama dengan /auth/me.
export async function loginUser({ phone, email, password }) {
  const where = email ? { email } : { phone };
  const row = await prisma.user.findUnique({ where, select: ME_SELECT });
  // verify selalu dijalankan, ke hash asli atau hash tiruan (akun tak ada / tanpa passwordHash).
  const ok = await argon2.verify(row?.passwordHash ?? (await getDummyHash()), password);
  if (!row || !row.passwordHash || !ok) throw new HttpError(401, LOGIN_FAILED);
  return { user: toPublicUser(row), sessionVersion: row.sessionVersion }; // [REVISI] D1
}

// bagian 17.6: mode tamu. Kata sandi acak kuat hanya di-hash, tidak disimpan/dikembalikan/dicatat,
// sehingga akun tamu tidak bisa dipakai login (phone juga null).
export async function createGuest() {
  const secret = randomBytes(32).toString("hex");
  return prisma.user.create({
    data: { name: "Tamu", phone: null, email: null, passwordHash: await argon2.hash(secret), role: "PETANI", isGuest: true },
    select: { id: true, name: true, role: true, isGuest: true, sessionVersion: true },
  });
}

/** [REVISI] D1: versi sesi saat ini, atau null bila user tidak ada. Hanya dipakai server. */
export async function getSessionVersion(userId) {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: { sessionVersion: true } });
  return row ? row.sessionVersion : null;
}

/**
 * [REVISI] D1: naikkan sessionVersion secara atomik (increment di DB) sehingga semua token lama ditolak.
 * Panggil di dalam transaksi (tx = klien transaksi). Mengembalikan versi baru.
 */
export async function bumpSessionVersion(tx, userId) {
  const row = await tx.user.update({
    where: { id: userId },
    data: { sessionVersion: { increment: 1 } },
    select: { sessionVersion: true },
  });
  return row.sessionVersion;
}

/** Hapus HANYA baris dengan id ini DAN isGuest = true (relasi Cascade ikut menghapus datanya). */
export async function deleteGuest(userId) {
  const r = await prisma.user.deleteMany({ where: { id: userId, isGuest: true } });
  return r.count;
}

// [REVISI] auth email/Google: kolom yang dibaca untuk membentuk respons /auth/me.
// passwordHash, googleId, dan sessionVersion hanya dibaca di server untuk menurunkan flag; TIDAK dikirim ke klien.
const ME_SELECT = {
  ...PUBLIC,
  email: true,
  emailVerifiedAt: true,
  passwordHash: true,
  googleId: true,
  sessionVersion: true,
  _count: { select: { farms: true } },
};

/**
 * [REVISI] Bentuk respons publik dari baris User (fungsi murni, diuji tanpa DB).
 * needsProfileCompletion (D8) diturunkan, tanpa kolom baru: akun bukan tamu yang belum punya
 * nomor HP atau belum punya lahan. Tamu tidak diminta melengkapi profil.
 */
export function toPublicUser(row) {
  const needsProfileCompletion = !row.isGuest && (!row.phone || (row._count?.farms ?? 0) === 0);
  return {
    id: row.id,
    name: row.name,
    phone: row.phone ?? null,
    email: row.email ?? null,
    emailVerified: Boolean(row.emailVerifiedAt),
    hasPassword: Boolean(row.passwordHash),
    hasGoogle: Boolean(row.googleId),
    role: row.role,
    isGuest: row.isGuest,
    needsProfileCompletion,
  };
}

export async function getMe(userId) {
  const row = await prisma.user.findUnique({ where: { id: userId }, select: ME_SELECT });
  if (!row) throw new HttpError(401, "Belum masuk");
  return toPublicUser(row);
}