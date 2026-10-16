# Kontrak API Auth AgroChie (untuk tim frontend)

Sumber kebenaran: KODE di `backend/src` (routes, controllers, services, validators, middleware). Bila dokumen ini berbeda dengan kode, ikuti kode dan laporkan ke tim backend.

## Daftar isi
1. Ringkasan
2. Objek user publik
3. Endpoint auth
4. Alur per halaman frontend
5. Aturan global frontend
6. Tombol Google Identity Services di Next.js
7. Variabel `.env` backend
8. Ringkasan keamanan
9. Keterbatasan yang diketahui
10. Panduan uji manual

---

## 1. Ringkasan

- Base URL: `http://localhost:3000/api` (semua path di bawah relatif terhadap `/api`).
- Sesi: JWT di cookie **httpOnly** bernama `agro_session` (`sameSite=lax`, `secure` hanya di production). JavaScript frontend tidak bisa membacanya.
- Setiap `fetch` ke backend WAJIB memakai `credentials: "include"`.
- CORS hanya mengizinkan origin `FRONTEND_ORIGIN` (bawaan `http://localhost:3001`).
- Format error SEMUA endpoint: `{ "error": "pesan" }` dengan status HTTP sesuai tabel. Frontend cukup menampilkan `error`.
- Error umum di luar tabel: `500 { "error": "Terjadi kesalahan di server" }`, `404 { "error": "Rute tidak ditemukan" }`.
- Sesi biasa berlaku 7 hari (diperpanjang otomatis bila sisa < separuh), sesi tamu 24 jam.

## 2. Objek user publik

Dipakai oleh `register`, `login`, `GET /auth/me`, `POST /auth/google`, `POST /auth/google/link`, `POST /auth/email`, `POST /auth/phone`, `POST /auth/email/remove`, dan `POST /auth/google/unlink`. (`guest` hanya mengembalikan `{ "user": { id, name, role, isGuest } }`.)

```json
{
  "id": "clx...",
  "name": "Budi",
  "phone": "081234567890",
  "email": "budi@contoh.id",
  "emailVerified": true,
  "hasPassword": true,
  "hasGoogle": false,
  "role": "PETANI",
  "isGuest": false,
  "needsProfileCompletion": false
}
```

| Field | Arti |
|---|---|
| `id` | ID user. |
| `name` | Nama tampilan. |
| `phone` | Nomor HP (hanya digit) atau `null` (mis. akun Google baru). |
| `email` | Email (huruf kecil) atau `null`. |
| `emailVerified` | `true` bila email sudah diverifikasi. |
| `hasPassword` | `true` bila akun punya kata sandi. Akun Google-only: `false`. |
| `hasGoogle` | `true` bila akun sudah tertaut Google. |
| `role` | Peran, mis. `PETANI`. |
| `isGuest` | `true` untuk akun tamu. |
| `needsProfileCompletion` | `true` bila BUKAN tamu dan (belum punya nomor HP ATAU belum punya lahan). Tamu selalu `false`. |

Hash kata sandi, `googleId`, dan `sessionVersion` TIDAK pernah dikirim ke klien.

## 3. Endpoint auth

Kolom "Login" = wajib punya sesi. Rate limit disimpan di memori, kunci per IP kecuali disebut lain; melebihi batas membalas `429` dengan pesan pada tabel.

### 3.1 `POST /auth/register`
| | |
|---|---|
| Login | Tidak |
| Body | `{ "name": string (1-100), "phone": string (8-15 digit setelah non-angka dibuang), "password": string (8-128) }` |
| Sukses | `201` + objek user publik; cookie sesi diset |
| Rate limit | Tidak ada |

| Status | Pesan |
|---|---|
| 400 | `Nama wajib diisi` / `Nama terlalu panjang` / `Nomor HP wajib diisi` / `Nomor HP harus 8 sampai 15 digit` / `Kata sandi wajib diisi` / `Kata sandi minimal 8 karakter` / `Kata sandi terlalu panjang` (beberapa pesan digabung `; `) |
| 409 | `Nomor HP sudah terdaftar` |

### 3.2 `POST /auth/login`
| | |
|---|---|
| Login | Tidak |
| Body | `{ "identifier": string, "password": string (1-128) }`. `identifier` berisi nomor HP ATAU email (bila mengandung `@` dianggap email). Field lama `phone` masih diterima sebagai pengganti `identifier`. |
| Sukses | `200` + objek user publik; cookie sesi diset |
| Rate limit | 10 per 10 menit per IP: `Terlalu banyak percobaan masuk. Coba lagi beberapa menit lagi.` |

| Status | Pesan |
|---|---|
| 400 | `Nomor HP atau email wajib diisi` / `Nomor HP atau email terlalu panjang` / `Nomor HP harus 8 sampai 15 digit` / `Format email tidak valid` / `Kata sandi wajib diisi` / `Kata sandi terlalu panjang` |
| 401 | `Nomor HP/email atau kata sandi salah` (sama untuk akun tidak ada, sandi salah, dan akun Google-only) |
| 429 | pesan rate limit di atas |

### 3.3 `GET /auth/me`
| | |
|---|---|
| Login | Ya |
| Body | - |
| Sukses | `200` + objek user publik |
| Rate limit | Tidak ada |

| Status | Pesan |
|---|---|
| 401 | `Belum masuk` (tanpa cookie, token kedaluwarsa, atau sesi dicabut setelah reset password) |

### 3.4 `POST /auth/logout`
| | |
|---|---|
| Login | Opsional (selalu berhasil) |
| Body | - |
| Sukses | `204` tanpa isi; cookie dihapus. Bila sesi adalah tamu, akun tamu ikut dihapus. |
| Error | Tidak ada khusus |

