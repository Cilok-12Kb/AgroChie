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
  forgot: {
    kicker: 'Lupa kata sandi',
    title: 'Atur ulang kata sandi',
    description: 'Masukkan email akun Anda. Jika terdaftar dan sudah terverifikasi, kami kirim tautan untuk mengatur ulang kata sandi.',
    emailLabel: 'Email',
    emailPlaceholder: 'nama@email.com',
    emailInvalid: 'Format email tidak valid.',
    submit: 'Kirim tautan reset',
    backToLogin: 'Kembali ke halaman masuk',
  },
  reset: {
    kicker: 'Kata sandi baru',
    title: 'Buat kata sandi baru',
    description: 'Pilih kata sandi baru untuk akun Anda. Setelah berhasil, Anda perlu masuk kembali.',
    passwordLabel: 'Kata sandi baru',
    passwordHint: '8 sampai 128 karakter.',
    confirmLabel: 'Ulangi kata sandi baru',
    submit: 'Simpan kata sandi baru',
    show: 'Tampilkan kata sandi',
    hide: 'Sembunyikan kata sandi',
    success: 'Kata sandi berhasil diganti. Silakan masuk dengan kata sandi baru.',
    goLogin: 'Masuk sekarang',
    noToken: 'Tautan reset tidak valid. Minta tautan baru untuk melanjutkan.',
    linkInvalid: 'Tautan reset tidak valid atau sudah kedaluwarsa.',
    requestNew: 'Minta tautan baru',
    problem: {
      required: 'Kata sandi baru wajib diisi.',
      tooShort: 'Kata sandi minimal 8 karakter.',
      tooLong: 'Kata sandi maksimal 128 karakter.',
      mismatch: 'Konfirmasi kata sandi tidak sama.',
    },
  },
  verify: {
    kicker: 'Verifikasi email',
    title: 'Verifikasi email',
    loading: 'Memverifikasi…',
    success: 'Email terverifikasi.',
    noToken: 'Tautan verifikasi tidak valid.',
    linkInvalid: 'Tautan verifikasi tidak valid atau sudah kedaluwarsa.',
    resend: 'Kirim ulang email verifikasi',
    resent: 'Email verifikasi terkirim. Periksa kotak masuk Anda.',
    goLogin: 'Masuk ke akun',
    goHome: 'Buka beranda',
  },
  login: {
    identifierLabel: 'Nomor HP atau email',
    identifierHint: 'Masukkan nomor HP atau email yang Anda daftarkan.',
    identifierPlaceholder: 'Contoh: 081234567890 atau nama@email.com',
    forgotLink: 'Lupa kata sandi?',
  },
  google: {
    divider: 'atau',
    failed: 'Login Google gagal, coba lagi.',
    signingIn: 'Memproses login Google…',
  },
  banner: {
    noEmail: 'Tambahkan email agar akun lebih aman dan bisa dipulihkan.',
    unverified: 'Email Anda belum diverifikasi. Cek kotak masuk atau kirim ulang tautan.',
    action: 'Buka pengaturan akun',
    dismiss: 'Tutup pengumuman',
  },
  account: {
    title: 'Keamanan akun',
    subtitle: 'Email dan metode masuk akun Anda.',
    completeProfile: 'Lengkapi profil Anda: isi data lahan di bawah agar fitur lain bisa dipakai.',
    phoneLater: 'Nomor HP belum tersimpan. Anda bisa menambahkannya nanti.',
    emailTitle: 'Email',
    emailNone: 'Belum ada email.',
    verified: 'Terverifikasi',
    notVerified: 'Belum terverifikasi',
    emailLabelAdd: 'Tambah email',
    emailLabelChange: 'Ganti email',
    emailPlaceholder: 'nama@email.com',
    emailInvalid: 'Format email tidak valid.',
    emailSave: 'Kirim tautan verifikasi',
    emailSent: 'Cek kotak masuk email Anda untuk memverifikasi.',
    emailConflict: 'Email tidak dapat digunakan.',
    emailSendFailed: 'Gagal mengirim email, coba lagi.',
    emailUnavailable: 'Layanan email belum tersedia.',
    resend: 'Kirim ulang email verifikasi',
    resent: 'Email terkirim. Cek kotak masuk Anda.',
    alreadyVerified: 'Email Anda sudah terverifikasi.',
  },
  common: {
    cooldownNote: 'Terlalu banyak percobaan. Tunggu sebentar sebelum mencoba lagi.',
    cooldownWait: (seconds: number) => `Coba lagi dalam ${seconds} detik`,
    networkError: 'Tidak bisa terhubung ke server. Periksa sambungan internet lalu coba lagi.',
    emailServiceDown: 'Layanan email sedang tidak tersedia. Coba lagi nanti.',
  },
};
