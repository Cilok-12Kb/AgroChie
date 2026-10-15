import { z } from "zod";
import { HttpError } from "../utils/http-error.js";
import { emailSchema } from "./auth-email.validator.js";

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

// [REVISI] D3: login menerima `identifier` (HP atau email) atau `phone` lama.
// Pemilahan HP/email dilakukan di parseLogin; skema ini hanya memeriksa tipe dasar.
export const loginSchema = z.object({
  identifier: z.string({ error: "Nomor HP atau email wajib diisi" }).max(254, "Nomor HP atau email terlalu panjang").optional(),
  phone: z.string({ error: "Nomor HP wajib diisi" }).max(254, "Nomor HP terlalu panjang").optional(),
  password: z.string({ error: "Kata sandi wajib diisi" }).min(1, "Kata sandi wajib diisi").max(128, "Kata sandi terlalu panjang"),
});

function parse(schema, body) {
  const r = schema.safeParse(body ?? {});
  if (!r.success) throw new HttpError(400, r.error.issues.map((i) => i.message).join("; "));
  return r.data;
}

export const parseRegister = (body) => parse(registerSchema, body);
/**
 * [REVISI] D3: hasil berupa { phone, password } (HP ternormalisasi) atau { email, password }
 * (trim + lowercase). `identifier` diutamakan; bila kosong dipakai `phone` lama.
 * Mengandung "@" -> email; selain itu -> nomor HP dengan aturan lama.
 */
export function parseLogin(body) {
  const { identifier, phone: legacyPhone, password } = parse(loginSchema, body);
  const raw = (identifier ?? legacyPhone ?? "").trim();
  if (!raw) throw new HttpError(400, "Nomor HP atau email wajib diisi");
  if (raw.includes("@")) {
    const r = emailSchema.safeParse(raw);
    if (!r.success) throw new HttpError(400, r.error.issues.map((i) => i.message).join("; "));
    return { email: r.data, password };
  }
  const p = phone.safeParse(raw);
  if (!p.success) throw new HttpError(400, p.error.issues.map((i) => i.message).join("; "));
  return { phone: p.data, password };
}