### 3.5 `POST /auth/guest`
| | |
|---|---|
| Login | Tidak |
| Body | - |
| Sukses | `201 { "user": { "id", "name", "role", "isGuest": true } }`; cookie sesi tamu 24 jam |
| Rate limit | 20 per jam per IP: `Terlalu banyak sesi tamu dari alamat ini. Coba lagi nanti.` |

| Status | Pesan |
|---|---|
| 429 | pesan rate limit di atas |

Panggil `GET /auth/me` bila butuh objek user lengkap.

### 3.6 `POST /auth/email` (tambah/ganti email, kirim tautan verifikasi)
| | |
|---|---|
| Login | Ya |
| Body | `{ "email": string, "lang"?: "id" \| "en" \| "zh" }` (email di-trim + huruf kecil, maks 254) |
| Sukses | `200` + objek user publik (`emailVerified` `false` sampai tautan diklik). Bila email sama dan sudah terverifikasi: `200` tanpa kirim email. |
| Rate limit | 10 per 15 menit per IP: `Terlalu banyak permintaan email dari alamat ini. Coba lagi nanti.` Selain itu, bila email sama dan belum terverifikasi: maks 3 permintaan per jam per user. |

| Status | Pesan |
|---|---|
| 400 | `Email wajib diisi` / `Email terlalu panjang` / `Format email tidak valid` |
| 401 | `Belum masuk` |
| 403 | `Akun tamu tidak dapat memakai email` |
| 409 | `Email tidak dapat digunakan` |
| 429 | pesan rate limit di atas, atau `Terlalu banyak permintaan verifikasi. Coba lagi dalam satu jam.` |
| 502 | `Gagal mengirim email verifikasi. Coba lagi nanti.` (token dicabut, boleh coba lagi) |
| 503 | `Layanan email belum dikonfigurasi` |

Mengganti email membuat `emailVerified` kembali `false`. Urutan di server: rate limit IP, cek login, validasi body.

### 3.7 `POST /auth/email/resend-verification`
| | |
|---|---|
| Login | Ya |
| Body | `{ "lang"?: "id" \| "en" \| "zh" }` (boleh kosong) |
| Sukses | `202 { "ok": true }` |
| Rate limit | Sama dengan 3.6 (10 per 15 menit per IP) dan maks 3 per jam per user |

| Status | Pesan |
|---|---|
| 400 | `Belum ada email di akun ini` / `Email sudah terverifikasi` |
| 401 | `Belum masuk` |
| 403 | `Akun tamu tidak dapat memakai email` |
| 429 | `Terlalu banyak permintaan email dari alamat ini. Coba lagi nanti.` / `Terlalu banyak permintaan verifikasi. Coba lagi dalam satu jam.` |
| 502 | `Gagal mengirim email verifikasi. Coba lagi nanti.` |
| 503 | `Layanan email belum dikonfigurasi` |

### 3.8 `POST /auth/verify-email`
| | |
|---|---|
| Login | Tidak (tautan sering dibuka di browser/perangkat lain) |
| Body | `{ "token": string }` (dari query `?token=` pada tautan email) |
| Sukses | `200 { "ok": true }` |
| Rate limit | 20 per 15 menit per IP: `Terlalu banyak percobaan verifikasi. Coba lagi nanti.` |

| Status | Pesan |
|---|---|
| 400 | `Token wajib diisi` / `Token tidak valid` (format salah) / `Tautan verifikasi tidak valid atau sudah kedaluwarsa` (token tidak ada, kedaluwarsa, sudah dipakai, atau email akun sudah berubah) |
| 429 | pesan rate limit di atas |

Token sekali pakai: panggilan kedua dengan token yang sama menghasilkan 400.

### 3.9 `POST /auth/forgot-password`
| | |
|---|---|
| Login | Tidak |
| Body | `{ "email": string, "lang"?: "id" \| "en" \| "zh" }` |
| Sukses | `202 { "ok": true, "message": "Jika email terdaftar dan sudah terverifikasi, tautan reset kata sandi akan dikirim." }`. Respons SAMA untuk email terdaftar, tidak terdaftar, atau belum terverifikasi. |
| Rate limit | 5 per 15 menit per IP: `Terlalu banyak permintaan reset kata sandi. Coba lagi nanti.` Selain itu maks 3 token reset per jam per akun (diam-diam, tetap 202). |

| Status | Pesan |
|---|---|
| 400 | `Email wajib diisi` / `Email terlalu panjang` / `Format email tidak valid` (hanya karena format) |
| 429 | pesan rate limit di atas |
| 503 | `Layanan email belum dikonfigurasi` |

Email dikirim di latar setelah respons; kegagalan kirim tidak terlihat oleh klien. Akun tamu dan email belum terverifikasi tidak menerima tautan. Akun Google-only dengan email terverifikasi boleh mengatur kata sandi lewat alur ini.

### 3.10 `POST /auth/reset-password`
| | |
|---|---|
| Login | Tidak |
| Body | `{ "token": string, "passwordBaru": string (8-128), "lang"?: "id" \| "en" \| "zh" }` |
| Sukses | `200 { "ok": true }`. Semua sesi lama dicabut, cookie dihapus. TIDAK login otomatis: arahkan ke halaman login. Email pemberitahuan dikirim ke pemilik akun. |
| Rate limit | 10 per 15 menit per IP: `Terlalu banyak percobaan reset kata sandi. Coba lagi nanti.` |

| Status | Pesan |
|---|---|
| 400 | `Token wajib diisi` / `Token tidak valid` / `Kata sandi baru wajib diisi` / `Kata sandi minimal 8 karakter` / `Kata sandi terlalu panjang` / `Tautan reset tidak valid atau sudah kedaluwarsa` (token tidak ada, kedaluwarsa [30 menit], atau sudah dipakai) |
| 429 | pesan rate limit di atas |

