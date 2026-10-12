# AgroChie — Frontend redesign + Express integration

Repo ini merupakan hasil perapian UI frontend (berdasarkan referensi visual dashboard agrikultur) sekaligus penyambungan ke backend Express/Prisma yang telah ada. UI memprioritaskan putih–hijau, tipografi **Nunito**, informasi terbaca, responsive layout, navigasi konsisten, dan komponen modular. Tidak ada pemalsuan respons API jika server/engine mati.

> **Batas pengujian:** Kode TS/TSX telah lolos pemeriksaan sintaks melalui compiler TypeScript dan semua backend JS lolos `node --check`. Environment pembuatan paket tidak dapat menuntaskan `npm ci` karena registry tidak dapat diakses, sehingga `next build`, koneksi PostgreSQL, login browser, XGBoost, dan Gemini **belum dapat diverifikasi end-to-end**. Jalankan langkah di bawah pada mesin dengan Node.js dan koneksi registry, kemudian uji secara lokal.

## Arsitektur

```text
agrochie-web (Next.js, TypeScript, React Query)
  ├── src/features/console/api.ts       <-- typed API client dan formatters
  ├── src/features/console/hooks.ts     <-- server queries + active farm
  ├── src/features/console/context.tsx  <-- workspace provider
  ├── src/features/console/ui.tsx       <-- reusable UI primitives
  ├── src/features/console/FieldMap.tsx <-- ilustrasi / opt-in citra satelit
  ├── src/features/console/Dashboard.tsx
  ├── src/features/console/forms/*      <-- profil, musim, pengeluaran, panen
  ├── src/features/console/views/*       <-- views finansial, cuaca, kredit, dll
  ├── src/features/console/Pages.tsx    <-- dispatcher rute tipis
  ├── src/features/console/AuthForm.tsx <-- login/register/tamu nyata
  ├── src/components/layout/AppShell.tsx <-- nav responsive + auth gate
  └── src/app/(farmer)/*/page.tsx        <-- entrypoint tipis per rute

                 /api/* (rewrite, same origin)
                            |
backend (Express.js, Prisma, PostgreSQL)
  ├── src/routes/...                    <-- endpoints existing
  ├── src/routes/history.routes.js      <-- history by owner
  ├── src/routes/weather.routes.js      <-- Open-Meteo current & forecast
  └── src/routes/extended-season.routes.js
        ├── photo upload & private read (local storage dev)
        ├── persisted weekly checklist
        └── persisted loan referral (no bank approval/integration)

Python prediction engine (folder engine/ dan artefak model disertakan) <-- ENGINE_URL, ENGINE_INTERNAL_KEY
Google Gemini (configured separately)           <-- GEMINI_API_KEY
```

## Cara menjalankan

Syarat: Node.js yang kompatibel dengan Next.js 16 dan Prisma 7, PostgreSQL, serta Python dengan dependencies yang tercantum dalam `engine/requirements.txt`. Kode engine Python dan artefak model XGBoost sudah tersedia di folder `engine/` dalam paket ini, tetapi layanannya harus dijalankan secara terpisah.

**1. Mesin prediksi Python (FastAPI, terminal pertama)**

```bash
cd engine
python -m venv .venv
# Linux/macOS: source .venv/bin/activate
# Windows PowerShell: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env
# Ubah ENGINE_INTERNAL_KEY menjadi nilai acak dan sama dengan backend/.env
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Periksa `http://127.0.0.1:8000/health`. Folder `engine/models/biaya_musim` dan `biaya_mingguan` sudah menyertakan artefak model; cek status model pada respons health sebelum memakai prediksi. Instalasi TensorFlow untuk model daun dapat memerlukan waktu dan dependency sistem tambahan.

**2. Backend (terminal kedua)**

```bash
cd backend
cp .env.example .env
# Atur DATABASE_URL, JWT_SECRET (min 32 karakter), ENGINE_URL dan ENGINE_INTERNAL_KEY.
# API Gemini perlu GEMINI_API_KEY + setup embeddings/RAG.
npm ci
npx prisma generate
npx prisma migrate deploy
npm run dev
```

Backend: `http://localhost:3000/api/health` (membutuhkan PostgreSQL aktif).

**3. Frontend** (terminal ketiga)

```bash
cd agrochie-web
cp .env.example .env.local
npm ci
npm run dev -- -p 3001
```

Buka `http://localhost:3001`. Frontend Next.js mem-proxy `/api/*` ke backend melalui `API_PROXY_TARGET`. **Jangan jalankan kedua aplikasi di port 3000**. Sesuaikan `FRONTEND_ORIGIN=http://localhost:3001` pada backend. Cookie sesi dikelola Express sebagai `httpOnly`, bukan `localStorage` token.

**4. Data pengujian**

Gunakan daftar akun atau login sesuai data Anda. Mode tamu meminta sesi asli ke `POST /api/auth/guest`; data tamu berada di server dan dihapus ketika logout. Buat profil lahan yang valid sebelum membuat musim. Untuk memulai pembiayaan, lengkapi lokasi, jenis tanah, sumber air, pH + tanggal ukur, N/P/K, serta parameter cuaca dan indeks harga. Tidak ada default cuaca buatan. **Jika mesin Python belum dinyalakan, artefaknya gagal dimuat, atau tidak merespons, pembiayaan tidak dapat berjalan dan status musim tetap DRAFT.**

