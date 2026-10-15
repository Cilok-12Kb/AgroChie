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
  // [REVISI] B7: perubahan akun (API_AUTH.md 3.13-3.15)
  lastLoginMethod: 'Tidak bisa menghapus metode masuk terakhir.', // 409 email/remove, google/unlink
  phoneUnavailable: 'Nomor HP tidak dapat digunakan.', // 409 phone
  accountBusy: 'Akun sedang diproses. Coba lagi.', // 409 phone, email/remove, google/unlink
} as const;