### 3.11 `POST /auth/google` (masuk / daftar dengan Google)
| | |
|---|---|
| Login | Tidak |
| Body | `{ "idToken": string }` (nilai `credential` dari Google Identity Services, maks 4096 karakter) |
| Sukses | `200` + objek user publik (login, atau penautan otomatis ke akun yang emailnya terverifikasi), atau `201` + objek user publik (akun baru). Cookie sesi diset dan menggantikan sesi lama (termasuk tamu). Periksa `needsProfileCompletion`. |
| Rate limit | 20 per 15 menit per IP: `Terlalu banyak percobaan masuk dengan Google. Coba lagi nanti.` |

| Status | Pesan |
|---|---|
| 400 | `idToken wajib diisi` / `idToken tidak valid` |
| 401 | `Token Google tidak valid` (tanda tangan, kedaluwarsa, `aud`, `iss`, atau `email_verified` tidak sesuai) |
| 409 | `Email sudah terdaftar tetapi belum terverifikasi. Masuk dengan metode lain lalu verifikasi emailmu.` / `Email ini sudah tertaut ke akun Google lain.` / `Akun sedang diproses. Coba masuk lagi.` |
| 429 | pesan rate limit di atas |
| 503 | `Login Google belum dikonfigurasi` |

Aturan akun: (a) `googleId` sudah dikenal → login; (b) email cocok dan terverifikasi → tautkan otomatis; (c) email cocok tetapi belum terverifikasi → 409; (d) tidak ada yang cocok → akun baru (tanpa HP dan tanpa kata sandi, email terverifikasi).

### 3.12 `POST /auth/google/link` (tautkan Google ke akun yang sedang login)
| | |
|---|---|
| Login | Ya |
| Body | `{ "idToken": string, "password": string (1-1024), "lang"?: "id" \| "en" \| "zh" }`. `password` = kata sandi akun saat ini (re-autentikasi). |
| Sukses | `200` + objek user publik terbaru (`hasGoogle: true`). Email pemberitahuan dikirim ke email akun yang terverifikasi. |
| Rate limit | 10 per 15 menit per IP: `Terlalu banyak percobaan menautkan Google. Coba lagi nanti.` Selain itu maks 5 kata sandi salah per user per 15 menit. |

| Status | Pesan |
|---|---|
| 400 | `idToken wajib diisi` / `idToken tidak valid` / `Kata sandi wajib diisi` / `Kata sandi terlalu panjang` / `Akun ini tidak memiliki kata sandi` |
| 401 | `Belum masuk` / `Kata sandi salah` / `Token Google tidak valid` |
| 403 | `Akun tamu tidak dapat menautkan akun Google` |
| 409 | `Akun ini sudah tertaut ke akun Google lain.` / `Akun Google ini sudah dipakai akun lain.` / `Akun sedang diproses. Coba lagi.` |
| 429 | pesan rate limit di atas, atau `Terlalu banyak percobaan kata sandi salah. Coba lagi nanti.` |
| 503 | `Login Google belum dikonfigurasi` |

Token Google baru diperiksa setelah kata sandi benar. Bila akun belum punya email, email Google dipakai dan otomatis terverifikasi; bila akun sudah punya email lain, email akun TIDAK diubah.

Jatah 5 kata sandi salah per 15 menit per user dipakai BERSAMA dengan endpoint 3.13–3.15 (satu user, satu jatah tebakan).

### Aturan bersama 3.13–3.15 (ubah metode login)

Ketiga endpoint di bawah mengubah cara pengguna masuk. Aturannya sama:

- **Wajib login** (cookie sesi). Urutan di server: pembatas IP → cek sesi → validasi body (400) → muat user (tamu 403) → prasyarat dan kebijakan (400/403/409/no-op) → blokir per user (429) → re-autentikasi → transaksi (kebijakan dicek ulang, data diubah, `sessionVersion` naik) → cookie baru → email pemberitahuan di luar transaksi.
- **Respons sukses**: `200` + objek user publik datar (bagian 2), BUKAN `{ "user": ... }`, dibaca ulang dari DB setelah transaksi.
- **Body umum**: `password?: string` (1-1024, tidak di-trim), `idToken?: string` (1-4096), `lang?: "id" | "en" | "zh"`.
- **Re-autentikasi** (jenis ditentukan SERVER dari akun, bukan dari pilihan klien):
  - Akun BER-password: `password` wajib, diperiksa dengan argon2. `idToken` diabaikan. Tanpa `password` → 400 `Kata sandi wajib diisi`.
  - Akun TANPA password (hanya Google): `idToken` wajib → 400 `idToken wajib diisi` bila kosong. Token diperiksa penuh (tanda tangan, `aud`, `iss`, `email_verified`, `sub`, `email`) dan `sub` HARUS sama dengan Google yang tertaut di akun ini. SEMUA kegagalan (token rusak, `aud`/`iss` salah, email belum terverifikasi, `sub` akun Google lain) dijawab sama: `401 Token Google tidak valid`.
  - Akun tanpa password dan tanpa Google: re-auth mustahil → `403 Tidak diizinkan` (tidak bisa terbentuk lewat alur normal).
