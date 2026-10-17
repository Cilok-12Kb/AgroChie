import { z } from "zod";
import { HttpError } from "../utils/http-error.js";
import { phoneSchema } from "./auth.validator.js";

// [REVISI] B7: validator body untuk ganti/tambah nomor HP, hapus email, dan lepas Google.
// Hanya memeriksa bentuk. Apakah password atau idToken WAJIB bergantung pada akun, jadi diputuskan di service.
// Password tidak di-trim.
const password = z
  .string({ error: "Kata sandi wajib diisi" })
  .min(1, "Kata sandi wajib diisi")
  .max(1024, "Kata sandi terlalu panjang");

const idToken = z
  .string({ error: "idToken tidak valid" })
  .min(1, "idToken wajib diisi")
  .max(4096, "idToken tidak valid");

const reauthShape = {
  password: password.optional(),
  idToken: idToken.optional(),
  lang: z.unknown().optional(),
};

const reauthSchema = z.object(reauthShape);
const phoneChangeSchema = z.object({ phone: phoneSchema, ...reauthShape });

function parse(schema, body) {
  const r = schema.safeParse(body ?? {});
  if (!r.success) throw new HttpError(400, r.error.issues.map((i) => i.message).join("; "));
  const { lang, ...rest } = r.data;
  // Ketiga bahasa antarmuka diteruskan; selain itu dibiarkan kosong (pickLang memakai bawaan).
  return { ...rest, lang: ["id", "en", "zh"].includes(lang) ? lang : undefined };
}

/** Body ganti/tambah HP: { phone (ternormalisasi), password?, idToken?, lang? }. */
export const parsePhoneChange = (body) => parse(phoneChangeSchema, body);

/** Body hapus email / lepas Google: { password?, idToken?, lang? }. */
export const parseReauth = (body) => parse(reauthSchema, body);
