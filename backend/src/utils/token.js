import { createHash, randomBytes } from "node:crypto";

// Token sekali pakai untuk verifikasi email dan reset password.
// Token mentah hanya dikirim lewat email; yang disimpan di DB hanya hash SHA-256-nya.
// SHA-256 cukup (bukan argon2) karena token sudah berentropi tinggi (32 byte acak).

/** Token acak 32 byte, base64url (43 karakter, aman untuk URL). */
export function generateToken() {
  return randomBytes(32).toString("base64url");
}

/** Hash SHA-256 heksadesimal (64 karakter) dari token mentah. */
export function hashToken(token) {
  return createHash("sha256").update(String(token), "utf8").digest("hex");
}

/** Buat pasangan { token, tokenHash }: kirim `token`, simpan `tokenHash`. */
export function createTokenPair() {
  const token = generateToken();
  return { token, tokenHash: hashToken(token) };
}