- **Pembatas IP**: `accountChangeRateLimit`, 10 per 15 menit per IP, dihitung terpisah per route: `Terlalu banyak percobaan perubahan akun dari alamat ini. Coba lagi nanti.`
- **Pembatas re-auth gagal per user**: 5 per 15 menit, dibagi dengan `POST /auth/google/link`. Kata sandi salah, token Google tidak valid, dan `sub` tidak cocok semuanya dihitung. Dicek sebelum verifikasi, jadi setelah terblokir kredensial yang benar pun tetap `429 Terlalu banyak percobaan verifikasi gagal. Coba lagi nanti.` Dikosongkan saat re-auth sukses.
- **`sessionVersion` dan cookie**: aksi yang mengganti atau menghapus metode login menaikkan `sessionVersion` dalam transaksi yang sama, lalu server memasang cookie `agro_session` baru (klaim `sv` baru, selalu `Set-Cookie` TERAKHIR pada respons). Perangkat ini tetap masuk, perangkat lain keluar (401 `Belum masuk` pada request berikutnya). Aksi yang TIDAK menaikkan versi: tambah HP dari kosong, no-op, dan semua kegagalan.
- **Email pemberitahuan**: dikirim SETELAH transaksi selesai, hanya bila layanan email dikonfigurasi. Kegagalan kirim hanya dicatat (jenis galat saja, tanpa alamat email) dan tidak mengubah respons. Isi tanpa tautan, alamat email dan nomor HP disamarkan; anjurannya: atur ulang kata sandi lewat "Lupa kata sandi" dan periksa metode masuk di Profil.
- Tidak ada perubahan skema database. Nomor HP tidak diverifikasi (tanpa SMS).

### 3.13 `POST /auth/phone` (tambah atau ganti nomor HP)
| | |
|---|---|
| Login | Ya |
| Body | `{ "phone": string (8-15 digit setelah non-angka dibuang), "password"?: string, "idToken"?: string, "lang"?: "id" \| "en" \| "zh" }` |
| Sukses | `200` + objek user publik |
| Rate limit | 10 per 15 menit per IP (aturan bersama). Khusus endpoint ini: 5 konflik nomor (409) per 15 menit per user: `Terlalu banyak percobaan nomor HP. Coba lagi nanti.` |

Perilaku:
- **Menambah** (akun belum punya HP): TANPA re-auth, `sessionVersion` tidak naik, tidak ada email pemberitahuan.
- **Mengganti** (akun sudah punya HP): re-auth wajib, `sessionVersion` naik, cookie baru. Email pemberitahuan ke email akun BILA terverifikasi, berisi nomor lama dan baru yang disamarkan (`***` + 3 digit terakhir).
- **Nomor sama dengan nomor sekarang**: `200` tanpa perubahan, tanpa re-auth, tanpa kenaikan versi, tanpa email.
- Nomor sudah dipakai akun lain dijawab SAMA untuk setiap nomor yang dipakai (tidak membedakan sebab), dan dibatasi 5 kali per 15 menit per user agar nomor milik orang lain tidak bisa dicari-cari. Tabrakan saat commit (kolom `phone` unik) juga dijawab 409 yang sama dan tidak mengubah apa pun.

| Status | Pesan |
|---|---|
| 400 | `Nomor HP wajib diisi` / `Nomor HP harus 8 sampai 15 digit` / `Kata sandi wajib diisi` / `Kata sandi terlalu panjang` / `idToken wajib diisi` / `idToken tidak valid` |
| 401 | `Belum masuk` / `Kata sandi salah` / `Token Google tidak valid` |
| 403 | `Akun tamu tidak dapat mengubah data akun` / `Tidak diizinkan` |
| 409 | `Nomor HP tidak dapat digunakan.` / `Akun sedang diproses. Coba lagi.` |
| 429 | `Terlalu banyak percobaan perubahan akun dari alamat ini. Coba lagi nanti.` / `Terlalu banyak percobaan verifikasi gagal. Coba lagi nanti.` / `Terlalu banyak percobaan nomor HP. Coba lagi nanti.` |
| 503 | `Login Google belum dikonfigurasi` (hanya bila re-auth Google dibutuhkan) |

### 3.14 `POST /auth/email/remove` (hapus email)
| | |
|---|---|
| Login | Ya |
| Body | `{ "password"?: string, "idToken"?: string, "lang"?: "id" \| "en" \| "zh" }` |
| Sukses | `200` + objek user publik (`email: null`, `emailVerified: false`) |
| Rate limit | 10 per 15 menit per IP dan pembatas re-auth per user (aturan bersama) |

Perilaku:
- Re-auth SELALU wajib. `email` dan `emailVerifiedAt` dikosongkan; token `EmailVerification` dan `PasswordReset` milik user yang belum terpakai ditandai terpakai (dicabut) dalam transaksi yang sama. Token yang sudah terpakai dan milik user lain tidak disentuh.
- `sessionVersion` selalu naik, cookie baru dipasang.
- Email pemberitahuan dikirim ke email LAMA hanya bila sebelumnya terverifikasi. Email lama yang belum terverifikasi tidak dikirimi apa pun.
- Ditolak `409 Tidak bisa menghapus metode masuk terakhir.` bila setelah penghapusan akun tidak punya metode login sama sekali (aturan di `src/utils/login-methods.js`; dicek lagi di dalam transaksi). Akun ber-password tanpa nomor HP yang masih tertaut Google boleh menghapus email; password-nya baru bisa dipakai masuk setelah nomor HP ditambahkan (UI sebaiknya memberi peringatan).

| Status | Pesan |
|---|---|
| 400 | `Belum ada email di akun ini` / `Kata sandi wajib diisi` / `Kata sandi terlalu panjang` / `idToken wajib diisi` / `idToken tidak valid` |
| 401 | `Belum masuk` / `Kata sandi salah` / `Token Google tidak valid` |
| 403 | `Akun tamu tidak dapat mengubah data akun` / `Tidak diizinkan` |
| 409 | `Tidak bisa menghapus metode masuk terakhir.` / `Akun sedang diproses. Coba lagi.` |
| 429 | `Terlalu banyak percobaan perubahan akun dari alamat ini. Coba lagi nanti.` / `Terlalu banyak percobaan verifikasi gagal. Coba lagi nanti.` |
| 503 | `Login Google belum dikonfigurasi` (hanya bila re-auth Google dibutuhkan) |

