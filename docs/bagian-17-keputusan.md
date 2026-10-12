# BAGIAN 17: Auth sungguhan dan profil lahan (F1): keputusan dan sub-langkah

Branch kerja: `feat/bagian-17-auth-profil`.

## 1. Keputusan yang disetujui

1. Kolom modal/harga jual/target laba di Farm dipakai sebagai DEFAULT saja (disalin ke
   Season saat musim dibuat di bagian 18). Season tetap sumber tunggal setelahnya.
2. Tanaman dan tanggal tanam tetap di Season; tidak dihitung dalam kelengkapan.
3. Kelengkapan 12 butir disetujui.
4. pH diterima 3,0 sampai 9,0. Penanda di_luar_rentang_latih juga true bila pH di luar
   4,5 sampai 7,5; sertakan daftar alasan (mis. ["luas","ph"]).
5. Pakai jose dan cookie-parser. Pasang dengan --save-exact; pilih versi yang sudah
   dirilis lebih dari 2 minggu dan sebutkan versi yang kamu pilih.
6. Nomor HP: buang non-angka, lalu 8 sampai 15 digit.
7. Sandi minimal 8 karakter (pertahankan perilaku lama; abaikan "6" di spesifikasi).
8. Sub-langkah 11 dipersempit: hanya hook perubahan luas Farm. Hook perubahan tanaman
   ditunda ke bagian 18. Pembersihan tamu berkala ditunda; cukup hapus saat logout.
9. Tes yang butuh DB harus memakai database terpisah (agrochie_test); jangan pernah
   menjalankannya ke database kerja. Beri tahu aku cara menyiapkannya sebelum tes pertama.
10. docs/tutorial.md sudah ada sekarang; sub-langkah 12 boleh membacanya.

## 2. Sub-langkah

Satu sub-langkah = bisa diuji dan di-commit sendiri.

- [x] **1. Paket dan konfigurasi.** Pasang jose, cookie-parser, helmet, dan zod dengan versi dikunci persis. Tambah `buildEnv` di `env-parse.js` (JWT_SECRET minimal 32 karakter, masa berlaku sesi, nama cookie, alamat frontend) dan `.env.example`. Tes: `tests/env.test.js`.
- [x] **2. Migrasi `auth_profile`.** Tambah kolom `User.isGuest`, `Farm.capitalJt`, `Farm.sellPricePerKg`, `Farm.profitTargetJt`, dan `CostPlan.needsRecalc`. Hanya menambah kolom; migrasi lama tidak diubah. SQL ditunjukkan dulu sebelum diterapkan, dan database uji `agrochie_test` disiapkan terpisah.
- [x] **3. Sesi dan middleware.** Buat `utils/session.js` (buat, verifikasi, dan perbarui JWT HS256 di cookie httpOnly) serta `requireUser` baru yang mengisi `req.user = { id, role, isGuest }` dan `req.userId`. Tambah `requireRole`. Tes: tanpa sesi 401, kedaluwarsa 401, peran salah 403.
- [x] **4. Validator dan service auth.** Skema zod untuk register dan login (HP dinormalisasi 8 sampai 15 digit, sandi minimal 8), lalu endpoint login, me, logout, dan register yang langsung membuat sesi. Pesan galat login sama untuk akun tidak ada dan sandi salah; register selalu PETANI.
- [x] **5. Rate limit login.** Tambah opsi `keyFn` pada `rate-limit.js` agar bisa berbasis IP, lalu pasang 10 percobaan per 10 menit per IP pada login. Perilaku pembatas lama tidak berubah.
- [x] **6. Mode tamu.** `POST /auth/guest` membuat User sementara (`isGuest`) dengan sesi 24 jam tanpa pembaruan token. Data tamu dihapus saat logout; pembersihan berkala ditunda.
- [ ] **7. Seed petugas bank.** Tambah akun `PETUGAS_BANK` di `prisma/seed.js` dari variabel env, tanpa mencetak sandi. Register publik tidak bisa membuat peran ini.
- [ ] **8. helmet dan CORS.** Pasang `helmet` dan `cors` dengan credentials untuk alamat frontend di `app.js`, plus pengurai cookie dan opsi `trust proxy` dari env. Tes: header keamanan dan CORS.
- [ ] **9. GET dan PATCH `/api/farms/:id`.** Validator zod untuk isian profil (provinsi, NPK, pH 3,0 sampai 9,0 dengan tanggal ukur, koordinat tidak valid atau tertukar ditolak, luas 0,1 sampai 5, jenis tanah, sumber air, modal, harga, target). Hanya pemilik; milik orang lain dijawab 404.
- [ ] **10. Kelengkapan profil dan rentang latih.** Hitung kelengkapan 12 butir di service dan kembalikan persen serta daftar yang kurang. Kembalikan `di_luar_rentang_latih` dengan daftar alasan (luas > 3,0 ha, pH di luar 4,5 sampai 7,5).
- [ ] **11. Hook perubahan luas.** Bila luas Farm berubah dan ada `CostPlan` aktif, set `needsRecalc = true`. Hook perubahan tanaman ditunda ke bagian 18.
- [ ] **12. Dokumen.** Baca `docs/tutorial.md`, ganti semua contoh PowerShell yang memakai `x-user-id` dengan sesi (login lalu `-WebSession`), dan catat perbedaan dengan tutorial.
