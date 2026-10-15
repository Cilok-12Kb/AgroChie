/**
 * Teks pesan dari backend yang dicocokkan oleh frontend (selalu bersama status HTTP-nya).
 * Satu-satunya tempat teks ini ditulis. Bila backend mengubah/menerjemahkan pesannya,
 * ubah di sini saja. Sumber: backend/API_AUTH.md.
 */
export const SERVER_MSG = {
  resetLinkInvalid: 'Tautan reset tidak valid atau sudah kedaluwarsa', // 400 reset-password
  verifyLinkInvalid: 'Tautan verifikasi tidak valid atau sudah kedaluwarsa', // 400 verify-email
  emailAlreadyVerified: 'Email sudah terverifikasi', // 400 resend-verification
  wrongPassword: 'Kata sandi salah', // 401 google/link
  googleTokenInvalid: 'Token Google tidak valid', // 401 google & google/link
} as const;