### 3.15 `POST /auth/google/unlink` (lepas Google)
| | |
|---|---|
| Login | Ya |
| Body | `{ "password"?: string, "idToken"?: string, "lang"?: "id" \| "en" \| "zh" }` |
| Sukses | `200` + objek user publik (`hasGoogle: false`; email tidak berubah) |
| Rate limit | 10 per 15 menit per IP dan pembatas re-auth per user (aturan bersama) |

Perilaku:
- Re-auth SELALU wajib. `googleId` dikosongkan, email tidak diubah. `sessionVersion` selalu naik, cookie baru dipasang.
- Email pemberitahuan ke email akun bila terverifikasi.
- Ditolak `409 Tidak bisa menghapus metode masuk terakhir.` bila setelah dilepas akun tidak punya metode login lagi (mis. akun Google tanpa password, atau tanpa nomor HP/email terverifikasi yang bisa dipakai). Pengguna perlu lebih dulu membuat password lewat "Lupa kata sandi" (butuh email terverifikasi).
- **Login Google berikutnya dengan Gmail yang sama menautkan KEMBALI akun ini** lewat aturan (b) di 3.11 (email cocok dan terverifikasi → tautkan otomatis). Ini disengaja: melepas Google menghapus penautan, bukan memblokir Google untuk email itu. Agar Google tidak bisa dipakai masuk lagi, ganti atau hapus juga email akun (3.14).

| Status | Pesan |
|---|---|
| 400 | `Akun ini belum tertaut ke Google` / `Kata sandi wajib diisi` / `Kata sandi terlalu panjang` / `idToken wajib diisi` / `idToken tidak valid` |
| 401 | `Belum masuk` / `Kata sandi salah` / `Token Google tidak valid` |
| 403 | `Akun tamu tidak dapat mengubah data akun` / `Tidak diizinkan` |
| 409 | `Tidak bisa menghapus metode masuk terakhir.` / `Akun sedang diproses. Coba lagi.` |
| 429 | `Terlalu banyak percobaan perubahan akun dari alamat ini. Coba lagi nanti.` / `Terlalu banyak percobaan verifikasi gagal. Coba lagi nanti.` |
| 503 | `Login Google belum dikonfigurasi` (hanya bila re-auth Google dibutuhkan) |

---

## 4. Alur per halaman frontend

Semua panggilan: `fetch(url, { method, credentials: "include", headers: {"content-type":"application/json"}, body })`. Frontend (`agrochie-web`) memanggil `/api/*` pada origin sendiri; `next.config.ts` meneruskannya ke backend (proxy same-origin), sehingga cookie sesi tetap satu situs.
> Rute frontend sebenarnya (`/masuk`, `/daftar`, `/lupa-password`, dll.) berbeda dari yang tertulis di bagian ini; lihat "Catatan implementasi frontend (agrochie-web)" di akhir dokumen.



### 4.1 Login (`/login`): HP/email + tombol Google
1. Satu input "Nomor HP atau email" dikirim sebagai `identifier`, plus `password`. `AuthForm.tsx` perlu disesuaikan bila masih mengirim `phone`.
2. `POST /auth/login`: 200 → simpan user; bila `needsProfileCompletion` ke halaman lengkapi profil, selain itu ke beranda. 400/401 → tampilkan `error` (pesan 401 sengaja umum). 429 → tampilkan `error`, nonaktifkan tombol sementara.
3. Tombol Google (bagian 6) → `POST /auth/google` `{ idToken }`: 200/201 → seperti langkah 2. 401 → tampilkan `error`. 409 → tampilkan `error` apa adanya dan arahkan ke login biasa. 503 → sembunyikan tombol Google.
4. Tautan "Lupa kata sandi?" ke `/forgot-password`.

### 4.2 Register (`/register`)
1. Form nama, HP, kata sandi (min 8) → `POST /auth/register`. 201 → cookie sudah terpasang; arahkan sesuai `needsProfileCompletion` (akun baru biasanya `true` karena belum punya lahan).
2. 409 → `Nomor HP sudah terdaftar`. 400 → tampilkan `error`.
3. Tombol Google sama dengan 4.1 (akun baru dibuat otomatis, status 201).

### 4.3 Lupa password (`/forgot-password`)
1. Input email → `POST /auth/forgot-password` `{ email, lang }`.
2. 202 → SELALU tampilkan `message` dari respons apa pun emailnya; jangan menyiratkan email ada atau tidak.
3. 400 (format) dan 429 → tampilkan `error`. 503 → "Layanan email sedang tidak tersedia".

### 4.4 `/reset-password?token=...`
1. Baca `token` dari query. Bila kosong → pesan tautan tidak valid dan tombol ke `/forgot-password`.
2. Form kata sandi baru + konfirmasi (cocok, min 8, maks 128) → `POST /auth/reset-password` `{ token, passwordBaru }`.
3. 200 → bersihkan state user, tampilkan "Kata sandi berhasil diganti", arahkan ke `/login` (tidak login otomatis).
4. 400 `Tautan reset tidak valid atau sudah kedaluwarsa` → pesan + tautan "Minta tautan baru". 400 lain dan 429 → tampilkan `error`.

### 4.5 `/verify-email?token=...`
1. Saat dimuat, panggil SEKALI `POST /auth/verify-email` `{ token }` (lihat bagian 5). Tampilkan "Memverifikasi…".
2. 200 → "Email terverifikasi"; bila ada sesi, panggil `GET /auth/me` untuk menyegarkan `emailVerified`.
3. 400 `Tautan verifikasi tidak valid atau sudah kedaluwarsa` → tampilkan pesan; bila sudah login tawarkan "Kirim ulang" (4.6), bila belum tawarkan login. 429 → tampilkan `error`.

