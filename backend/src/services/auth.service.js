import argon2 from "argon2";
import { prisma } from "../config/prisma.js";
import { HttpError } from "../utils/http-error.js";

// Hanya kolom aman; passwordHash tidak pernah dipilih untuk respons.
const PUBLIC = { id: true, name: true, phone: true, role: true, isGuest: true };

// [REVISI] bagian 17.4: validasi dipindah ke validators/auth.validator.js (zod);
// role selalu PETANI dan hasilnya memuat role/isGuest untuk membuat sesi.
export async function registerUser({ name, phone, password }) {
  try {
    return await prisma.user.create({
      data: { name, phone, passwordHash: await argon2.hash(password), role: "PETANI", isGuest: false },
      select: PUBLIC,
    });
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

const LOGIN_FAILED = "Nomor HP atau kata sandi salah";

export async function loginUser({ phone, password }) {
  const row = await prisma.user.findUnique({ where: { phone }, select: { ...PUBLIC, passwordHash: true } });
  // verify selalu dijalankan, ke hash asli atau hash tiruan.
  const ok = await argon2.verify(row?.passwordHash ?? (await getDummyHash()), password);
  if (!row || !ok) throw new HttpError(401, LOGIN_FAILED);
  const { passwordHash: _omit, ...user } = row;
  return user;
}

export async function getMe(userId) {
  const user = await prisma.user.findUnique({ where: { id: userId }, select: PUBLIC });
  if (!user) throw new HttpError(401, "Belum masuk");
  return user;
}