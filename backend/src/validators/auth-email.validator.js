import { z } from "zod";
import { HttpError } from "../utils/http-error.js";

// Validator untuk alur email dan Google (D2: email di-trim lalu lowercase sebelum divalidasi/disimpan).

/** Email ternormalisasi: trim + lowercase, format valid, maksimal 254 karakter. */
export const emailSchema = z
  .string({ error: "Email wajib diisi" })
  .trim()
  .toLowerCase()
  .min(1, "Email wajib diisi")
  .max(254, "Email terlalu panjang")
  .pipe(z.email({ error: "Format email tidak valid" }));

// Token mentah dari tautan email: base64url, panjang wajar (token asli 43 karakter).
const token = z
  .string({ error: "Token wajib diisi" })
  .trim()
  .min(1, "Token wajib diisi")
  .max(256, "Token tidak valid")
  .regex(/^[A-Za-z0-9_-]+$/, "Token tidak valid");

const newPassword = z
  .string({ error: "Kata sandi baru wajib diisi" })
  .min(8, "Kata sandi minimal 8 karakter")
  .max(128, "Kata sandi terlalu panjang");

// Bahasa email opsional; nilai tak dikenal tidak ditolak (bawaan id dipilih oleh pickLang).
const lang = z.string().trim().toLowerCase().max(10).optional().catch(undefined);

export const setEmailSchema = z.object({ email: emailSchema, lang });
export const forgotPasswordSchema = z.object({ email: emailSchema, lang });
export const verifyEmailSchema = z.object({ token });
export const resetPasswordSchema = z.object({ token, passwordBaru: newPassword });
export const googleSchema = z.object({
  idToken: z.string({ error: "idToken wajib diisi" }).trim().min(1, "idToken wajib diisi").max(4096, "idToken tidak valid"),
});

// [REVISI] langkah 10: tautkan Google = idToken + password akun (re-autentikasi). Password tidak di-trim.
export const googleLinkSchema = googleSchema.extend({
  password: z.string({ error: "Kata sandi wajib diisi" }).min(1, "Kata sandi wajib diisi").max(1024, "Kata sandi terlalu panjang"),
  lang,
});

function parse(schema, body) {
  const r = schema.safeParse(body ?? {});
  if (!r.success) throw new HttpError(400, r.error.issues.map((i) => i.message).join("; "));
  return r.data;
}

export const parseSetEmail = (body) => parse(setEmailSchema, body);
export const parseForgotPassword = (body) => parse(forgotPasswordSchema, body);
export const parseVerifyEmail = (body) => parse(verifyEmailSchema, body);
export const parseResetPassword = (body) => parse(resetPasswordSchema, body);
export const parseGoogle = (body) => parse(googleSchema, body);
export const parseGoogleLink = (body) => parse(googleLinkSchema, body);