### 4.6 Banner tambah/verifikasi email
Tampilkan hanya untuk `isGuest === false`:
- `email === null` → input email → `POST /auth/email`. 200 → "Cek email untuk verifikasi". 409 → `Email tidak dapat digunakan`. 403 → sembunyikan banner. 502 → "Gagal mengirim, coba lagi". 503 → "Layanan email belum tersedia".
- `email !== null && !emailVerified` → tombol "Kirim ulang" → `POST /auth/email/resend-verification`. 202 → "Email terkirim". 400 `Email sudah terverifikasi` → segarkan via `GET /auth/me`. 429 → tampilkan `error`.
- `emailVerified === true` → tanpa banner.

### 4.7 Halaman lengkapi profil (`needsProfileCompletion === true`)
1. Setelah login/register/Google (dan di guard layout), arahkan ke halaman lengkapi profil.
2. Isi yang kurang: nomor HP bila `phone === null`, dan lahan pertama bila belum ada (memakai endpoint lahan yang sudah ada). Isian yang tidak diketahui dibiarkan kosong.
3. Setelah selesai panggil `GET /auth/me` sampai `needsProfileCompletion === false`.
4. Nomor HP akun Google diisi lewat `POST /auth/phone` (3.13): menambah nomor tidak butuh re-autentikasi.

### 4.8 Tombol "Tautkan Google" di profil
1. Tampilkan hanya bila `isGuest === false`, `hasGoogle === false`, dan `hasPassword === true` (bila `hasPassword === false`, server membalas 400 `Akun ini tidak memiliki kata sandi`).
2. Minta kata sandi akun di modal; simpan HANYA di state lokal modal.
3. Pada callback Google kirim `POST /auth/google/link` `{ idToken, password }`, lalu kosongkan kata sandi di `finally`.
4. 200 → perbarui user (`hasGoogle: true`). 401 `Kata sandi salah` → minta ulang. 401 `Token Google tidak valid` → ulangi. 409 → tampilkan `error`. 429 → tampilkan `error`, tutup modal. 403 → sembunyikan fitur. 503 → nonaktifkan tombol.

---

## 5. Aturan global frontend

- **Bahasa email**: field `lang` menerima `"id"`, `"en"`, atau `"zh"`; template verifikasi, reset kata sandi, dan pemberitahuan keamanan mengikuti bahasa tersebut.
- **401 pada request terautentikasi** (kecuali `login`, `register`, `google`, `google/link`, `phone`, `email/remove`, dan `google/unlink` dengan pesan `Kata sandi salah` / `Token Google tidak valid`, lihat tabel pengecualian) berarti sesi berakhir atau dicabut (mis. setelah reset password): bersihkan state user, arahkan ke `/login`.
- **Jangan memanggil `verify-email` dua kali.** Di React strict mode (dev) `useEffect` berjalan dua kali dan panggilan kedua mendapat 400 karena token sekali pakai. Pakai `useRef` sebagai penjaga, atau panggil lewat tombol.
- **Jangan menyimpan kata sandi di state yang menetap** (context, store global, localStorage). Pakai state lokal komponen dan kosongkan setelah submit, berhasil atau gagal.
- Jangan menyimpan atau mencatat `idToken`, token reset, atau token verifikasi; jangan kirim ke log/analytics. Hapus `?token=` dari URL setelah dibaca (`router.replace`).
- Selalu `credentials: "include"`. Frontend tidak menyimpan token sesi; cookie diatur server.
- Tampilkan `error` server apa adanya untuk 400/409/429; jangan menambah detail yang membedakan "akun ada" dan "akun tidak ada".

## 6. Tombol Google Identity Services di Next.js

Env frontend: `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (nilai SAMA dengan `GOOGLE_CLIENT_ID` backend; Client ID bukan rahasia). Tambahkan `http://localhost:3001` di "Authorized JavaScript origins" pada Google Cloud Console.

```tsx
'use client';
import Script from 'next/script';
import { useEffect, useRef } from 'react';

declare global { interface Window { google?: any } }

export function GoogleButton({ onCredential }: { onCredential: (idToken: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  const cb = useRef(onCredential);
  cb.current = onCredential;

  const init = () => {
    if (!window.google || !box.current) return;
    window.google.accounts.id.initialize({
      client_id: process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID,
      callback: (r: { credential: string }) => cb.current(r.credential),
    });
    window.google.accounts.id.renderButton(box.current, { type: 'standard', size: 'large', text: 'continue_with' });
  };
  useEffect(init, []);

  return (
    <>
      <Script src="https://accounts.google.com/gsi/client" strategy="afterInteractive" onLoad={init} />
      <div ref={box} />
    </>
  );
}

// Pemakaian di halaman login:
// <GoogleButton onCredential={async (idToken) => {
//   const r = await fetch('/api/auth/google', { method: 'POST', credentials: 'include',
//     headers: { 'content-type': 'application/json' }, body: JSON.stringify({ idToken }) });
//   const data = await r.json(); // 200/201: objek user; lainnya: { error }
// }} />
// Untuk menautkan: kirim { idToken, password } ke '/api/auth/google/link'.
```

## 7. Variabel `.env` backend (tanpa nilai rahasia)

