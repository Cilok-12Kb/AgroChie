import { z } from "zod";
import { HttpError } from "../utils/http-error.js";

/** Buang semua non-angka. */
export function normalizePhone(value) {
  return String(value ?? "").replace(/\D/g, "");
}

const phone = z
  .string({ error: "Nomor HP wajib diisi" })
  .transform(normalizePhone)
  .refine((v) => v.length >= 8 && v.length <= 15, "Nomor HP harus 8 sampai 15 digit");

// z.object membuang kunci yang tidak dikenal, jadi `role` dari body otomatis diabaikan.
export const registerSchema = z.object({
  name: z.string({ error: "Nama wajib diisi" }).trim().min(1, "Nama wajib diisi").max(100, "Nama terlalu panjang"),
  phone,
  password: z
    .string({ error: "Kata sandi wajib diisi" })
    .min(8, "Kata sandi minimal 8 karakter")
    .max(128, "Kata sandi terlalu panjang"),
});

export const loginSchema = z.object({
  phone,
  password: z.string({ error: "Kata sandi wajib diisi" }).min(1, "Kata sandi wajib diisi").max(128, "Kata sandi terlalu panjang"),
});

function parse(schema, body) {
  const r = schema.safeParse(body ?? {});
  if (!r.success) throw new HttpError(400, r.error.issues.map((i) => i.message).join("; "));
  return r.data;
}

export const parseRegister = (body) => parse(registerSchema, body);
export const parseLogin = (body) => parse(loginSchema, body);
