/**
 * Semua teks BARU untuk fitur auth dikumpulkan di sini (satu tempat untuk diterjemahkan).
 * Komponen auth mengimpor `copy`; jangan menulis teks tampilan langsung di komponen.
 * Pesan galat dari server ditampilkan apa adanya (bukan di sini).
 */

/** Bahasa untuk field `lang` di API ("id" | "en"). Ganti isi fungsi ini saat sistem terjemahan siap. */
export type Lang = 'id' | 'en';
export function currentLang(): Lang {
  return 'id';
}

export const copy = {
  login: {
    identifierLabel: 'Nomor HP atau email',
    identifierHint: 'Masukkan nomor HP atau email yang Anda daftarkan.',
    identifierPlaceholder: 'Contoh: 081234567890 atau nama@email.com',
    forgotLink: 'Lupa kata sandi?',
  },
  common: {
    cooldownNote: 'Terlalu banyak percobaan. Tunggu sebentar sebelum mencoba lagi.',
    cooldownWait: (seconds: number) => `Coba lagi dalam ${seconds} detik`,
    networkError: 'Tidak bisa terhubung ke server. Periksa sambungan internet lalu coba lagi.',
    emailServiceDown: 'Layanan email sedang tidak tersedia. Coba lagi nanti.',
  },
};