| Variabel | Fungsi |
|---|---|
| `JWT_SECRET` | Kunci tanda tangan sesi (min 32 karakter). RAHASIA. |
| `JWT_TTL_DAYS`, `GUEST_TTL_HOURS` | Masa berlaku sesi biasa (bawaan 7 hari) dan sesi tamu (24 jam). |
| `COOKIE_NAME` | Nama cookie sesi (bawaan `agro_session`). |
| `FRONTEND_ORIGIN` | Satu-satunya origin yang diizinkan CORS. |
| `TRUST_PROXY` | `false`, `true`, atau jumlah hop proxy; menentukan `req.ip` untuk rate limit. |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER` | Server surat. Kosong = fitur email nonaktif (503). |
| `SMTP_PASS` | Sandi SMTP. RAHASIA, jangan di-commit. |
| `MAIL_FROM` | Alamat pengirim email. |
| `APP_BASE_URL` | Dasar tautan di email; kosong = `FRONTEND_ORIGIN`. |
| `GOOGLE_CLIENT_ID` | Client ID OAuth Google untuk memeriksa `aud`. Kosong = login Google nonaktif (503). Bukan rahasia. |
| `PASSWORD_RESET_TTL_MINUTES` | Umur tautan reset (contoh di `.env.example`: 30). |
| `EMAIL_VERIFY_TTL_HOURS` | Umur tautan verifikasi (contoh: 24). |
| `NODE_ENV` | `production` mengaktifkan cookie `secure` dan menonaktifkan `/dev/google-login`. |

Daftar lengkap ada di `backend/.env.example`.

---

## 8. Ringkasan keamanan

- **Hash password argon2**: `src/services/auth.service.js` (`argon2.hash` / `argon2.verify`); reset di `src/services/password-reset.service.js`.
- **Token reset/verifikasi acak, hanya hash SHA-256 disimpan, sekali pakai, berumur pendek**: `src/utils/token.js`; sekali pakai lewat `updateMany` bersyarat di `password-reset.service.js` dan `email-verification.service.js`. Token baru mematikan token lama.
- **Anti-enumerasi akun**: `forgot-password` membalas 202 dengan pesan sama lalu bekerja di latar (`startForgotJob`, `controllers/auth.controller.js`). Login memakai satu pesan galat dan hash tiruan (`getDummyHash`, `auth.service.js`) agar waktu respons sama. Konflik email dijawab generik (`Email tidak dapat digunakan`).
- **Pencabutan semua sesi setelah reset password**: `sessionVersion` pada `User` dan klaim `sv` di JWT (`src/utils/session.js`), diperiksa tiap request di `src/middleware/auth.js`, dinaikkan oleh `bumpSessionVersion` dalam transaksi reset.
- **Rate limit per IP, per email, per user**: per IP di `src/middleware/rate-limit.js`; per akun/user (3 per jam) di `password-reset.service.js` dan `email-verification.service.js`; 5 kata sandi salah per 15 menit per user saat menautkan Google (`failureLimiter`, `google-auth.service.js`).
- **Verifikasi ID token Google**: `validateGooglePayload` di `google-auth.service.js` memeriksa `aud`, `iss`, `email_verified === true`, `sub`, `email`; tanda tangan dan kedaluwarsa oleh `google-auth-library`. Detail galat Google tidak diteruskan.
- **Penautan otomatis hanya untuk email terverifikasi**: `applyRules` (`google-auth.service.js`); email belum terverifikasi → 409 tanpa menyentuh akun.
- **Re-autentikasi password untuk menautkan Google**: `linkGoogle` memeriksa kata sandi sebelum token Google.
- **Re-autentikasi untuk mengubah metode login** (ganti HP, hapus email, lepas Google): `src/services/account-security.service.js`. Akun ber-password memakai password (argon2), akun Google-only memakai ID token yang `sub`-nya HARUS sama dengan Google tertaut (`verifyGoogleToken`, `google-auth.service.js`). Semua kegagalan token dijawab seragam `Token Google tidak valid`.
- **Aturan "minimal satu metode login"** kini dipakai: `planAccountChange` (memakai `src/utils/login-methods.js`) dicek sebelum dan sesudah di dalam transaksi.
- **Pencabutan sesi perangkat lain** saat metode login berubah: `bumpSessionVersion` dalam transaksi yang sama, lalu cookie baru untuk perangkat ini (`respondAccountChange`, `controllers/auth.controller.js`).
- **Pembatas re-auth gagal dibagi** (`passwordFailures`, 5 per 15 menit per user) antara `google/link`, `phone`, `email/remove`, dan `google/unlink`; pembatas IP `accountChangeRateLimit`; pembatas konflik nomor HP (5 per 15 menit per user) agar nomor orang lain tidak bisa dicari-cari, dan jawaban konflik seragam.
- **Email pemberitahuan** saat password diganti, Google ditautkan atau dilepas, nomor HP diganti, dan email dihapus: `src/services/email-templates.js` (waktu WIB untuk bahasa Indonesia). Tanpa tautan, alamat dan nomor disamarkan, dikirim setelah commit, kegagalan kirim dicatat tanpa alamat email.
- **Cookie httpOnly, sameSite=lax**: `src/utils/session.js`; CORS satu origin dengan credentials dan helmet di `src/middleware/security.js`.
- **Email dikirim di luar transaksi DB**: `sendOrRevoke` (`email-verification.service.js`) mencabut token bila pengiriman gagal.

## 9. Keterbatasan yang diketahui

- Rate limit di memori proses: tidak dibagi antar instance dan hilang saat restart. Banyak instance butuh penyimpanan bersama (mis. Redis).
- Cookie `sameSite=lax` bermasalah bila frontend dan backend di domain/situs berbeda. Solusi: satu situs atau proxy Next.js (seperti `next.config.ts` sekarang).
- Aplikasi Google berstatus Testing: hanya test user yang bisa masuk sampai dipublikasikan.
- Setelah `POST /auth/google/unlink`, login Google dengan Gmail yang sama menautkan KEMBALI ke akun itu (aturan b, selama email akun terverifikasi). Disengaja dan sudah dicatat di 3.15.
- Nomor HP tidak diverifikasi (tidak ada SMS). Mitigasi: format dan keunikan, pembatas, email pemberitahuan.
- Menghapus email dari akun ber-password tanpa nomor HP yang masih tertaut Google diizinkan; password-nya tidak bisa dipakai masuk sampai nomor HP ditambahkan.
- Email lama yang belum terverifikasi dapat membuat login Google dengan email itu ditolak 409 sampai email diverifikasi.
- Satu tes cuaca ("musim lama (BAWANG 10 minggu)") gagal sejak sebelum branch ini; tidak terkait auth.
- Hasil `npm audit` dari langkah sebelumnya: kerentanan pada dependensi `prisma` 7.10.0 tidak diubah di branch ini.

## 10. Panduan uji manual

### Postman (Cookie Jar aktif, base `http://localhost:3000/api`)
1. `POST /auth/register` `{ "name":"Uji", "phone":"081234567890", "password":"sandi12345" }` → 201, cookie `agro_session` tersimpan.
2. `GET /auth/me` → 200; cek `hasPassword: true` dan `needsProfileCompletion`.
3. `POST /auth/email` `{ "email":"uji@contoh.id" }` → 200 (butuh SMTP; tanpa SMTP → 503 `Layanan email belum dikonfigurasi`). Ambil tautan dari kotak masuk.
4. `POST /auth/verify-email` `{ "token":"<dari tautan>" }` → 200; ulangi → 400.
5. `POST /auth/forgot-password` `{ "email":"uji@contoh.id" }` → 202; bandingkan dengan email acak (respons identik).
6. `POST /auth/reset-password` `{ "token":"<dari email>", "passwordBaru":"sandibaru123" }` → 200; lalu `GET /auth/me` dengan cookie lama → 401 `Belum masuk`.
7. `POST /auth/login` `{ "identifier":"uji@contoh.id", "password":"sandibaru123" }` → 200; coba juga dengan nomor HP.
8. Rate limit: kirim `forgot-password` 6 kali berturut-turut → permintaan ke-6 membalas 429.

