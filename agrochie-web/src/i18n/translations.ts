/**
 * Kamus terjemahan AgroChie
 * Mendukung: Bahasa Indonesia (id), English (en), 中文 (zh)
 *
 * Aturan:
 *  - Tambahkan key baru ke semua 3 bahasa sekaligus.
 *  - Jangan menulis string tampilan langsung di komponen; selalu gunakan `useTranslation()`.
 *  - Untuk string dengan variabel, gunakan fungsi: (n: number) => string.
 */

export type Lang = 'id' | 'en' | 'zh';

export interface Translations {
  // ── Navigasi ───────────────────────────────────────────────────
  nav: {
    beranda: string;
    musimTanam: string;
    cekLahan: string;
    prediksiMusim: string;
    asisten: string;
    profil: string;
    rencanaBiaya: string;
    kalenderUang: string;
    cuacaLahan: string;
    deteksiTanaman: string;
    risikoKredit: string;
    catatan: string;
    riwayatMusim: string;
  };
  // ── Grup Navigasi ─────────────────────────────────────────────
  navGroup: {
    menuUtama: string;
    operasional: string;
    pendukung: string;
  };
  // ── App Shell ─────────────────────────────────────────────────
  shell: {
    tagline: string;
    seasonRunning: string;
    seasonReady: string;
    seasonDescription: string;
    farmSelectorLabel: string;
    noFarm: string;
    reminderLabel: string;
    profileLabel: string;
    logoutLabel: string;
    openMenu: string;
    closeMenu: string;
    homeLabel: string;
    workspace: string;
    apiBadge: string;
    farmerAccount: string;
    guestSession: string;
    languageLabel: string;
  };
  // ── Auth ──────────────────────────────────────────────────────
  auth: {
    layout: {
      headline: [string, string, string];
      description: string;
      audience: string;
    };
    forgot: {
      kicker: string;
      title: string;
      description: string;
      emailLabel: string;
      emailPlaceholder: string;
      emailInvalid: string;
      submit: string;
      backToLogin: string;
    };
    reset: {
      kicker: string;
      title: string;
      description: string;
      passwordLabel: string;
      passwordHint: string;
      confirmLabel: string;
      submit: string;
      show: string;
      hide: string;
      success: string;
      goLogin: string;
      noToken: string;
      linkInvalid: string;
      requestNew: string;
      problem: {
        required: string;
        tooShort: string;
        tooLong: string;
        mismatch: string;
      };
    };
    verify: {
      kicker: string;
      title: string;
      loading: string;
      success: string;
      noToken: string;
      linkInvalid: string;
      resend: string;
      resent: string;
      goLogin: string;
      goHome: string;
    };
    login: {
      kicker: string;
      title: string;
      description: string;
      identifierLabel: string;
      identifierHint: string;
      identifierPlaceholder: string;
      passwordLabel: string;
      passwordPlaceholder: string;
      passwordToggle: string;
      submit: string;
      forgotLink: string;
      guestSubmit: string;
      guestHint: string;
      noAccount: string;
      registerNow: string;
    };
    register: {
      kicker: string;
      title: string;
      description: string;
      nameLabel: string;
      namePlaceholder: string;
      phoneLabel: string;
      phoneHint: string;
      phonePlaceholder: string;
      passwordLabel: string;
      passwordPlaceholder: string;
      passwordToggle: string;
      submit: string;
      emailLabel: string;
      emailHint: string;
      emailPlaceholder: string;
      emailInvalid: string;
      emailFailed: (reason: string) => string;
      reason: {
        conflict: string;
        tooMany: string;
        sendFailed: string;
        unavailable: string;
        other: string;
      };
      goProfile: string;
      hasAccount: string;
      loginNow: string;
    };
    google: {
      divider: string;
      failed: string;
      signingIn: string;
    };
    banner: {
      noEmail: string;
      unverified: string;
      action: string;
      dismiss: string;
    };
    account: {
      title: string;
      subtitle: string;
      completeProfile: string;
      phoneLater: string;
      emailTitle: string;
      emailNone: string;
      verified: string;
      notVerified: string;
      emailLabelAdd: string;
      emailLabelChange: string;
      emailPlaceholder: string;
      emailInvalid: string;
      emailSave: string;
      emailSent: string;
      emailConflict: string;
      emailSendFailed: string;
      emailUnavailable: string;
      resend: string;
      resent: string;
      alreadyVerified: string;
    };
    link: {
      title: string;
      connected: string;
      notConnected: string;
      open: string;
      unavailable: string;
      modalTitle: string;
      step1: string;
      step2: string;
      passwordLabel: string;
      next: string;
      back: string;
      close: string;
      wrongPassword: string;
      tokenInvalid: string;
      working: string;
      success: string;
      tooMany: string;
    };
    common: {
      cooldownNote: string;
      cooldownWait: (seconds: number) => string;
      networkError: string;
      emailServiceDown: string;
    };
  };
  // ── Umum ──────────────────────────────────────────────────────
  common: {
    loading: string;
    error: string;
    retry: string;
    save: string;
    cancel: string;
    confirm: string;
    delete: string;
    edit: string;
    add: string;
    search: string;
    noData: string;
    serverError: string;
  };
  // ── Asisten AI ────────────────────────────────────────────────
  assistant: {
    title: string;
    description: string;
    conversation: string;
    conversationSubtitle: string;
    emptyTitle: string;
    emptyDetail: string;
    responding: string;
    placeholder: string;
    send: string;
    examplesTitle: string;
    examplesSubtitle: string;
    examples: string[];
    weatherNote: string;
  };
  // ── Perubahan akun (B7) ───────────────────────────────────────
  accountActions: {
    phoneTitle: string;
    phoneNone: string;
    phoneHelp: string;
    phoneLabelAdd: string;
    phoneLabelChange: string;
    phonePlaceholder: string;
    phoneSaveAdd: string;
    phoneSaveChange: string;
    phoneInvalid: string;
    phoneSame: string;
    phoneSavedAdd: string;
    phoneSavedChange: string;
    phoneTaken: string;
    emailRemove: string;
    emailRemoved: string;
    emailLastHint: string;
    googleUnlink: string;
    googleUnlinked: string;
    googleLastHint: string;
    modalPhoneTitle: string;
    modalEmailTitle: string;
    modalGoogleTitle: string;
    modalPhoneBody: string;
    modalEmailBody: string;
    modalEmailBodyNoPhone: string;
    modalGoogleBody: string;
    modalGoogleBodyRelink: string;
    reauthPasswordIntro: string;
    reauthGoogleIntro: string;
    passwordLabel: string;
    confirmPhone: string;
    confirmEmail: string;
    confirmGoogle: string;
    cancel: string;
    working: string;
    wrongPassword: string;
    wrongGoogle: string;
    tooMany: string;
    googleUnavailable: string;
    lastMethod: string;
    busy: string;
    stale: string;
  };
  // [REVISI] Negara dan provinsi bebas pada profil lahan, catatan wilayah pada prediksi
  profile: {
    country: string;
    province: string;
    provincePlaceholder: string;
  };
  prediction: {
    regionFallback: string;
  };

}