## Fitur dan sumber data

| Menu | Backend yang digunakan | Catatan |
| --- | --- | --- |
| Masuk / Daftar / Tamu | `/api/auth/login`, `/register`, `/guest`, `/me`, `/logout` | Nomor HP, bukan email; sesi cookie |
| Profil | `/api/farms` GET/POST/PATCH | Nama, tanah, NPK, pH, koordinat, modal |
| Musim tanam | `/api/farms/:id/seasons`, `/api/seasons/:id/start-financing`, `/start-planting`, `/harvests`, `/sample`, `/close` | Mesin biaya Python diperlukan saat mulai pembiayaan |
| Beranda | Data farm/season/expense + cuaca | Tidak mencampur mock dengan data nyata |
| Prediksi | `season.costPlan` dari API | Model version, P10/P50/P90, biaya mingguan |
| Rencana biaya | `season.costPlan` + fase baseline | Porsi fase 19/16/50/15 ditandai aturan indikatif |
| Kalender uang | CostPlan + Expense | Biaya mingguan dan pencatatan aktual |
| Catatan | `/api/seasons/:id/expenses` | Tambah/list/hapus transaksi aktual |
| Cuaca & lahan | `/api/weather/current` + `/forecast` | Open-Meteo dari Express, 7 hari |
| Panen/foto | `/api/seasons/:id/photos/upload` + `/photos/:photoId/file` | Simpan JPEG/PNG/WebP asli, **lokal dev**, bukan verifikasi GPS |
| Riwayat musim | `/api/history` | Status kualitas dan persetujuan data dari DB |
| Pengingat | `/api/seasons/:id/checklist` | Checkbox per minggu ke tabel ReminderCheck |
| Risiko & kredit | `/api/seasons/:id/loans` | Membuat kode rujukan lokal, **bukan persetujuan bank** |
| Asisten | `/api/assistant/chat` | Gemini dan RAG wajib terkonfigurasi; tidak ada jawaban palsu |

## Desain & UX

- Tampilan utama putih dengan hijau tanaman, cards ringan, Nunito, sidebar berkelompok, bottom nav mobile.
- Dashboard mengikuti komposisi referensi: visual lahan dominan kiri, panel ringkasan kanan. **Ilustrasi** tidak dianggap batas geografis.
- Jika ada koordinat lahan, pengguna dapat secara sadar menekan **Lihat satelit** untuk citra World Imagery Esri (dengan atribusi). Titik koordinat **bukan** poligon lahan. Citra dan lokasi dikirim ke pihak penyedia tile setelah opt-in; koneksi internet diperlukan.
- Input proses tetap berurutan: buat profil → buat musim → mulai pembiayaan → mulai penanaman → catat panen → tutup musim.
- Sebelum pembiayaan dimulai, prediksi, anggaran, kalender, dan kredit dijaga oleh **money gate**, bukan diisi angka contoh.
- Error jaringan dan validasi nyata ditampilkan kepada petani tanpa mengklaim aksi berhasil.

## Batasan yang masih ada

1. **Engine Python dan artefak model biaya disertakan**, tetapi wajib dipasang dependency, disetel kunci internal, dan dijalankan secara terpisah. Integrasi belum diuji end-to-end di lingkungan ini; akurasi dunia nyata tidak dinyatakan telah tervalidasi.
2. Integrasi Gemini memerlukan `GEMINI_API_KEY` dan pipeline embeddings/RAG yang benar-benar berjalan.
3. Upload foto menyimpan berkas privat di `backend/uploads` secara lokal untuk pengembangan. Di produksi, pindahkan ke S3-compatible object storage dan pertahankan kontrol akses. Metadata GPS/waktu asli perangkat belum diverifikasi; tidak boleh mengklaim foto sudah autentik.
4. Pinjaman tersimpan pada backend sebagai kode rujukan manual, belum dikirim ke bank. Status DIAJUKAN **tidak berarti** bank menerima atau menyetujui.
5. Ekspor CSV 32 kolom belum tersedia sebagai endpoint backend. Riwayat hanya menampilkan record actual dengan kualitas/consent dari DB.
6. Dashboard menggunakan satu titik koordinat lahan. Batas GIS polygon yang asli belum tersedia dari alur frontend ini.
7. Modul frontend sebelumnya yang bergantung pada mock repo dipindahkan ke `legacy_frontend/` sebagai arsip nonaktif (di luar kompilasi Next). **Rute aplikasi aktif** memakai `src/features/console`. Tidak ada fallback diam-diam ke mock repo saat API gagal.

## Pemeriksaan yang disarankan sebelum deploy

```bash
cd agrochie-web
npm run lint
npx tsc --noEmit
npm run build

cd ../backend
npm test
```

Lakukan pengujian end-to-end di PostgreSQL khusus tes: akun, otorisasi per user, farm CRUD, prediksi sukses/gagal, aturan money gate, transaksi, sampel panen, unggah foto, penutupan, riwayat, rujukan dan pengingat. Periksa mobile 375px dan desktop 1440px. Jangan arahkan perangkat publik ke storage foto lokal tanpa audit keamanan.