### Halaman `/dev/google-login` (hanya bila `NODE_ENV` bukan `production`)
1. Isi `GOOGLE_CLIENT_ID` di `backend/.env`, tambahkan `http://localhost:3000` di Authorized JavaScript origins, mulai ulang server.
2. Buka `http://localhost:3000/dev/google-login`, klik tombol Google dengan akun test user. Halaman memanggil `POST /api/auth/google`.
3. Tautkan: login dulu di browser yang sama, isi kolom kata sandi pada bagian "Tautkan Google ke akun yang sedang login", lalu klik tombol Google di bagian itu → `POST /api/auth/google/link`.
4. Kata sandi salah → 401 `Kata sandi salah`; setelah 5 kali salah → 429.

---

## Catatan implementasi frontend (agrochie-web)

Bagian ini hanya mencatat bagaimana `agrochie-web` menerapkan kontrak di atas. Isi kontrak endpoint tidak berubah.

### Rute dokumen vs rute sebenarnya

| Rute di dokumen | Rute sebenarnya |
|---|---|
| `/login` | `/masuk` |
| `/register` | `/daftar` |
| `/forgot-password` | `/lupa-password` |
| `/reset-password` | `/reset-password` (sama) |
| `/verify-email` | `/verify-email` (sama) |

### Keputusan perilaku

- **Tidak ada halaman "lengkapi profil"** (bagian 4.7). Bila `needsProfileCompletion === true`, frontend mengarahkan ke `/profil#akun`.
- **Banner email** (bagian 4.6) mengarah ke `/profil#akun`.
- **Email opsional saat daftar** memakai dua panggilan: `POST /auth/register` (body tetap `{ name, phone, password }`), lalu bila email diisi, `POST /auth/email`. Bila panggilan kedua gagal, akun tetap ada, frontend menampilkan alasan dan tombol "Lanjut ke Profil" (tanpa redirect otomatis).

### Endpoint yang dikecualikan dari redirect 401 global

Secara umum 401 pada request terautentikasi mengarahkan ke `/masuk` (bagian 5). Pengecualiannya:

| Endpoint | Alasan |
|---|---|
| `GET /auth/me` | Ditangani sendiri oleh kerangka aplikasi (status belum masuk). |
| `POST /auth/logout` | Selalu berhasil; 401 tidak berarti apa-apa. |
| `POST /auth/login`, `POST /auth/register` | 401/kredensial salah bukan tanda sesi habis. |
| `POST /auth/google` | 401 `Token Google tidak valid` ditampilkan sebagai galat login. |
| `POST /auth/google/link` | Hanya untuk 401 `Kata sandi salah` dan `Token Google tidak valid`, yang ditampilkan di modal. 401 `Belum masuk` tetap redirect. |
| `POST /auth/phone`, `POST /auth/email/remove`, `POST /auth/google/unlink` | Hanya untuk 401 `Kata sandi salah` dan `Token Google tidak valid` (re-autentikasi), yang ditampilkan di modal. 401 `Belum masuk` pada path yang sama tetap redirect. |
| `POST /auth/email` dari alur daftar saja | Akun baru sudah dibuat; 401 diperlakukan sebagai "email belum tersimpan" agar pengguna tidak terlempar. Panggilan dari kartu Profil TIDAK dikecualikan. |
| Semua request saat berada di halaman publik auth | Mencegah putaran redirect. |

### Endpoint backend yang belum ada

Tidak ada. Mengisi nomor HP (3.13), menghapus email (3.14), dan melepas Google (3.15) sudah tersedia di backend. Dokumen ini tidak menyatakan status antarmuka frontend-nya. Saat membuatnya, peringatkan pengguna bahwa login Google dengan Gmail yang sama akan menautkan ulang akun (lihat 3.15).