// ════════════════════════════════════════════════════════════════
// BAHASA INDONESIA
// ════════════════════════════════════════════════════════════════
const id: Translations = {
  nav: {
    beranda: 'Beranda',
    musimTanam: 'Musim tanam',
    cekLahan: 'Cek lahan',
    prediksiMusim: 'Prediksi musim',
    asisten: 'Asisten',
    profil: 'Profil',
    rencanaBiaya: 'Rencana biaya',
    kalenderUang: 'Kalender uang',
    cuacaLahan: 'Cuaca dan lahan',
    deteksiTanaman: 'Deteksi tanaman',
    risikoKredit: 'Risiko dan kredit',
    catatan: 'Catatan',
    riwayatMusim: 'Riwayat musim',
  },
  navGroup: {
    menuUtama: 'MENU UTAMA',
    operasional: 'OPERASIONAL',
    pendukung: 'PENDUKUNG',
  },
  shell: {
    tagline: 'Smart farming workspace',
    seasonRunning: 'Musim sedang berjalan',
    seasonReady: 'Siap untuk mulai',
    seasonDescription: 'Rencanakan, pantau, dan catat setiap musim.',
    farmSelectorLabel: 'Pilih lahan aktif',
    noFarm: 'Belum ada lahan',
    reminderLabel: 'Pengingat',
    profileLabel: 'Profil',
    logoutLabel: 'Keluar',
    openMenu: 'Buka menu navigasi',
    closeMenu: 'Tutup menu',
    homeLabel: 'Beranda',
    workspace: 'Workspace',
    apiBadge: 'Express API',
    farmerAccount: 'Akun petani',
    guestSession: 'Sesi tamu',
    languageLabel: 'Ganti bahasa',
  },
  auth: {
    layout: {
      headline: ['Lahan terkelola.', 'Modal terencana.', 'Musim lebih tenang.'],
      description: 'Rencanakan kebutuhan biaya dan pantau perjalanan musim tanam dalam satu workspace yang sederhana.',
      audience: 'Dibangun untuk petani cabai, tomat, dan bawang merah.',
    },
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
      kicker: 'Selamat datang kembali',
      title: 'Masuk ke akun Anda',
      description: 'Kelola lahan dan biaya musim dengan lebih mudah.',
      identifierLabel: 'Nomor HP atau email',
      identifierHint: 'Masukkan nomor HP atau email yang Anda daftarkan.',
      identifierPlaceholder: 'Contoh: 081234567890 atau nama@email.com',
      passwordLabel: 'Kata sandi',
      passwordPlaceholder: 'Masukkan kata sandi',
      passwordToggle: 'Tampilkan/sembunyikan kata sandi',
      submit: 'Masuk',
      forgotLink: 'Lupa kata sandi?',
      guestSubmit: 'Masuk sebagai tamu sementara',
      guestHint: 'Data tamu tersimpan di server dan dihapus saat logout.',
      noAccount: 'Belum punya akun?',
      registerNow: 'Daftar sekarang',
    },
    register: {
      kicker: 'Mulai perjalanan tanam',
      title: 'Buat akun petani',
      description: 'Satu tempat untuk merencanakan dan mencatat biaya tanam.',
      nameLabel: 'Nama lengkap',
      namePlaceholder: 'Nama lengkap',
      phoneLabel: 'Nomor HP',
      phoneHint: 'Gunakan 8–15 angka sesuai akun yang terdaftar.',
      phonePlaceholder: 'Contoh: 081234567890',
      passwordLabel: 'Kata sandi',
      passwordPlaceholder: 'Masukkan kata sandi',
      passwordToggle: 'Tampilkan/sembunyikan kata sandi',
      submit: 'Daftar & lanjutkan',
      emailLabel: 'Email (opsional)',
      emailHint: 'Disarankan, agar kamu bisa memulihkan kata sandi jika lupa.',
      emailPlaceholder: 'nama@email.com',
      emailInvalid: 'Format email tidak valid.',
      emailFailed: (reason) => `Akun berhasil dibuat, tetapi email belum tersimpan: ${reason}. Kamu bisa menambahkannya nanti di halaman Profil.`,
      reason: {
        conflict: 'email tidak dapat digunakan',
        tooMany: 'terlalu banyak permintaan',
        sendFailed: 'gagal mengirim email verifikasi',
        unavailable: 'layanan email belum tersedia',
        other: 'terjadi kesalahan',
      },
      goProfile: 'Lanjut ke Profil',
      hasAccount: 'Sudah memiliki akun?',
      loginNow: 'Masuk',
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
    link: {
      title: 'Google',
      connected: 'Terhubung dengan Google',
      notConnected: 'Akun ini belum terhubung dengan Google.',
      open: 'Tautkan Google',
      unavailable: 'Login Google belum tersedia saat ini.',
      modalTitle: 'Tautkan akun Google',
      step1: 'Langkah 1 dari 2: masukkan kata sandi akun Anda untuk memastikan ini benar-benar Anda.',
      step2: 'Langkah 2 dari 2: pilih akun Google yang ingin ditautkan.',
      passwordLabel: 'Kata sandi akun',
      next: 'Lanjut',
      back: 'Ubah kata sandi',
      close: 'Tutup',
      wrongPassword: 'Kata sandi salah. Coba masukkan lagi.',
      tokenInvalid: 'Akun Google tidak dapat diverifikasi. Silakan coba lagi.',
      working: 'Menautkan akun Google…',
      success: 'Akun Google berhasil ditautkan.',
      tooMany: 'Terlalu banyak percobaan menautkan Google. Coba lagi nanti.',
    },
    common: {
      cooldownNote: 'Terlalu banyak percobaan. Tunggu sebentar sebelum mencoba lagi.',
      cooldownWait: (seconds) => `Coba lagi dalam ${seconds} detik`,
      networkError: 'Tidak bisa terhubung ke server. Periksa sambungan internet lalu coba lagi.',
      emailServiceDown: 'Layanan email sedang tidak tersedia. Coba lagi nanti.',
    },
  },
  common: {
    loading: 'Memuat…',
    error: 'Terjadi kesalahan',
    retry: 'Coba lagi',
    save: 'Simpan',
    cancel: 'Batal',
    confirm: 'Konfirmasi',
    delete: 'Hapus',
    edit: 'Ubah',
    add: 'Tambah',
    search: 'Cari',
    noData: 'Belum ada data.',
    serverError: 'Pastikan Express dan PostgreSQL berjalan. Refresh setelah server siap.',
  },
  assistant: {
    title: 'Asisten AgroChie',
    description: 'Konsultasi berdasarkan data akun dan pengetahuan agronomi yang tersedia di backend.',
    conversation: 'Percakapan',
    conversationSubtitle: 'Asisten memakai data lahan dan cuaca terkini. Jika layanan gagal, pesan kesalahan akan ditampilkan.',
    emptyTitle: 'Apa yang ingin Anda tanyakan?',
    emptyDetail: 'Tanyakan rencana biaya, pengeluaran, atau istilah pertanian yang ingin dipahami.',
    responding: 'Asisten sedang merespons…',
    placeholder: 'Tulis pertanyaan…',
    send: 'Kirim',
    examplesTitle: 'Contoh pertanyaan',
    examplesSubtitle: 'Pilih untuk bertanya ke asisten.',
    examples: ['Bagaimana cuaca hari ini?', 'Besok hujan tidak?', 'Berapa biaya musim saya?', 'Apa yang paling memengaruhi biaya tani?', 'Apa langkah setelah memulai pembiayaan?', 'Bagaimana memahami pH tanah?'],
    weatherNote: 'Pertanyaan cuaca memakai koordinat lahan aktif (data Open-Meteo). Jika layanan AI atau cuaca tidak tersedia, pesan kesalahan ditampilkan tanpa jawaban simulasi.',
  },
  // ── Perubahan akun (B7) ───────────────────────────────────────
  accountActions: {
    phoneTitle: 'Nomor HP',
    phoneNone: 'Belum ada nomor HP.',
    phoneHelp: 'Nomor ini dipakai untuk masuk. Kami tidak mengirim kode SMS, jadi pastikan nomornya benar.',
    phoneLabelAdd: 'Tambah nomor HP',
    phoneLabelChange: 'Nomor HP baru',
    phonePlaceholder: '08123456789',
    phoneSaveAdd: 'Simpan nomor HP',
    phoneSaveChange: 'Ganti nomor HP',
    phoneInvalid: 'Nomor HP harus 8 sampai 15 digit.',
    phoneSame: 'Ini sudah menjadi nomor HP akunmu.',
    phoneSavedAdd: 'Nomor HP tersimpan.',
    phoneSavedChange: 'Nomor HP diganti. Perangkat lain sudah dikeluarkan.',
    phoneTaken: 'Nomor HP tidak dapat digunakan.',
    emailRemove: 'Hapus email',
    emailRemoved: 'Email dihapus. Perangkat lain sudah dikeluarkan.',
    emailLastHint: 'Email ini belum bisa dihapus karena menjadi satu-satunya cara masuk.',
    googleUnlink: 'Lepas Google',
    googleUnlinked: 'Google dilepas. Perangkat lain sudah dikeluarkan.',
    googleLastHint: 'Google belum bisa dilepas karena menjadi satu-satunya cara masuk. Atur kata sandi lewat "Lupa kata sandi" lebih dulu.',
    modalPhoneTitle: 'Ganti nomor HP?',
    modalEmailTitle: 'Hapus email?',
    modalGoogleTitle: 'Lepas akun Google?',
    modalPhoneBody: 'Nomor baru dipakai untuk masuk. Perangkat lain akan keluar dari akunmu.',
    modalEmailBody: 'Email tidak lagi dipakai untuk masuk atau mengatur ulang kata sandi. Perangkat lain akan keluar.',
    modalEmailBodyNoPhone: 'Tanpa nomor HP, kata sandimu tidak bisa dipakai masuk sampai kamu menambah nomor HP.',
    modalGoogleBody: 'Kamu tidak bisa lagi masuk dengan Google. Perangkat lain akan keluar.',
    modalGoogleBodyRelink: 'Jika email akunmu sama dengan Gmail yang tertaut, masuk dengan Google akan menautkannya kembali. Jika Gmail itu tidak aman, ganti atau hapus juga email akunmu.',
    reauthPasswordIntro: 'Masukkan kata sandimu untuk melanjutkan.',
    reauthGoogleIntro: 'Akunmu tidak memakai kata sandi. Masuk dengan akun Google yang tertaut untuk melanjutkan.',
    passwordLabel: 'Kata sandi',
    confirmPhone: 'Ya, ganti nomor',
    confirmEmail: 'Ya, hapus email',
    confirmGoogle: 'Ya, lepas Google',
    cancel: 'Batal',
    working: 'Memproses…',
    wrongPassword: 'Kata sandi salah. Coba lagi.',
    wrongGoogle: 'Akun Google tidak cocok dengan akun ini. Pilih akun Google yang tertaut.',
    tooMany: 'Terlalu banyak percobaan. Coba lagi nanti.',
    googleUnavailable: 'Verifikasi Google belum tersedia.',
    lastMethod: 'Tidak bisa menghapus metode masuk terakhir.',
    busy: 'Akun sedang diproses. Coba lagi.',
    stale: 'Data akun sudah berubah. Muat ulang halaman.',
  },
  // [REVISI] Negara dan provinsi bebas pada profil lahan, catatan wilayah pada prediksi
  profile: {
    country: 'Negara',
    province: 'Provinsi / negara bagian / wilayah',
    provincePlaceholder: 'Ketik nama wilayah',
  },
  prediction: {
    regionFallback: 'Estimasi ini memakai data rata-rata wilayah Indonesia, karena wilayah lahanmu belum ada di data latih.',
  },

};

