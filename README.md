# AgroChie

**Asisten digital untuk petani: rencanakan biaya musim tanam, pantau lahan, prediksi, dan tanya asisten AI.**

AgroChie adalah aplikasi web smart farming untuk petani cabai, tomat, dan bawang. Petani sering memulai musim tanam tanpa gambaran biaya per fase, tanpa catatan pengeluaran yang rapi, dan sulit mengenali masalah tanaman sejak dini. AgroChie membantu dengan:

- prediksi biaya musim dan biaya mingguan dari model machine learning;
- pencatatan biaya aktual dan kalender uang;
- cuaca lahan dari Open-Meteo;
- deteksi kualitas tanaman dari foto daun beserta rekomendasi tindakan;
- asisten AI (Gemini + RAG) yang menjawab berdasarkan data lahan dan cuaca.

<!-- Placeholder screenshot: tambahkan tangkapan layar Beranda di sini -->

## Daftar Isi

1. [Fitur utama](#fitur-utama)
2. [Arsitektur](#arsitektur)
3. [Teknologi](#teknologi)
4. [Prasyarat](#prasyarat)
5. [Instalasi dan menjalankan](#instalasi-dan-menjalankan)
6. [Variabel lingkungan](#variabel-lingkungan)
7. [Ringkasan API](#ringkasan-api)
8. [Menjalankan tes](#menjalankan-tes)
9. [Catatan penting dan keterbatasan](#catatan-penting-dan-keterbatasan)
10. [Struktur folder](#struktur-folder)
11. [Kontribusi](#kontribusi)

## Fitur utama

Daftar mengikuti menu di aplikasi (`agrochie-web/src/config/navigation.ts`).

| Menu | Fungsi |
| --- | --- |
| Beranda | Ringkasan lahan, musim aktif, biaya, dan cuaca. |
| Musim tanam | Membuat musim, memulai pembiayaan dan penanaman, mencatat panen, serta menutup musim. |
| Prediksi musim | Menampilkan hasil prediksi biaya musim (rentang P10/P50/P90) dan biaya mingguan dari engine. |
| Cuaca dan lahan | Cuaca saat ini dan prakiraan berdasarkan koordinat lahan (Open-Meteo). |
| Deteksi tanaman | Alur: foto daun, lalu model CNN di engine mengklasifikasi, lalu hasilnya dikirim ke Gemini, lalu keluar rekomendasi tindakan, bahan/obat, dan estimasi biaya. Hasil tersimpan di riwayat dan bisa dikirim lewat tombol "Tambahkan ke Catatan biaya". |
| Rencana biaya | Rincian rencana biaya musim per fase. |
| Kalender uang | Biaya mingguan terhadap pencatatan aktual. |
| Risiko dan kredit | Ringkasan risiko dan pembuatan kode rujukan pinjaman (tersimpan lokal, **bukan** persetujuan bank). |
| Catatan | Mencatat, melihat, dan menghapus pengeluaran aktual musim. |
| Riwayat musim | Riwayat musim milik pengguna beserta status kualitas data. |
| Cek lahan | Daftar periksa mingguan per musim (rute `/pengingat`). |
| Asisten | Chat berbasis Gemini dengan RAG atas dokumen di `backend/knowledge`, dan alat (function calling) untuk data cuaca Open-Meteo serta konteks lahan pengguna. |

Menu **Profil** mengelola data lahan (jenis tanah, NPK, pH, koordinat). Pengguna dapat mendaftar, masuk, atau memakai mode tamu.

## Arsitektur

```text
 Browser
    |
    v
+-----------------+     /api/* (rewrite, same origin)     +--------------------+
| agrochie-web    | ------------------------------------> | backend            |
| Next.js :3001   |                                       | Express 5 :3000    |
+-----------------+                                       +--------------------+
                                                            |    |      |     |
                          +---------------------------------+    |      |     |
                          v                                      v      |     |
                 +----------------+                +----------------+   |     |
                 | PostgreSQL     |                | engine :8000   |   |     |
                 | (via Prisma)   |                | FastAPI + model|   |     |
                 +----------------+                +----------------+   |     |
                                                                        v     v
                                                                Gemini API  Open-Meteo
```

| Bagian | Peran |
| --- | --- |
| `agrochie-web` (port 3001) | Antarmuka pengguna. Meneruskan `/api/*` ke backend; sesi memakai cookie `httpOnly`. |
| `backend` (port 3000) | API, autentikasi, aturan bisnis, akses database, serta pemanggilan engine, Gemini, dan Open-Meteo. Hanya backend yang mengakses database. |
| PostgreSQL | Penyimpanan data (lahan, musim, biaya, deteksi, chat, potongan pengetahuan RAG). |
| `engine` (port 8000) | Memuat model dan memprediksi: biaya musim, biaya mingguan (XGBoost), dan kualitas daun (CNN Keras). Dilindungi header `x-internal-key`. |
| Gemini API | Rekomendasi tindakan deteksi, asisten chat, dan embedding RAG. |
| Open-Meteo | Data cuaca. |

## Teknologi

| Bagian | Teknologi | Versi |
| --- | --- | --- |
| Frontend | Next.js | 16.4.0 |
| | React / React DOM | 19.3.0 |
| | TypeScript | ^5 |
| | Tailwind CSS | ^4 |
| | TanStack React Query | ^5.104.2 |
| | React Hook Form / Zod | ^7.90.0 / ^3.25.76 |
| | Recharts | ^3.10.1 |
| | Lucide React | ^1.55.0 |
| Backend | Express | ^5.2.1 |
| | Prisma, `@prisma/client`, adapter pg | 7.10.0 |
| | `pg` | ^8.23.1 |
| | Zod | 4.6.5 |
| | jose (JWT) | 6.2.12 |
| | argon2 | ^0.45.1 |
| | helmet / cors / cookie-parser / multer | 8.3.0 / 2.8.6 / 1.4.7 / 2.4.0 |
| Engine | FastAPI, Uvicorn | tidak dikunci |
| | XGBoost | 3.4.1 |
| | TensorFlow (model CNN Keras) | tidak dikunci |
| | scikit-learn, pandas, numpy, pillow | tidak dikunci |
| Data/AI | Google Gemini SDK (`@google/genai`) | 2.28.0 |
| | Model Gemini bawaan | `gemini-3.5-flash` |
| | Model embedding bawaan | `gemini-embedding-001` (768 dimensi) |
| | Cuaca | Open-Meteo |

## Prasyarat

| Kebutuhan | Versi |
| --- | --- |
| Node.js | Tidak ada field `engines` di `package.json`. Next.js 16 dan Prisma 7 membutuhkan Node.js modern; pengembangan dilakukan dengan Node.js 22 ke atas. TODO: perlu dilengkapi (versi minimum resmi). |
| Python | Engine diuji dengan Python 3.12. Versi minimum lain belum diverifikasi. |
| PostgreSQL | TODO: perlu dilengkapi (versi minimum belum tercatat di kode). |
| Git | Untuk clone repositori. |

## Instalasi dan menjalankan

Perintah memakai PowerShell (Windows). Padanan macOS/Linux dicantumkan hanya bila berbeda.

### 1. Clone repositori

```powershell
git clone <URL_REPOSITORI_ANDA> Fintechton
cd Fintechton
```

### 2. Database

Buat database PostgreSQL, misalnya `agrochie`:

```powershell
psql -U postgres -c "CREATE DATABASE agrochie;"
```

Isi `DATABASE_URL` di `backend/.env` (lihat langkah Backend), lalu dari folder `backend`:

```powershell
cd backend
npx prisma generate
npx prisma migrate deploy
npm run seed
```

`npm run seed` mengisi data fase tanaman dan hujan klimatologi, serta akun petugas bank bila variabel `SEED_BANK_*` terisi lengkap.

### 3. Backend

```powershell
cd backend
Copy-Item .env.example .env      # macOS/Linux: cp .env.example .env
# Edit .env: DATABASE_URL, JWT_SECRET (min. 32 karakter), ENGINE_INTERNAL_KEY, GEMINI_API_KEY
npm ci
npm run dev                      # atau: npm start
```

Cek: `http://localhost:3000/api/health`.

Untuk mengisi basis pengetahuan RAG asisten (butuh `GEMINI_API_KEY` dan database aktif):

```powershell
npm run ingest
```

### 4. Engine

```powershell
cd engine
python -m venv .venv
.venv\Scripts\Activate.ps1       # macOS/Linux: source .venv/bin/activate
pip install -r requirements.txt
Copy-Item .env.example .env      # macOS/Linux: cp .env.example .env
# Edit .env: ENGINE_INTERNAL_KEY harus sama dengan backend/.env
uvicorn app.main:app --host 127.0.0.1 --port 8000
```

Cek: `http://127.0.0.1:8000/health` (menampilkan status model). Engine menolak start bila `ENGINE_INTERNAL_KEY` kosong.

Model sudah ada di repositori, di `engine/models/`, sehingga tidak perlu diunduh:

- `biaya_musim/` dan `biaya_mingguan/` (XGBoost, berkas `.json`);
- `kualitas_tanaman/` (CNN Keras, `best_model.keras`).

Skrip pelatihan belum tersedia: `engine/scripts/train.py` saat ini kosong. TODO: perlu dilengkapi (cara melatih ulang model). Pemasangan TensorFlow dapat memakan waktu.

### 5. Frontend

Frontend tidak punya `.env.example` di repositori (pola `.env*` diabaikan oleh `agrochie-web/.gitignore`). Variabel frontend bersifat opsional, jadi `.env.local` boleh dilewati bila backend berjalan di `http://127.0.0.1:3000`.

```powershell
cd agrochie-web
# Opsional: buat .env.local (lihat tabel variabel lingkungan frontend)
npm ci
npm run dev -- -p 3001
```

### 6. Urutan menjalankan dan alamat

Jalankan berurutan, layanan aplikasi di terminal terpisah:

| Urutan | Layanan | Alamat |
| --- | --- | --- |
| 1 | PostgreSQL | `localhost:5432` |
| 2 | Engine | `http://127.0.0.1:8000` |
| 3 | Backend | `http://localhost:3000` |
| 4 | Frontend | `http://localhost:3001` (buka ini di browser) |

`FRONTEND_ORIGIN` di backend harus sama dengan alamat frontend.


## Variabel lingkungan

Sumber: `backend/.env.example`, `engine/.env.example`, dan pemakaian variabel di kode. Semua nilai contoh adalah nilai palsu. Jangan pernah meng-commit berkas `.env`.

### Backend (`backend/.env`)

| Variabel | Fungsi | Wajib | Contoh aman |
| --- | --- | --- | --- |
| `DATABASE_URL` | Koneksi PostgreSQL | Wajib | `postgresql://USER:PASSWORD@localhost:5432/agrochie?schema=public` |
| `PORT` | Port backend (bawaan 3000) | Opsional | `3000` |
| `NODE_ENV` | Mode lingkungan | Opsional | `development` |
| `ENGINE_URL` | Alamat engine | Opsional (bawaan `http://127.0.0.1:8000`) | `http://127.0.0.1:8000` |
| `ENGINE_INTERNAL_KEY` | Kunci bersama dengan engine, dikirim sebagai header `x-internal-key` | Wajib untuk prediksi dan deteksi | `isi_kunci_acak_anda` |
| `GEMINI_API_KEY` | Kunci Gemini; tanpa ini asisten dan solusi deteksi menjawab 503 | Wajib untuk asisten dan deteksi | `isi_api_key_anda` |
| `GEMINI_MODEL` | Model Gemini | Opsional | `gemini-3.5-flash` |
| `GEMINI_EMBED_MODEL` | Model embedding RAG | Opsional | `gemini-embedding-001` |
| `EMBED_DIMS` | Dimensi embedding | Opsional | `768` |
| `RAG_MIN_SCORE` | Skor kemiripan minimal RAG | Opsional | `0.5` |
| `GEMINI_TIMEOUT_MS` | Batas waktu satu panggilan Gemini (ms, > 0) | Opsional | `30000` |
| `DETECTION_PROVIDER` | Penyedia deteksi foto: `engine` (bawaan) atau `gemini` | Opsional | `engine` |
| `DETECTION_FALLBACK_PROVIDER` | Penyedia cadangan (kosong = nonaktif; nilai: `gemini`); memakai kuota Gemini | Opsional | (kosong) |
| `DETECTION_MIN_MARGIN` | Selisih minimal skor kelas #1 dan #2 (0 sampai 1) | Opsional | `0.15` |
| `DETECTION_MIN_CONFIDENCE` | Ambang keyakinan (0 sampai 1) | Opsional | `0.5` |
| `DETECTION_MAX_MB` | Ukuran maksimal foto unggahan (MB, > 0) | Opsional | `5` |
| `JWT_SECRET` | Rahasia penanda tangan sesi, minimal 32 karakter | Wajib | `isi_teks_acak_minimal_32_karakter` |
| `JWT_TTL_DAYS` | Masa berlaku sesi (hari) | Opsional | `7` |
| `GUEST_TTL_HOURS` | Masa berlaku sesi tamu (jam) | Opsional | `24` |
| `COOKIE_NAME` | Nama cookie sesi | Opsional | `agro_session` |
| `FRONTEND_ORIGIN` | Origin frontend untuk CORS (satu alamat http/https, bukan `*`) | Opsional (bawaan `http://localhost:3001`) | `http://localhost:3001` |
| `TRUST_PROXY` | `false` (bawaan), `true`, atau jumlah hop proxy | Opsional | `false` |
| `AGROCHIE_UPLOAD_DIR` | Folder foto unggahan (pengembangan lokal) | Opsional | `./uploads` |
| `SEED_BANK_NAME`, `SEED_BANK_PHONE`, `SEED_BANK_PASSWORD` | Seed akun petugas bank; bila ada yang kosong, seed akun ini dilewati | Opsional | (kosong) |

`GEMINI_FALLBACK_MODEL` (opsional, kosong = nonaktif, harus beda dari `GEMINI_MODEL`) dicoba satu kali bila model utama 503 atau kuota habis. `GEMINI_MAX_RETRIES` (bawaan `1`) dan `GEMINI_RETRY_BASE_MS` (bawaan `2000`) mengatur ulangan khusus 503.

### Engine (`engine/.env`)

| Variabel | Fungsi | Wajib | Contoh aman |
| --- | --- | --- | --- |
| `ENGINE_INTERNAL_KEY` | Harus sama dengan backend; engine tidak mau start bila kosong | Wajib | `isi_kunci_acak_anda` |
| `MODELS_DIR` | Folder artefak model (bawaan `engine/models`); dibaca kode, tidak ada di `.env.example` | Opsional | `./models` |

### Frontend (`agrochie-web/.env.local`)

Tidak ada `.env.example` yang dilacak git. Variabel berikut dibaca dari kode:

| Variabel | Fungsi | Wajib | Contoh aman |
| --- | --- | --- | --- |
| `API_PROXY_TARGET` | Alamat backend untuk proxy `/api/*` (bawaan `http://127.0.0.1:3000`) | Opsional | `http://127.0.0.1:3000` |
| `NEXT_PUBLIC_DETECTION_MAX_MB` | Batas ukuran foto di sisi klien (bawaan 5); samakan dengan `DETECTION_MAX_MB` | Opsional | `5` |


## Ringkasan API

Semua path berawalan `/api`. Semua endpoint **butuh sesi** (cookie), kecuali `GET /health`, `POST /auth/register`, `POST /auth/login`, dan `POST /auth/guest`. Data milik pengguna lain dijawab 404.

| Modul | Metode dan path | Fungsi |
| --- | --- | --- |
| Umum | `GET /health` | Cek layanan |
| Auth | `POST /auth/register` | Daftar |
| | `POST /auth/login` | Masuk |
| | `POST /auth/guest` | Sesi tamu |
| | `GET /auth/me` | Data sesi saat ini |
| | `POST /auth/logout` | Keluar |
| Farms | `GET /farms`, `POST /farms` | Daftar dan buat lahan |
| | `GET /farms/:id`, `PATCH /farms/:id` | Detail dan ubah lahan |
| | `GET /farms/:farmId/seasons`, `POST /farms/:farmId/seasons` | Daftar dan buat musim |
| Seasons | `GET /seasons/:id`, `PATCH /seasons/:id` | Detail dan ubah musim |
| | `POST /seasons/:id/start-financing`, `/predict-cost`, `/recalc-cost`, `/stop-financing` | Pembiayaan dan prediksi biaya |
| | `POST /seasons/:id/start-planting`, `/close` | Mulai tanam dan tutup musim |
| | `GET /seasons/:id/weather` | Cuaca musim |
| | `GET`, `POST /seasons/:id/harvests` | Panen |
| | `GET /seasons/:id/sample`, `PUT /seasons/:id/sample` | Sampel panen |
| | `GET`, `POST /seasons/:id/photos` | Data foto musim |
| | `POST /seasons/:id/photos/upload`, `GET /seasons/:id/photos/:photoId/file` | Unggah dan baca berkas foto |
| | `GET /seasons/:id/checklist`, `PUT /seasons/:id/checklist/:taskKey` | Daftar periksa mingguan |
| | `GET`, `POST /seasons/:id/loans` | Rujukan pinjaman |
| Expenses | `GET /seasons/:id/expenses`, `GET /seasons/:id/expenses/summary` | Daftar dan ringkasan pengeluaran |
| | `POST /seasons/:id/expenses`, `DELETE /seasons/:id/expenses/:expenseId` | Tambah dan hapus pengeluaran |
| Cuaca | `GET /weather/current?latitude=&longitude=` | Cuaca saat ini |
| | `GET /weather/forecast?latitude=&longitude=` | Prakiraan |
| Asisten | `POST /assistant/chat` | Kirim pesan (dibatasi 20 per 10 menit) |
| | `GET /assistant/sessions/:id` | Ambil sesi chat |
| Deteksi tanaman | `POST /deteksi-tanaman` | Unggah foto dan analisis |
| | `GET /deteksi-tanaman`, `GET /deteksi-tanaman/:id` | Riwayat dan detail |
| | `GET /deteksi-tanaman/:id/foto` | Foto hasil deteksi |
| | `POST /deteksi-tanaman/:id/ke-catatan` | Tambahkan ke Catatan biaya |
| Crops | `POST /crops/leaf-quality` | Kualitas daun (foto base64) |
| History | `GET /history` | Riwayat musim |

Engine (internal, butuh header `x-internal-key`): `POST /predict/cost`, `POST /predict/leaf`. `GET /health` pada engine tidak memerlukan kunci.

## Menjalankan tes

**Backend** (`node --test`):

```powershell
cd backend
npm test
```

Sebagian tes (berakhiran `.db.test.js`) membuat dan menghapus data, sehingga hanya berjalan bila `DATABASE_URL` menunjuk ke database yang namanya mengandung `_test` (misalnya `agrochie_test`, dengan migrasi sudah diterapkan). Bila tidak, tes tersebut otomatis dilewati. Jangan mengarahkan `DATABASE_URL` ke database berisi data penting saat menjalankan tes.

**Frontend** (tidak ada skrip tes; tersedia lint dan build):

```powershell
cd agrochie-web
npm run lint
npx tsc --noEmit
npm run build
```

**Engine** (pytest, dengan virtual environment aktif):

```powershell
cd engine
python -m pytest
```


## Catatan penting dan keterbatasan

- **Cakupan model CNN.** Model kualitas tanaman hanya mengenali kelas yang pernah dilatih: cabai (cercospora, sehat, keriting daun/kompleks murda, gangguan hara, embun tepung) dan tomat (bercak bakteri, jamur hitam, bercak abu-abu, hawar daun, sehat, embun tepung). Komoditas atau penyakit lain tidak dikenali. Hasil berkeyakinan rendah dianggap "tidak yakin".
- **Estimasi biaya dari AI hanyalah perkiraan** dan bukan pengganti penyuluh pertanian.
- **Kuota Gemini.** Free tier memiliki kuota kecil sehingga bisa muncul galat sibuk atau kuota habis. Fallback deteksi ke Gemini menambah pemakaian kuota (hingga 4 panggilan per analisis).
- **Cuaca** bergantung pada Open-Meteo; bila tidak terjangkau, API menjawab 503.
- **Prediksi biaya** butuh engine yang berjalan dan data lahan lengkap; tanpa itu musim tetap berstatus draf. Tidak ada nilai cuaca atau biaya buatan sebagai pengganti.
- **Foto** disimpan di disk lokal (`backend/uploads`, tidak masuk repositori) untuk pengembangan. Untuk produksi, gunakan penyimpanan objek dan lakukan audit keamanan.
- **Rujukan pinjaman** hanya kode rujukan tersimpan; tidak terhubung ke bank dan bukan persetujuan bank.
- **Lahan** direpresentasikan oleh satu titik koordinat, bukan batas poligon.

## Struktur folder

```text
Fintechton/
├── agrochie-web/        # Frontend Next.js (port 3001)
│   ├── public/
│   └── src/             # app (rute), components, config, features, providers
├── backend/             # API Express 5 + Prisma (port 3000)
│   ├── knowledge/       # dokumen sumber RAG asisten (.md)
│   ├── prisma/          # schema.prisma, migrations, seed
│   ├── scripts/         # ingest-knowledge.js
│   ├── src/             # config, controllers, middleware, routes, services, utils
│   └── tests/           # tes node --test
├── engine/              # FastAPI + model (port 8000)
│   ├── app/             # api, core, ml, schemas, services
│   ├── models/          # biaya_musim, biaya_mingguan, kualitas_tanaman
│   ├── scripts/
│   └── tests/           # tes pytest
├── legacy_frontend/     # arsip frontend lama, tidak dipakai/dikompilasi
└── README.md
```

## Kontribusi

- Kerjakan perubahan di branch terpisah (riwayat memakai pola seperti `feat/...`), bukan langsung di `main`.
- Pesan commit mengikuti pola Conventional Commits dengan cakupan, misalnya `feat(deteksi): ...`, `fix(cuaca): ...`, `chore: ...`.
- Jalankan tes terkait sebelum commit.
- Jangan meng-commit `.env`, kunci, atau data pengguna.

## Lisensi

TODO: perlu dilengkapi. Berkas `LICENSE` tidak ditemukan di repositori.

