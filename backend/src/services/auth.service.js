import argon2 from "argon2";
import { prisma } from "../config/prisma.js";
import { HttpError } from "../utils/http-error.js";

export async function registerUser({ name, phone, password }) {
  if (!name || !phone || !password || String(password).length < 8)
    throw new HttpError(400, "Nama, nomor HP, dan kata sandi (min. 8 karakter) wajib diisi");
  return prisma.user.create({
    data: { name, phone, passwordHash: await argon2.hash(password) },
    select: { id: true, name: true, phone: true },
  });
}