// ════════════════════════════════════════════════════════════════
// ENGLISH
// ════════════════════════════════════════════════════════════════
const en: Translations = {
  nav: {
    beranda: 'Home',
    musimTanam: 'Growing season',
    cekLahan: 'Field check',
    prediksiMusim: 'Season forecast',
    asisten: 'Assistant',
    profil: 'Profile',
    rencanaBiaya: 'Cost plan',
    kalenderUang: 'Cash calendar',
    cuacaLahan: 'Weather & field',
    deteksiTanaman: 'Plant detection',
    risikoKredit: 'Risk & credit',
    catatan: 'Notes',
    riwayatMusim: 'Season history',
  },
  navGroup: {
    menuUtama: 'MAIN MENU',
    operasional: 'OPERATIONAL',
    pendukung: 'SUPPORT',
  },
  shell: {
    tagline: 'Smart farming workspace',
    seasonRunning: 'Season in progress',
    seasonReady: 'Ready to start',
    seasonDescription: 'Plan, monitor, and record every season.',
    farmSelectorLabel: 'Select active farm',
    noFarm: 'No farms yet',
    reminderLabel: 'Reminders',
    profileLabel: 'Profile',
    logoutLabel: 'Log out',
    openMenu: 'Open navigation menu',
    closeMenu: 'Close menu',
    homeLabel: 'Home',
    workspace: 'Workspace',
    apiBadge: 'Express API',
    farmerAccount: 'Farmer account',
    guestSession: 'Guest session',
    languageLabel: 'Change language',
  },
  auth: {
    layout: {
      headline: ['Managed fields.', 'Planned capital.', 'A calmer growing season.'],
      description: 'Plan your costs and monitor each growing season in one simple workspace.',
      audience: 'Built for chili, tomato, and shallot farmers.',
    },
    forgot: {
      kicker: 'Forgot password',
      title: 'Reset your password',
      description: 'Enter your account email. If registered and verified, we\'ll send a link to reset your password.',
      emailLabel: 'Email',
      emailPlaceholder: 'name@email.com',
      emailInvalid: 'Invalid email format.',
      submit: 'Send reset link',
      backToLogin: 'Back to login',
    },
    reset: {
      kicker: 'New password',
      title: 'Create new password',
      description: 'Choose a new password for your account. You\'ll need to log in again after.',
      passwordLabel: 'New password',
      passwordHint: '8 to 128 characters.',
      confirmLabel: 'Confirm new password',
      submit: 'Save new password',
      show: 'Show password',
      hide: 'Hide password',
      success: 'Password changed successfully. Please log in with your new password.',
      goLogin: 'Log in now',
      noToken: 'Reset link is invalid. Request a new link to continue.',
      linkInvalid: 'Reset link is invalid or has expired.',
      requestNew: 'Request new link',
      problem: {
        required: 'New password is required.',
        tooShort: 'Password must be at least 8 characters.',
        tooLong: 'Password must be at most 128 characters.',
        mismatch: 'Passwords do not match.',
      },
    },
    verify: {
      kicker: 'Email verification',
      title: 'Verify email',
      loading: 'Verifying…',
      success: 'Email verified.',
      noToken: 'Verification link is invalid.',
      linkInvalid: 'Verification link is invalid or has expired.',
      resend: 'Resend verification email',
      resent: 'Verification email sent. Check your inbox.',
      goLogin: 'Go to login',
      goHome: 'Go to home',
    },
    login: {
      kicker: 'Welcome back',
      title: 'Sign in to your account',
      description: 'Manage your fields and seasonal costs more easily.',
      identifierLabel: 'Phone number or email',
      identifierHint: 'Enter your registered phone number or email.',
      identifierPlaceholder: 'e.g. +62812... or name@email.com',
      passwordLabel: 'Password',
      passwordPlaceholder: 'Enter your password',
      passwordToggle: 'Show or hide password',
      submit: 'Sign in',
      forgotLink: 'Forgot password?',
      guestSubmit: 'Continue as a temporary guest',
      guestHint: 'Guest data is stored on the server and deleted when you sign out.',
      noAccount: 'Don\'t have an account?',
      registerNow: 'Register now',
    },
    register: {
      kicker: 'Start your growing journey',
      title: 'Create a farmer account',
      description: 'One place to plan and record your farming costs.',
      nameLabel: 'Full name',
      namePlaceholder: 'Full name',
      phoneLabel: 'Phone number',
      phoneHint: 'Use 8–15 digits matching your registered account.',
      phonePlaceholder: 'Example: 081234567890',
      passwordLabel: 'Password',
      passwordPlaceholder: 'Enter your password',
      passwordToggle: 'Show or hide password',
      submit: 'Register & continue',
      emailLabel: 'Email (optional)',
      emailHint: 'Recommended so you can recover your password if forgotten.',
      emailPlaceholder: 'name@email.com',
      emailInvalid: 'Invalid email format.',
      emailFailed: (reason) => `Account created, but email was not saved: ${reason}. You can add it later in your Profile.`,
      reason: {
        conflict: 'email cannot be used',
        tooMany: 'too many requests',
        sendFailed: 'failed to send verification email',
        unavailable: 'email service unavailable',
        other: 'an error occurred',
      },
      goProfile: 'Go to Profile',
      hasAccount: 'Already have an account?',
      loginNow: 'Sign in',
    },
    google: {
      divider: 'or',
      failed: 'Google login failed, please try again.',
      signingIn: 'Processing Google login…',
    },
    banner: {
      noEmail: 'Add an email to keep your account secure and recoverable.',
      unverified: 'Your email is not verified. Check your inbox or resend the link.',
      action: 'Open account settings',
      dismiss: 'Dismiss notification',
    },
    account: {
      title: 'Account security',
      subtitle: 'Your email and login methods.',
      completeProfile: 'Complete your profile: fill in field data below to use other features.',
      phoneLater: 'Phone number not saved yet. You can add it later.',
      emailTitle: 'Email',
      emailNone: 'No email yet.',
      verified: 'Verified',
      notVerified: 'Not verified',
      emailLabelAdd: 'Add email',
      emailLabelChange: 'Change email',
      emailPlaceholder: 'name@email.com',
      emailInvalid: 'Invalid email format.',
      emailSave: 'Send verification link',
      emailSent: 'Check your inbox to verify your email.',
      emailConflict: 'Email cannot be used.',
      emailSendFailed: 'Failed to send email, please try again.',
      emailUnavailable: 'Email service is not available yet.',
      resend: 'Resend verification email',
      resent: 'Email sent. Check your inbox.',
      alreadyVerified: 'Your email is already verified.',
    },
    link: {
      title: 'Google',
      connected: 'Connected with Google',
      notConnected: 'This account is not connected to Google.',
      open: 'Link Google',
      unavailable: 'Google login is not available at this time.',
      modalTitle: 'Link Google account',
      step1: 'Step 1 of 2: enter your account password to confirm it\'s you.',
      step2: 'Step 2 of 2: choose the Google account to link.',
      passwordLabel: 'Account password',
      next: 'Continue',
      back: 'Change password',
      close: 'Close',
      wrongPassword: 'Wrong password. Please try again.',
      tokenInvalid: 'Google account could not be verified. Please try again.',
      working: 'Linking Google account…',
      success: 'Google account linked successfully.',
      tooMany: 'Too many Google link attempts. Please try again later.',
    },
    common: {
      cooldownNote: 'Too many attempts. Please wait before trying again.',
      cooldownWait: (seconds) => `Try again in ${seconds} seconds`,
      networkError: 'Cannot connect to server. Check your internet connection and try again.',
      emailServiceDown: 'Email service is temporarily unavailable. Please try again later.',
    },
  },
  common: {
    loading: 'Loading…',
    error: 'An error occurred',
    retry: 'Retry',
    save: 'Save',
    cancel: 'Cancel',
    confirm: 'Confirm',
    delete: 'Delete',
    edit: 'Edit',
    add: 'Add',
    search: 'Search',
    noData: 'No data yet.',
    serverError: 'Make sure Express and PostgreSQL are running. Refresh once the server is ready.',
  },
  assistant: {
    title: 'AgroChie Assistant',
    description: 'Ask questions using your account data and the agronomy knowledge available on the server.',
    conversation: 'Conversation',
    conversationSubtitle: 'The assistant uses your current farm and weather data. An error message will be shown if a service fails.',
    emptyTitle: 'What would you like to ask?',
    emptyDetail: 'Ask about cost plans, expenses, or farming terms you want to understand.',
    responding: 'The assistant is responding…',
    placeholder: 'Type your question…',
    send: 'Send',
    examplesTitle: 'Example questions',
    examplesSubtitle: 'Select a question to ask the assistant.',
    examples: ['What is the weather today?', 'Will it rain tomorrow?', 'How much will my season cost?', 'What affects farming costs the most?', 'What should I do after starting financing?', 'How should I interpret soil pH?'],
    weatherNote: 'Weather questions use the active farm coordinates (Open-Meteo data). If the AI or weather service is unavailable, an error is shown without a simulated answer.',
  },
  // ── Account changes (B7) ──────────────────────────────────────
  accountActions: {
    phoneTitle: 'Phone number',
    phoneNone: 'No phone number yet.',
    phoneHelp: 'This number is used to sign in. We do not send an SMS code, so make sure it is correct.',
    phoneLabelAdd: 'Add phone number',
    phoneLabelChange: 'New phone number',
    phonePlaceholder: '08123456789',
    phoneSaveAdd: 'Save phone number',
    phoneSaveChange: 'Change phone number',
    phoneInvalid: 'Phone number must be 8 to 15 digits.',
    phoneSame: 'This is already your phone number.',
    phoneSavedAdd: 'Phone number saved.',
    phoneSavedChange: 'Phone number changed. Other devices were signed out.',
    phoneTaken: 'This phone number cannot be used.',
    emailRemove: 'Remove email',
    emailRemoved: 'Email removed. Other devices were signed out.',
    emailLastHint: 'This email cannot be removed yet because it is your only way to sign in.',
    googleUnlink: 'Unlink Google',
    googleUnlinked: 'Google unlinked. Other devices were signed out.',
    googleLastHint: 'Google cannot be unlinked yet because it is your only way to sign in. Set a password with "Forgot password" first.',
    modalPhoneTitle: 'Change phone number?',
    modalEmailTitle: 'Remove email?',
    modalGoogleTitle: 'Unlink Google account?',
    modalPhoneBody: 'The new number will be used to sign in. Other devices will be signed out.',
    modalEmailBody: 'This email will no longer be used to sign in or reset your password. Other devices will be signed out.',
    modalEmailBodyNoPhone: 'Without a phone number, your password cannot be used to sign in until you add one.',
    modalGoogleBody: 'You will no longer be able to sign in with Google. Other devices will be signed out.',
    modalGoogleBodyRelink: 'If your account email is the same as the linked Gmail, signing in with Google will link it again. If that Gmail is not secure, also change or remove your account email.',
    reauthPasswordIntro: 'Enter your password to continue.',
    reauthGoogleIntro: 'Your account has no password. Sign in with the linked Google account to continue.',
    passwordLabel: 'Password',
    confirmPhone: 'Yes, change number',
    confirmEmail: 'Yes, remove email',
    confirmGoogle: 'Yes, unlink Google',
    cancel: 'Cancel',
    working: 'Working…',
    wrongPassword: 'Wrong password. Try again.',
    wrongGoogle: 'This Google account does not match your account. Choose the linked one.',
    tooMany: 'Too many attempts. Try again later.',
    googleUnavailable: 'Google verification is not available yet.',
    lastMethod: 'You cannot remove your last sign-in method.',
    busy: 'Your account is being updated. Try again.',
    stale: 'Your account data changed. Reload the page.',
  },
  // [REVISI] Country and free-text region on the farm profile, region note on predictions
  profile: {
    country: 'Country',
    province: 'Province / state / region',
    provincePlaceholder: 'Type your region',
  },
  prediction: {
    regionFallback: 'This estimate uses average Indonesian regional data because your region is not in the training data.',
  },

};

// ════════════════════════════════════════════════════════════════
// 中文 (MANDARIN)
// ════════════════════════════════════════════════════════════════
const zh: Translations = {
  nav: {
    beranda: '主页',
    musimTanam: '种植季节',
    cekLahan: '田地检查',
    prediksiMusim: '季节预测',
    asisten: '助手',
    profil: '个人资料',
    rencanaBiaya: '费用计划',
    kalenderUang: '资金日历',
    cuacaLahan: '天气与田地',
    deteksiTanaman: '植物检测',
    risikoKredit: '风险与信贷',
    catatan: '笔记',
    riwayatMusim: '季节历史',
  },
  navGroup: {
    menuUtama: '主菜单',
    operasional: '运营',
    pendukung: '支持',
  },
  shell: {
    tagline: '智慧农业工作台',
    seasonRunning: '季节进行中',
    seasonReady: '准备开始',
    seasonDescription: '规划、监控并记录每个季节。',
    farmSelectorLabel: '选择当前农场',
    noFarm: '暂无农场',
    reminderLabel: '提醒',
    profileLabel: '个人资料',
    logoutLabel: '退出登录',
    openMenu: '打开导航菜单',
    closeMenu: '关闭菜单',
    homeLabel: '主页',
    workspace: '工作台',
    apiBadge: 'Express API',
    farmerAccount: '农民账户',
    guestSession: '访客会话',
    languageLabel: '切换语言',
  },
  auth: {
    layout: {
      headline: ['农田管理有序。', '资金规划清晰。', '种植季更安心。'],
      description: '在一个简单的工作台中规划成本并跟踪整个种植季。',
      audience: '专为辣椒、番茄和红葱种植户打造。',
    },
    forgot: {
      kicker: '忘记密码',
      title: '重置密码',
      description: '输入您的账户邮箱。若已注册并验证，我们将发送重置链接。',
      emailLabel: '邮箱',
      emailPlaceholder: 'name@email.com',
      emailInvalid: '邮箱格式无效。',
      submit: '发送重置链接',
      backToLogin: '返回登录',
    },
    reset: {
      kicker: '新密码',
      title: '创建新密码',
      description: '为您的账户选择新密码。成功后需要重新登录。',
      passwordLabel: '新密码',
      passwordHint: '8至128个字符。',
      confirmLabel: '确认新密码',
      submit: '保存新密码',
      show: '显示密码',
      hide: '隐藏密码',
      success: '密码已成功更改。请使用新密码登录。',
      goLogin: '立即登录',
      noToken: '重置链接无效。请申请新链接继续。',
      linkInvalid: '重置链接无效或已过期。',
      requestNew: '申请新链接',
      problem: {
        required: '新密码为必填项。',
        tooShort: '密码至少需要8个字符。',
        tooLong: '密码最多128个字符。',
        mismatch: '密码不匹配。',
      },
    },
    verify: {
      kicker: '邮箱验证',
      title: '验证邮箱',
      loading: '验证中…',
      success: '邮箱已验证。',
      noToken: '验证链接无效。',
      linkInvalid: '验证链接无效或已过期。',
      resend: '重新发送验证邮件',
      resent: '验证邮件已发送。请检查您的收件箱。',
      goLogin: '前往登录',
      goHome: '前往主页',
    },
    login: {
      kicker: '欢迎回来',
      title: '登录您的账户',
      description: '更轻松地管理农田和种植季成本。',
      identifierLabel: '手机号码或邮箱',
      identifierHint: '输入您注册的手机号码或邮箱。',
      identifierPlaceholder: '例如：+62812... 或 name@email.com',
      passwordLabel: '密码',
      passwordPlaceholder: '输入密码',
      passwordToggle: '显示或隐藏密码',
      submit: '登录',
      forgotLink: '忘记密码？',
      guestSubmit: '以临时访客身份进入',
      guestHint: '访客数据保存在服务器上，并在退出登录时删除。',
      noAccount: '还没有账户？',
      registerNow: '立即注册',
    },
    register: {
      kicker: '开启您的种植之旅',
      title: '创建农民账户',
      description: '在一个地方规划和记录种植成本。',
      nameLabel: '姓名',
      namePlaceholder: '姓名',
      phoneLabel: '手机号码',
      phoneHint: '请输入与注册账户一致的8至15位数字。',
      phonePlaceholder: '例如：081234567890',
      passwordLabel: '密码',
      passwordPlaceholder: '输入密码',
      passwordToggle: '显示或隐藏密码',
      submit: '注册并继续',
      emailLabel: '邮箱（可选）',
      emailHint: '建议填写，以便忘记密码时找回账户。',
      emailPlaceholder: 'name@email.com',
      emailInvalid: '邮箱格式无效。',
      emailFailed: (reason) => `账户创建成功，但邮箱未保存：${reason}。您可以稍后在个人资料页面添加。`,
      reason: {
        conflict: '该邮箱无法使用',
        tooMany: '请求过多',
        sendFailed: '发送验证邮件失败',
        unavailable: '邮件服务暂不可用',
        other: '发生错误',
      },
      goProfile: '前往个人资料',
      hasAccount: '已有账户？',
      loginNow: '登录',
    },
    google: {
      divider: '或',
      failed: 'Google登录失败，请重试。',
      signingIn: '正在处理Google登录…',
    },
    banner: {
      noEmail: '添加邮箱以确保账户安全且可找回。',
      unverified: '您的邮箱尚未验证。请检查收件箱或重新发送链接。',
      action: '打开账户设置',
      dismiss: '关闭通知',
    },
    account: {
      title: '账户安全',
      subtitle: '您的邮箱和登录方式。',
      completeProfile: '完善您的个人资料：填写下方田地数据以使用其他功能。',
      phoneLater: '手机号码尚未保存。您可以稍后添加。',
      emailTitle: '邮箱',
      emailNone: '暂无邮箱。',
      verified: '已验证',
      notVerified: '未验证',
      emailLabelAdd: '添加邮箱',
      emailLabelChange: '更换邮箱',
      emailPlaceholder: 'name@email.com',
      emailInvalid: '邮箱格式无效。',
      emailSave: '发送验证链接',
      emailSent: '请检查您的邮箱收件箱以验证。',
      emailConflict: '该邮箱无法使用。',
      emailSendFailed: '发送邮件失败，请重试。',
      emailUnavailable: '邮件服务暂不可用。',
      resend: '重新发送验证邮件',
      resent: '邮件已发送。请检查您的收件箱。',
      alreadyVerified: '您的邮箱已验证。',
    },
    link: {
      title: 'Google',
      connected: '已与Google连接',
      notConnected: '此账户尚未与Google连接。',
      open: '关联Google',
      unavailable: '目前无法使用Google登录。',
      modalTitle: '关联Google账户',
      step1: '第1步，共2步：输入您的账户密码以确认身份。',
      step2: '第2步，共2步：选择要关联的Google账户。',
      passwordLabel: '账户密码',
      next: '继续',
      back: '更改密码',
      close: '关闭',
      wrongPassword: '密码错误。请重试。',
      tokenInvalid: 'Google账户无法验证。请重试。',
      working: '正在关联Google账户…',
      success: 'Google账户关联成功。',
      tooMany: 'Google关联尝试次数过多。请稍后再试。',
    },
    common: {
      cooldownNote: '尝试次数过多。请稍等后再试。',
      cooldownWait: (seconds) => `${seconds}秒后重试`,
      networkError: '无法连接到服务器。请检查网络连接后重试。',
      emailServiceDown: '邮件服务暂时不可用。请稍后再试。',
    },
  },
  common: {
    loading: '加载中…',
    error: '发生错误',
    retry: '重试',
    save: '保存',
    cancel: '取消',
    confirm: '确认',
    delete: '删除',
    edit: '编辑',
    add: '添加',
    search: '搜索',
    noData: '暂无数据。',
    serverError: '请确保Express和PostgreSQL正在运行。服务器准备好后刷新页面。',
  },
  assistant: {
    title: 'AgroChie 助手',
    description: '根据您的账户数据和服务器中的农学知识提供咨询。',
    conversation: '对话',
    conversationSubtitle: '助手会使用当前农田和天气数据。如果服务失败，将显示错误信息。',
    emptyTitle: '您想问什么？',
    emptyDetail: '您可以询问成本计划、支出或想了解的农业术语。',
    responding: '助手正在回复…',
    placeholder: '输入您的问题…',
    send: '发送',
    examplesTitle: '问题示例',
    examplesSubtitle: '选择一个问题向助手提问。',
    examples: ['今天天气怎么样？', '明天会下雨吗？', '这个种植季需要多少成本？', '哪些因素最影响种植成本？', '开始融资后下一步该做什么？', '如何理解土壤酸碱度？'],
    weatherNote: '天气问题会使用当前农田的坐标（Open-Meteo 数据）。如果 AI 或天气服务不可用，系统会显示错误，不会生成模拟答案。',
  },
  // ── Perubahan akun (B7) ───────────────────────────────────────
  accountActions: {
    phoneTitle: '手机号码',
    phoneNone: '尚未添加手机号码。',
    phoneHelp: '此号码用于登录。我们不会发送短信验证码，请确认号码无误。',
    phoneLabelAdd: '添加手机号码',
    phoneLabelChange: '新手机号码',
    phonePlaceholder: '08123456789',
    phoneSaveAdd: '保存手机号码',
    phoneSaveChange: '更换手机号码',
    phoneInvalid: '手机号码必须为8到15位数字。',
    phoneSame: '这已经是你当前的手机号码。',
    phoneSavedAdd: '手机号码已保存。',
    phoneSavedChange: '手机号码已更换，其他设备已退出登录。',
    phoneTaken: '无法使用此手机号码。',
    emailRemove: '删除邮箱',
    emailRemoved: '邮箱已删除，其他设备已退出登录。',
    emailLastHint: '暂时无法删除此邮箱，因为它是你唯一的登录方式。',
    googleUnlink: '解除 Google 绑定',
    googleUnlinked: '已解除 Google 绑定，其他设备已退出登录。',
    googleLastHint: '暂时无法解除 Google 绑定，因为它是你唯一的登录方式。请先通过“忘记密码”设置密码。',
    modalPhoneTitle: '更换手机号码？',
    modalEmailTitle: '删除邮箱？',
    modalGoogleTitle: '解除 Google 账号绑定？',
    modalPhoneBody: '新号码将用于登录，其他设备将退出登录。',
    modalEmailBody: '此邮箱将不再用于登录或重置密码，其他设备将退出登录。',
    modalEmailBodyNoPhone: '没有手机号码时，你的密码将无法用于登录，直到你添加号码。',
    modalGoogleBody: '你将无法再使用 Google 登录，其他设备将退出登录。',
    modalGoogleBodyRelink: '如果你的账号邮箱与已绑定的 Gmail 相同，使用 Google 登录会重新绑定该账号。如果该 Gmail 不安全，请同时更换或删除账号邮箱。',
    reauthPasswordIntro: '请输入密码以继续。',
    reauthGoogleIntro: '你的账号没有密码。请使用已绑定的 Google 账号验证以继续。',
    passwordLabel: '密码',
    confirmPhone: '是，更换号码',
    confirmEmail: '是，删除邮箱',
    confirmGoogle: '是，解除绑定',
    cancel: '取消',
    working: '处理中…',
    wrongPassword: '密码错误，请重试。',
    wrongGoogle: 'Google 账号与此账号不匹配，请选择已绑定的账号。',
    tooMany: '尝试次数过多，请稍后再试。',
    googleUnavailable: 'Google 验证暂不可用。',
    lastMethod: '无法删除最后一种登录方式。',
    busy: '账号正在处理，请重试。',
    stale: '账号数据已变化，请刷新页面。',
  },
  // [REVISI] 地块资料中的国家与自由输入地区，以及预测中的地区说明
  profile: {
    country: '国家/地区',
    province: '省/州/地区',
    provincePlaceholder: '输入所在地区',
  },
  prediction: {
    regionFallback: '此估算使用印度尼西亚地区平均数据，因为您所在地区不在训练数据中。',
  },

};

// ════════════════════════════════════════════════════════════════
// Export
// ════════════════════════════════════════════════════════════════
export const translations: Record<Lang, Translations> = { id, en, zh };

export const LANG_OPTIONS: { value: Lang; label: string; nativeLabel: string; flag: string }[] = [
  { value: 'id', label: 'Bahasa Indonesia', nativeLabel: 'Indonesia', flag: '🇮🇩' },
  { value: 'en', label: 'English',          nativeLabel: 'English',   flag: '🇬🇧' },
  { value: 'zh', label: 'Mandarin',         nativeLabel: '中文',       flag: '🇨🇳' },
];
