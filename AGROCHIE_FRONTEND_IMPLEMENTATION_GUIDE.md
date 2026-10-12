# AGROCHIE — FRONTEND IMPLEMENTATION BLUEPRINT

> **Dokumen instruksi implementasi frontend** · Versi 1.0 · 12 Oktober 2026  
> **Tujuan:** Menjadi spesifikasi yang bisa langsung dipakai developer atau AI coding agent untuk membangun frontend AgroChie yang modular, reusable, ringan, responsif, dan mudah dipahami petani.  
> **Tema wajib:** putih dan hijau; **font utama:** Nunito.  
> **Output pekerjaan:** kode frontend Next.js yang berfungsi, bukan sekadar mockup layar.

## 0. Konteks, acuan, dan batas pekerjaan

Baca dan pertahankan informasi dari berkas berikut sebelum coding:

1. `AgroChie_Dokumen_Prototipe_v2.pdf` (8 Oktober 2026): konsep, alur tiga langkah, proses riwayat/data latih, baseline biaya, rencana teknologi, keterbatasan.
2. `AgroChie_Breakdown_Fitur_MVP_v2.pdf` (8 Oktober 2026): fitur F1–F14, klasifikasi P0/P1/P2, dependensi, kriteria selesai.
3. `AgroChie.html`: referensi struktur navigasi, teks, skenario, dan interaksi prototipe. **Jangan menyalin keseluruhan HTML/JS monolitik atau menganggap semua label 'AI' di file itu benar-benar AI.**

**Fakta dari sumber:** frontend produksi direncanakan memakai Next.js; backend Express.js, Prisma/PostgreSQL; engine biaya Python/XGBoost; cuaca Open-Meteo; Gemini untuk asisten; CNN TensorFlow.js untuk indikasi tanaman. Di prototipe awal, fitur biaya/rentan/risiko menggunakan aturan dan Monte Carlo, sementara XGBoost/CNN/Gemini belum terpasang.

**Keputusan implementasi frontend dalam dokumen ini** (rekomendasi teknis, bukan klaim sudah tertulis pada dokumen sumber): Next.js App Router + TypeScript strict + Tailwind CSS + React Hook Form/Zod + TanStack Query + Lucide icons + Recharts. Gunakan komponen dasar internal yang dapat digunakan ulang; tidak perlu menambahkan UI framework besar. Bila ada dependensi tambahan, tambahkan hanya untuk kebutuhan konkret.

### Aturan mutlak pengerjaan

- Fokus **frontend**. Jangan membangun ulang backend, melatih model AI, mengubah aturan bisnis, atau mengubah file sumber tanpa instruksi terpisah.
- Pertahankan menu, fungsi, alur, prioritas, nilai acuan, serta aturan dataset dari dokumen. Perbaikan UI/UX boleh dilakukan selama tidak mengubah maksud bisnis.
- Semua screen dapat memakai **mock typed data** melalui repository adapter, sehingga dapat diuji sebelum API Express tersedia. Mock **harus diberi label “Data contoh” / “Simulasi”**, tidak boleh diposisikan sebagai hasil pengukuran atau AI sungguhan.
- Implementasikan jalur P0 terlebih dahulu, lalu P1, lalu P2. Untuk P2 yang belum mempunyai servis nyata, bangun UI yang jujur (preview/coming soon atau simulasi berlabel) dan jangan membuat klaim kemampuan palsu.
- Perhitungan uang harus menggunakan utilitas bersama. Semua biaya aktual berasal dari data pengeluaran yang benar-benar dicatat, **bukan dari prediksi atau angka mock**.
- Gunakan bahasa Indonesia yang sederhana; hindari istilah statistik/teknis tanpa penjelasan.
- Tidak boleh ada komponen menu yang berisi seluruh logika aplikasi. Pecah berdasarkan domain fitur dan tanggung jawab masing-masing.
- Jangan menambahkan fitur berat yang tidak tercantum di MVP: marketplace pertanian, administrasi bank penuh, sistem pembayaran pinjaman, diagnosis AI otomatis, ataupun analitik enterprise.

---

## 1. Sasaran produk dan user journey utama

**Masalah pengguna:** petani hortikultura berisiko kehabisan modal di tengah musim karena tidak memiliki estimasi biaya per musim dan jadwal pengeluaran yang cukup jelas.

**Nilai utama:** mengetahui **berapa biaya**, **kapan uang dibutuhkan**, dan **apakah modal cukup sampai panen**. Dokumentasi pengeluaran dan hasil panen menjadi riwayat; catatan yang layak dapat dipakai meningkatkan model pada masa depan dan sebagai pendukung pengajuan pinjaman.

### State utama perjalanan pengguna

```text
LANDING / AUTH
   ↓
PROFIL LAHAN (F1)
   ↓
MULAI PERHITUNGAN PEMBIAYAAN (F2)
   ├─ Batal → tidak menampilkan angka uang di aplikasi
   └─ Mulai → snapshot rencana awal, buka menu keuangan
         ↓
PREDIKSI MUSIM (F3) + RENCANA BIAYA / KALENDER UANG (F4)
         ↓
MULAI PENANAMAN (F5) → minggu ke-1
         ↓
MONITORING: CATATAN (F7), CUACA & LAHAN (F6), PENGINGAT (F10)
         ├─ Jika modal kurang → RISIKO & KREDIT (F8)
         ↓
PANEN: HASIL, MUTU, HARGA, PEMBELI, SAMPEL & FOTO (F5)
         ↓
TUTUP MUSIM → RIWAYAT MUSIM (F11)
         ├─ Data lengkap → berstatus Siap dilatih / Siap, total biaya saja
         └─ Ada data kurang → Belum lengkap; lengkapi manual
         ↓
MUSIM BARU → ulangi alur; musim lama tetap tersimpan
```

**Catatan penting urutan minggu:** dokumen menyebut hari tombol “Mulai penanaman” sebagai minggu 1, sementara dua minggu pertama di dataset termasuk fase **persiapan lahan**. UI wajib memberi keterangan yang mudah dimengerti, misalnya: “Tanggal mulai musim ini digunakan sebagai awal minggu 1, termasuk persiapan lahan.” Jangan menggeser minggu dengan asumsi lain.

### Finite-state sederhana

| Status | Boleh dilakukan | Tidak boleh dilakukan |
|---|---|---|
| `PROFILE_INCOMPLETE` | Isi profil, lihat cuaca non-keuangan, pengingat, musim | Tampilkan angka pembiayaan tanpa langkah Mulai |
| `FINANCING_NOT_STARTED` | Klik Mulai/Batal, lihat menu terbuka non-keuangan | Tampilkan angka rupiah di menu aplikasi |
| `FINANCING_ACTIVE` | Prediksi, rencana biaya, kalender, catatan, kredit, mulai tanam | Panen sebelum mulai tanam |
| `PLANTING_ACTIVE` | Catat biaya, monitoring, catat panen, ajukan pembiayaan | Tutup musim bila bukti/biaya wajib belum ada |
| `SEASON_CLOSED` | Lihat laporan, riwayat, ekspor data sesuai kualitas | Ubah musim tertutup secara diam-diam |

Gunakan state domain `season.status`, `financingStartedAt`, `plantingStartedAt`, `closedAt` untuk seluruh komponen. **Jangan menyimpan status musim secara terpisah di banyak halaman.**

---

## 2. Design system: putih, hijau, dan Nunito

### 2.1 Arah visual

Kesan visual: bersih, hangat, tepercaya, lapang, fokus pada 1 aksi utama per layar. Gunakan halaman putih dengan aksen hijau, bukan seluruh permukaan berwarna hijau. Hindari kartu bertumpuk berlebihan, gradasi mencolok, bayangan tebal, angka terlalu rapat, dan dashboard yang menyerupai aplikasi trading.

#### Token warna wajib (boleh disesuaikan tipis untuk kontras)

| Token | HEX | Penggunaan |
|---|---|---|
| `--background` | `#FFFFFF` | Latar halaman utama |
| `--surface` | `#FFFFFF` | Kartu, dialog, form |
| `--surface-muted` | `#F5FAF6` | Zona tenang, card pendukung |
| `--primary` | `#176B43` | Tombol utama, sidebar aktif, tautan penting |
| `--primary-hover` | `#125535` | Hover tombol |
| `--primary-soft` | `#E6F4EA` | Badges ringan, item terpilih |
| `--primary-ink` | `#0D472B` | Teks hijau yang harus jelas |
| `--text` | `#1C2B22` | Isi dan heading |
| `--text-muted` | `#65746A` | Keterangan sekunder |
| `--border` | `#E3EDE6` | Border kartu/input |
| `--danger` | `#C2413B` | Kesalahan, risiko, kekurangan modal |
| `--warning` | `#A26311` | Peringatan/periksa kembali |
| `--success` | `#176B43` | Sukses |

Gunakan **warna bukan satu-satunya indikator kondisi**: selalu sertakan teks, ikon, atau label. `danger` hanya untuk masalah nyata, jangan dipakai sebagai aksen dekoratif.

### 2.2 Tipografi

- Gunakan `Nunito` melalui `next/font/google`; jangan menggunakan Google Fonts `<link>` manual pada produksi jika `next/font` sudah dipakai.
- Heading `700–800`; angka penting `800`; body `400–600`.
- Body desktop dan mobile: **16px minimum**; metadata kecil 13–14px hanya bila kontras memadai.
- Gunakan angka tabular untuk kolom keuangan. Rupiah diformat `id-ID` dengan fungsi bersama.
- Hirarki: judul halaman 28–32px, section 19–22px, body 16px, caption 13–14px.
- Mikrocopy singkat: “Perkiraan biaya”, “Modal tersedia”, “Kurang modal”, “Pengeluaran tercatat”.

### 2.3 Layout dan responsivitas

| Area | Desktop ≥1024px | Tablet 768–1023px | Mobile <768px |
|---|---|---|---|
| Navigasi | Sidebar tetap kiri + topbar | Sidebar ringkas/collapsible | Bottom navigation untuk 6 menu utama + menu Semua fitur |
| Konten | `max-width` konten ~1280px, padding 24–32px | Padding 20–24px | Padding 16px, area klik min 44px |
| Grid KPI | 3–4 kolom bila muat | 2 kolom | 1–2 kolom |
| Form | Maksimal 2 kolom; urutan alami | 1–2 kolom | 1 kolom |
| Tabel | Tabel responsif atau horizontal scroll yang jelas | Scroll berlabel | Ringkas ke kartu daftar |
| Modal | Dialog terpusat | Dialog | Bottom sheet bila cocok |
| Grafik | Responsif, tooltip aksesibel | Responsif | Grafik sederhana + ringkasan teks |

Navigasi mobile utama sesuai prototipe: **Beranda, Musim, Cek lahan, Prediksi, Asisten, Profil**. Menu lainnya masuk **Semua fitur** agar tetap mudah ditemukan; boleh memberikan shortcut sesuai konteks. Jangan membuat 12 ikon terlalu kecil di navigasi bawah.

### 2.4 Komponen UI global

`AppShell`, `Sidebar`, `MobileBottomNav`, `MobileFeatureMenu`, `TopBar`, `PageHeader`, `AppButton`, `TextField`, `NumberField`, `CurrencyField`, `SelectField`, `DateField`, `TextareaField`, `SegmentedTabs`, `StatCard`, `SummaryCard`, `EmptyState`, `LoadingSkeleton`, `ErrorState`, `ConfirmDialog`, `StepProgress`, `SectionCard`, `InfoNotice`, `SourceBadge`, `StatusBadge`, `MoneyText`, `PercentText`, `SimpleDataTable`, `ResponsiveChart`, `PhotoUploader`, `ConsentCheckbox`.

**Ketentuan:** satu implementasi reusable tiap komponen; semua halaman memakai token yang sama; jangan membuat variasi tombol/header/form baru hanya karena berada di folder fitur berbeda.

### 2.5 Aturan UX

- Tiap layar menunjukkan: **di mana pengguna berada → apa artinya → apa aksi berikutnya**.
- Untuk angka penting, tampilkan nilai dan penjelasan singkat. Contoh: “Rp 42 juta — perkiraan biaya satu musim, bukan tagihan.”
- Gunakan `loading`, `empty`, `error`, `success`, `offline`, `no-permission`, dan `simulated` states, jangan hanya satu tampilan kondisi ideal.
- Simpan progres form panjang per langkah; tampilkan dialog konfirmasi untuk menutup musim, menghapus riwayat, dan membagikan data.
- Tidak boleh menyimpan pengeluaran dua kali akibat submit berulang; disable tombol saat mutasi berjalan.
- Validasi dekat field, fokus otomatis ke field bermasalah, dan format uang dengan satuan jelas.
- Keputusan pembiayaan bank **tidak boleh** digambarkan sebagai keputusan aplikasi.

---

## 3. Stack dan prinsip arsitektur frontend

### Stack disarankan

```text
Next.js (App Router)
TypeScript: strict mode
Tailwind CSS: styling berbasis design tokens
next/font/google: Nunito
lucide-react: ikon
React Hook Form + Zod: form dan validasi
TanStack Query: server state, cache, loading/error, invalidasi
Recharts: grafik kebutuhan uang / biaya
Vitest + Testing Library: unit/component tests
Playwright: E2E alur pengguna
```

Jangan menambah state manager global bila belum dibutuhkan. **TanStack Query** untuk data dari repository/API; **React state** untuk input, modal, tab, dan komponen lokal. Jika state UI lintas komponen mulai kompleks, tambahkan store kecil setelah kebutuhan terbukti. `localStorage` boleh dipakai hanya sebagai **mock repository / guest persistence** pada fase awal, bukan sebagai autentikasi aman produksi.

### Prinsip implementasi

1. **Feature-first:** tiap fitur punya `components`, `hooks`, `queries`, `service/repository`, `schemas`, dan `types` bila dibutuhkan; tidak wajib membuat subfolder kosong.
2. **Separation of concerns:** halaman hanya merangkai UI; aturan biaya, tanggal, dan kualitas data berada di modul domain murni.
3. **Dependency direction:** `app → features → domain/shared → infrastructure`. Modul `shared` tidak mengimpor dari `features`; halaman fitur lain mengakses data lewat query/facade, bukan mengimpor komponen internal fitur secara acak.
4. **Repository adapter:** komponen tidak memanggil `fetch`, Open-Meteo, Gemini, atau engine Python secara langsung. Interaksi melalui interface repository, dengan implementasi mock atau HTTP.
5. **Jaga konsistensi:** semua perhitungan memakai tipe dan helper tersentralisasi; cache di-invalidate setelah mutasi.
6. **Avoid overengineering:** jangan membuat microfrontend, plugin system, event bus besar, 15 abstractions CRUD, atau global store raksasa.
7. **Progressive enhancement:** UI inti tetap berguna saat API AI belum ada; PWA/offline bisa tahap lanjut.
8. **Accessible first:** gunakan elemen HTML semantik, keyboard navigation, focus trap pada dialog, input label, error feedback, dan kontras memadai.

---

## 4. Struktur direktori proyek yang harus dibuat

> Struktur di bawah adalah target **organisasi kode**. Hanya buat file yang benar-benar dipakai. Hindari file boilerplate kosong dan index barrel yang menyebabkan circular imports.

```text
agrochie-web/
├── public/
│   ├── icons/                      # Logo/ikon milik AgroChie (bukan font files)
│   ├── illustrations/              # Ilustrasi ringan lokal / optional
│   └── manifest.webmanifest        # Setelah PWA diperlukan
├── src/
│   ├── app/
│   │   ├── layout.tsx              # Root layout + Nunito + QueryProvider
│   │   ├── globals.css             # Tailwind + CSS tokens
│   │   ├── not-found.tsx
│   │   ├── (marketing)/
│   │   │   └── page.tsx            # Landing
│   │   ├── (auth)/
│   │   │   ├── masuk/page.tsx
│   │   │   ├── daftar/page.tsx
│   │   │   └── layout.tsx
│   │   └── (farmer)/
│   │       ├── layout.tsx          # Session boundary + AppShell
│   │       ├── beranda/page.tsx
│   │       ├── musim-tanam/page.tsx
│   │       ├── prediksi/page.tsx
│   │       ├── rencana-biaya/page.tsx
│   │       ├── kalender-uang/page.tsx
│   │       ├── cuaca-lahan/page.tsx
│   │       ├── catatan/page.tsx
│   │       ├── risiko-kredit/page.tsx
│   │       ├── pengingat/page.tsx
│   │       ├── riwayat-musim/page.tsx
│   │       ├── riwayat-musim/[seasonId]/page.tsx
│   │       ├── asisten/page.tsx
│   │       └── profil/page.tsx
│   ├── components/
│   │   ├── layout/
│   │   │   ├── AppShell.tsx
│   │   │   ├── Sidebar.tsx
│   │   │   ├── MobileBottomNav.tsx
│   │   │   ├── MobileFeatureMenu.tsx
│   │   │   └── TopBar.tsx
│   │   ├── ui/
│   │   │   ├── AppButton.tsx
│   │   │   ├── PageHeader.tsx
│   │   │   ├── SectionCard.tsx
│   │   │   ├── StatCard.tsx
│   │   │   ├── EmptyState.tsx
│   │   │   ├── FeedbackState.tsx
│   │   │   ├── StatusBadge.tsx
│   │   │   ├── ConfirmDialog.tsx
│   │   │   ├── StepProgress.tsx
│   │   │   ├── ResponsiveChart.tsx
│   │   │   └── MoneyText.tsx
│   │   └── forms/
│   │       ├── FormField.tsx
│   │       ├── CurrencyField.tsx
│   │       ├── DateField.tsx
│   │       ├── PhotoUploader.tsx
│   │       └── ConsentCheckbox.tsx
│   ├── config/
│   │   ├── navigation.ts          # Menu + urutan + prioritas + ikon
│   │   ├── feature-flags.ts        # Status fitur AI dan P2
│   │   ├── constants.ts            # Komoditas, durasi/fase, kategori
│   │   └── env.ts                  # Env vars frontend yang aman
│   ├── domain/
│   │   ├── models/
│   │   │   ├── farmer.ts
│   │   │   ├── farm.ts
│   │   │   ├── season.ts
│   │   │   ├── finance.ts
│   │   │   ├── expense.ts
│   │   │   ├── harvest.ts
│   │   │   ├── history.ts
│   │   │   └── loan.ts
│   │   ├── calculations/
│   │   │   ├── money.ts            # Rupiah <-> jumlah biaya API
│   │   │   ├── seasons.ts          # Minggu, fase, tanggal, total durasi
│   │   │   ├── baseline-cost.ts    # Hanya adapter/mock baseline
│   │   │   ├── cashflow.ts         # Arus kas, modal habis, selisih
│   │   │   ├── profitability.ts    # Harga impas dan profit
│   │   │   ├── history-quality.ts  # Status kualitas record
│   │   │   └── history-export.ts   # 32 kolom dalam urutan baku
│   │   └── validation/
│   │       └── business-rules.ts
│   ├── features/
│   │   ├── auth/                   # AuthForm, useSession, auth repository
│   │   ├── profile/                # ProfileForm, FarmForm, LocationPicker
│   │   ├── dashboard/              # FinanceHero, WeekTaskList, AlertList
│   │   ├── season/                 # FinancingStartDialog, PlantingStep,
│   │   │                             HarvestForm, HarvestSampleForm,
│   │   │                             SeasonStepper, CloseSeasonDialog
│   │   ├── prediction/             # PredictionSummary, PredictionRange,
│   │   │                             ScenarioControls, PredictionDrivers
│   │   ├── budget/                 # PhaseBreakdown, CategoryBreakdown,
│   │   │                             BudgetVariance, BreakEvenCard
│   │   ├── cashflow/               # WeeklyCashflowChart, CashShortageCard
│   │   ├── field/                  # WeatherTab, SoilTab, PlantTab,
│   │   │                             FieldEvidenceTab
│   │   ├── expense/                # ExpenseForm, ExpenseList, ExpenseFilters
│   │   ├── credit/                 # CreditReadiness, LoanApplicationForm,
│   │   │                             ReferralStatus
│   │   ├── reminders/              # WeeklyChecklist, ReminderSettings
│   │   ├── history/                # SeasonHistoryList, HistoryDetail,
│   │   │                             HistoryEditForm, TrainingQualityCard
│   │   └── assistant/              # AssistantChat, SuggestedQuestions,
│   │                                 AssistantUnavailableState
│   ├── hooks/
│   │   ├── useActiveSeason.ts
│   │   ├── useFinancingGate.ts
│   │   ├── useOnlineStatus.ts
│   │   └── useDebouncedValue.ts
│   ├── infrastructure/
│   │   ├── api/
│   │   │   ├── http-client.ts      # HTTP errors, auth, abort, base URL
│   │   │   ├── endpoints.ts
│   │   │   └── dto-mappers.ts
│   │   ├── repositories/
│   │   │   ├── contracts.ts        # Interface seluruh repository
│   │   │   ├── index.ts            # Pilih mock / HTTP
│   │   │   ├── http/               # Express API implementation
│   │   │   └── mock/               # Mock repo dan fixtures deterministik
│   │   └── persistence/
│   │       └── guest-storage.ts    # Guest only, versioned storage key
│   ├── providers/
│   │   └── QueryProvider.tsx
│   ├── lib/
│   │   ├── dates.ts
│   │   ├── formatters.ts
│   │   ├── assert.ts
│   │   └── cn.ts
│   └── test/
│       ├── fixtures/
│       ├── unit/
│       ├── integration/
│       └── e2e/
├── .env.example
├── eslint.config.mjs
├── next.config.ts
├── package.json
├── tsconfig.json
└── README.md
```

### Aturan tanggung jawab file

- `app/**/page.tsx`: susun section dan ambil query. Jangan menyimpan formula besar atau mock literals.
- `features/*/components`: tampilan domain-spesifik. Komponen menggunakan props bertipe; jangan mengakses `localStorage` dari JSX.
- `domain/calculations/*`: pure functions tanpa React, network, dan waktu global tersembunyi; input seperti tanggal sekarang diberikan secara eksplisit.
- `repositories/contracts.ts`: kontrak; `mock/` dan `http/` punya shape return yang sama.
- `config/navigation.ts`: sumber tunggal navigasi desktop/mobile.
- `feature-flags.ts`: tandai `unavailable | demo | ready`, bukan boolean acak yang tersebar.
- **Konsisten antara server/client components:** server component default; tambahkan `'use client'` hanya pada UI yang interaktif atau memerlukan browser API.

---

## 5. Routing dan daftar menu

| Route | Menu / tampilan | Fitur | Prioritas | Gate angka uang |
|---|---|---|---|---|
| `/` | Landing + informasi produk | Marketing | Public | Estimasi rupiah hanya setelah aksi mulai yang eksplisit |
| `/masuk`, `/daftar` | Autentikasi / guest demo | F1 | P0 | — |
| `/profil` | Profil petani & lahan | F1 | P0 | Terbuka |
| `/musim-tanam` | 3 langkah musim: pembiayaan, penanaman, panen | F2, F5 | P0 | Terbuka, tetapi angka hanya sesudah Mulai |
| `/prediksi` | Prediksi total + rentang + skenario | F3 | P0 | Terkunci sebelum Mulai |
| `/rencana-biaya` | Alokasi fase & kategori; harga impas | F4, F12 | P0 + P2 | Terkunci sebelum Mulai |
| `/kalender-uang` | Biaya mingguan, arus kas, modal habis | F4 | P0 | Terkunci sebelum Mulai |
| `/cuaca-lahan` | Cuaca, tanah, tanaman, foto bukti | F6, F13 | P1 + P2 | Terbuka, komponen rupiah tetap tersembunyi |
| `/catatan` | Catatan pengeluaran aktual | F7 | P1 | Terkunci sebelum Mulai |
| `/risiko-kredit` | Kesiapan kredit dan ajuan pinjaman | F8 | P1 | Terkunci sebelum Mulai |
| `/beranda` | Ringkasan dan tindakan minggu ini | F9 | P1 | Beranda muncul, isi uang diganti ajakan Mulai |
| `/riwayat-musim` | Riwayat & status kualitas data | F11 | P1 | Terkunci sebelum Mulai dalam alur prototipe |
| `/pengingat` | Checklist cek lahan per minggu | F10 | P2 | Terbuka |
| `/asisten` | Tanya jawab pertanian/keuangan | F14 | P2 | Terkunci sebelum Mulai; tidak mengklaim Gemini aktif |

**Catatan keputusan UI:** landing publik memiliki kalkulator cepat pada prototipe HTML yang menampilkan biaya langsung. Namun dokumen prototipe menetapkan “tidak ada angka uang sebelum Mulai”. Supaya konsisten, ubah preview landing menjadi **input komoditas/luas + tombol “Mulai hitung perkiraan”** yang secara eksplisit memulai alur kalkulasi demo atau mengarahkan ke proses pembiayaan. Jangan menghitung dan menampilkan rupiah secara otomatis saat page load.

---

## 6. Spesifikasi lengkap tiap menu dan isi UI

### 6.1 Landing (`/`) — public

**Tujuan:** pengguna memahami manfaat dalam beberapa detik dan dapat memulai tanpa jargon.

**Bagian yang harus tampil:**

1. Header: logo AgroChie, “Cara kerja”, “Manfaat”, “Masuk” dan tombol **Mulai sekarang**.
2. Hero: judul **“Tahu biaya tanam sebelum mulai menanam.”**; deskripsi singkat tentang biaya, jadwal uang, dan risiko modal; CTA utama.
3. Kalkulator pengantar: pilihan komoditas `cabai merah / tomat / bawang merah`, luas lahan `0,1–3 ha`, tombol jelas **“Mulai hitung perkiraan”**. Sebelum tombol ditekan, jangan tampilkan angka uang. Setelah ditekan, hasil demo **wajib berlabel estimasi berbasis aturan / data contoh**, bukan “AI sudah akurat”.
4. Tiga manfaat: **Berapa biaya**, **Kapan uang keluar**, **Apa yang perlu dilakukan minggu ini**.
5. “Cara kerja” tiga langkah: isi profil → rencana/kalender → catat musim dan panen.
6. CTA akhir dan footer sederhana berisi disclaimer prototipe.

**Interaksi:** CTA ke `/daftar` atau `/masuk`; bila guest demo tersedia, jelaskan penyimpanan data lokal dan batasannya. Landing responsif, tanpa testimonial palsu atau klaim akurasi model.

### 6.2 Autentikasi (`/masuk`, `/daftar`)

- Form masuk: email atau identitas login yang nantinya didukung backend, kata sandi, tombol Masuk, tautan Daftar. Dokumen mendefinisikan akun dan nomor HP profil tetapi tidak menentukan mekanisme login email/HP final; **implementasi email vs nomor HP harus diselaraskan dengan kontrak backend**.
- Form daftar: identitas dasar seperlunya, sandi, konfirmasi sandi, persetujuan privasi.
- Tombol “Coba sebagai tamu” hanya bila guest demo aktif; tampilkan peringatan data tidak terjamin tersimpan lintas perangkat.
- Loading/error yang aman; jangan menampilkan detail server credential.
- Pada produksi, session cookie harus dikelola backend. Jangan mengimplementasikan hash password di frontend sebagai autentikasi produksi.

### 6.3 Profil (`/profil`) — F1 / P0

**Header:** “Profil dan lahan” + progress **Kelengkapan data**. Bagian form dibuat menjadi empat card terpisah agar mudah dipindai:

1. **Identitas petani:** nama, nomor HP, desa/kecamatan, kelompok tani (opsional).
2. **Data lahan:** nama lahan (bila ada banyak lahan), komoditas, luas (ha), jenis tanah (5 opsi dari dataset), sumber air (4 opsi), provinsi (5 opsi cakupan dataset), koordinat GPS lintang/bujur dengan izin dan tautan periksa titik di peta, rencana tanggal mulai musim.
3. **Kondisi tanah:** pH, tanggal pengukuran pH, nitrogen/fosfor/kalium masing-masing `rendah | sedang | tinggi`.
4. **Rencana keuangan:** modal tersedia, perkiraan harga jual per kg, target laba. **Input ini boleh ada meskipun pembiayaan belum dimulai; output hitungan uang tetap disembunyikan sebelum Mulai.**

**Aksi:** simpan profil, perbarui lokasi, kelola lahan; bila memilih lahan/komoditas lain, tampilkan konfirmasi efek pada prediksi dan apakah perlu hitung ulang. Tidak otomatis mengganti snapshot awal pembiayaan.

**Validasi:** luas >0, dataset latih mendukung **0,1–3 ha**, sedangkan profil bisa hingga **5 ha**; di luar 3 ha harus muncul label **“Di luar cakupan data pelatihan awal”** dan UI dilarang menyebut hasil pasti. pH wajar; koordinat valid `lat -90…90`, `lng -180…180`; NPK enum; field kosong tidak diisi tebakan.

**Empty state:** “Lengkapi data lahan agar rencana biaya lebih sesuai.”

### 6.4 Musim tanam (`/musim-tanam`) — F2/F5 / P0

Tampilkan `SeasonStepper` berisi tepat tiga bagian utama. Pada mobile gunakan step vertikal yang mudah diikuti.

**Langkah 1 — Mulai perhitungan pembiayaan**

- Card ringkasan komoditas dan luas dari profil, **tanpa rupiah sebelum dimulai**.
- Tombol **Mulai perhitungan pembiayaan** membuka `FinancingStartDialog` dengan aksi **Mulai / Batal** dan input modal (opsional).
- **Mulai:** simpan tanggal mulai pembiayaan dan snapshot rencana biaya, `p10/p50/p90`, modal, kekurangan, versi sumber prediksi. Aktifkan tampilan keuangan pada aplikasi.
- **Batal:** tutup dialog; tetap tidak ada angka uang.
- Setelah aktif: lihat ringkasan awal; tombol **Hitung ulang dari data terbaru** dan **Hentikan perhitungan**. Bedakan nilai awal dan nilai terkini, jangan overwrite snapshot diam-diam.

**Langkah 2 — Mulai penanaman**

- Terkunci sebelum langkah 1 selesai.
- Pilihan tanggal mulai musim dan tombol **Mulai penanaman (minggu 1)**.
- Setelah aktif: label “Minggu X dari N”, fase saat ini, tanggal perkiraan panen, progress; N = 16/14/10 sesuai komoditas.
- Jelaskan bahwa minggu 1 mencakup persiapan lahan menurut penyelarasan dataset.
- Validasi tanggal dan konfirmasi perubahan tanggal bila catatan pengeluaran sudah ada.

**Langkah 3 — Panen & tutup musim**

- Terkunci sebelum langkah 2.
- Daftar entri panen yang dapat ditambah/diedit/dihapus: tanggal, mutu `A/B/C/sortiran`, berat kg, harga jual per kg, pembeli/pasar.
- Ringkasan berat total, pendapatan kotor, harga jual rata-rata.
- **Sampel panen:** berat sampel (kg), luas petak contoh (m²), foto bukti minimal 1 dan maksimal 6; tampilkan metadata waktu serta lokasi **hanya jika berhasil didapat**. Jangan memberi badge “terverifikasi” jika metadata tidak mendukung.
- **Tutup musim:** total biaya **aktual** dalam rupiah/juta rupiah, catatan hama/cuaca/harga, ringkasan untung/rugi, tombol “Selesaikan panen dan simpan ke riwayat”. Bila tidak ada pengeluaran tercatat, jumlah biaya **kosong sampai diisi pengguna**, bukan angka prediksi.
- Setelah tutup: tunjukkan perbandingan total panen dengan estimasi sampel; selisih absolut >30% ditandai untuk dicek; tampilkan CTA Riwayat musim / Mulai musim baru.

**Validasi wajib untuk tutup:** minimal satu entri panen, berat dan luas sampel >0, minimal satu foto, total biaya aktual >0. Konfirmasi sebelum submit dan cegah penutupan ganda. Record dataset tercipta setelah proses sukses.

### 6.5 Prediksi musim (`/prediksi`) — F3 / P0

**Tujuan:** petani tahu kebutuhan biaya total dan ketidakpastian, tanpa memberi kesan angka jaminan.

**UI yang wajib ada:**

1. `PredictionSummary`: nilai tengah **P50**, rentang **P10–P90 (rentang 80%)**, estimasi per hektare dan durasi.
2. `AffordabilityCard`: **peluang biaya melebihi modal** dan penjelasan sederhana.
3. `WeeklyPredictionChart`: pola biaya per minggu + batas modal; label minggu puncak, tooltip rupiah.
4. `ScenarioControls`: preset **Musim normal / Musim hujan basah / Pupuk dan upah naik**; slider hujan, harga pupuk, upah; tombol reset.
5. `PredictionDrivers`: alasan utama perubahan biaya (hujan, pH/tanah, harga input, upah, risiko hama), penjelasan sederhana.
6. `SavingsSuggestions`: opsi penghematan sebagai skenario estimasi, **bukan janji penghematan nyata**.
7. Catatan sumber: **“Perkiraan berbasis aturan dan simulasi”** selama engine XGBoost belum aktif; hanya ubah menjadi “Model XGBoost” bila metadata respons API benar-benar menyatakannya.

**Algoritma baseline (mode mock/belum engine):** biaya dasar sesuai komoditas dan luas, penyesuaian cuaca/tanah/harga, 500 iterasi Monte Carlo untuk P10/P50/P90; hasil terstandardisasi lewat `PredictionResult` sehingga komponen tidak tahu sumbernya.

**Jangan tampilkan:** kartu “akurasi model 80%/95%” yang dibuat dari rumus heuristik atau angka random; SHAP palsu; atau rekomendasi yang secara diam-diam mengubah catatan keuangan sebenarnya.

**State:** tanpa biaya (gate), menunggu prediksi, berhasil, gagal; data out-of-distribution (>3 ha) diberi peringatan; sumber baseline/model selalu terlihat.

### 6.6 Rencana biaya (`/rencana-biaya`) — F4 + sebagian F12

**Isi utama:**

- `BudgetSummary`: total rencana vs jumlah pengeluaran yang **benar-benar tercatat**, selisih nominal dan persentase.
- `PhaseBreakdown`: 4 fase dan bobot awal **Persiapan 19%, Penanaman 16%, Perawatan 50%, Panen dan pascapanen 15%**.
- `CategoryBreakdown`: 5 kategori **Benih dan bibit; Pupuk; Obat hama dan penyakit; Tenaga kerja; Lain-lain**.
- `VarianceTable`: rencana vs aktual tiap kategori; peringatan bila aktual >115% rencana pada kategori tersebut.
- `CostAdjustments`: dampak hujan >60 mm/minggu pada fungisida dan pH <6 pada kapur dolomit/pupuk fosfor (label sebagai baseline aturan).
- `BreakEvenCard` (F12 / P2): harga impas per kg serta perkiraan untung/rugi dari skenario harga jual. Jelaskan **ini skenario, bukan prediksi harga pasar**.
- CTA menuju Catatan dan Kalender uang.

Durasi fase berdasarkan dataset: **cabai 2/2/8/4 minggu; tomat 2/2/7/3; bawang merah 2/1/5/2**. Jumlah alokasi fase wajib sama dengan total rencana (toleransi pembulatan dijelaskan). Seluruh angka aktual diambil dari modul Expense.

### 6.7 Kalender uang (`/kalender-uang`) — F4 / P0

**Isi:**

- Ringkasan “Modal tersedia”, “Perkiraan total kebutuhan”, “Selisih modal”, “Minggu dengan biaya tertinggi”.
- Grafik batang/garis **biaya rencana per minggu (1…durasi musim)** dan ringkasan nilai aktual yang tercatat sampai hari ini.
- Tabel mobile-friendly: minggu, fase, rencana, aktual, akumulasi kebutuhan, sisa modal *menurut skenario*.
- Penanda minggu modal diperkirakan habis; gunakan copy **“Modal diperkirakan tidak mencukupi mulai minggu …”**, bukan “Pasti habis”.
- Pilihan modal (input atau ubah dari profil dengan konfirmasi); CTA **“Lihat opsi pengajuan pinjaman”** jika gap >0.
- Tampilan khusus sebelum mulai menanam: jadwal berlabel “rencana” dan minggu berjalan belum dihitung secara palsu.
- Empty state jika belum ada biaya aktual: “Belum ada pengeluaran tercatat. Rencana biaya tetap dapat dilihat.”

### 6.8 Cuaca dan lahan (`/cuaca-lahan`) — F6/F13 / P1+P2

Empat tab dalam satu route: **Cuaca**, **Kondisi tanah**, **Kondisi tanaman**, **Foto lahan**.

**Tab Cuaca (P1):** ringkasan prakiraan hujan & suhu **7 hari**, lokasi lahan, waktu pembaruan terakhir, grafik harian; tombol perbarui. Data dari Open-Meteo melalui **repository/backend adapter**; jika koneksi tidak tersedia tampilkan gagal/terakhir diperbarui, bukan cuaca karangan. Input skenario hujan dan dampak biaya jika pembiayaan sudah dimulai; sebelum itu sembunyikan rupiah.

**Tab Kondisi tanah (P1):** pH input petani, NPK (`rendah/sedang/tinggi`), tanggal pengukuran, status bila pengukuran lama; penjelasan sederhana dampak pH; penambahan biaya hanya setelah gate aktif. Jangan menebak pH otomatis dari lokasi.

**Tab Kondisi tanaman (F13/P2):** upload foto daun, pilihan contoh jenis gejala, status pemeriksaan. Karena CNN belum tersedia, tampilan default adalah **“Analisis foto otomatis belum tersedia”** + informasi aman; jika mode demo dinyalakan, label permanen “Hasil simulasi”. Jika nanti CNN aktif: tampilkan label indikasi sehat/bercak/keriting, confidence, minta foto ulang jika confidence rendah; bukan diagnosis pasti.

**Tab Foto lahan (F13/P2):** unggah foto progres mingguan, waktu unggah, koordinat bila disetujui, status bukti `belum diperiksa / pemeriksaan metadata / memenuhi syarat metadata / perlu diperiksa`. Validasi nyata pada produksi: GPS dalam batas lahan, waktu sesuai musim, SHA-256, tolak hash duplikat; **jangan mengklaim memverifikasi foto layar dengan AI**.

### 6.9 Catatan (`/catatan`) — F7 / P1

**Isi:**

- KPI `Total pengeluaran tercatat`, `Pengeluaran minggu berjalan`, `Selisih dari rencana`.
- Form tambah/edit pengeluaran: tanggal (boleh mundur), kategori dari 5 opsi, nominal, keterangan opsional, tombol simpan.
- Daftar transaksi: tanggal, kategori, nominal, keterangan, asal catatan, tombol edit/hapus dengan konfirmasi.
- Filter menurut kategori, tanggal, minggu, dan pencarian catatan; pengelompokan per minggu musim.
- Perbandingan terhadap rencana dan peringatan jika kategori >15% di atas rencana.
- Shortcut mencatat lewat asisten **hanya jika backend benar-benar siap**; foto nota/OCR/suara sebagai tahap lanjut, nonaktif atau berlabel demo.

**Aturan sumber data:** transaksi yang valid memiliki `date`, `category`, `amountIdr`, `simulated=false`; entri demo atau simulasi **tidak ikut agregasi realisasi / dataset latih**. Input, daftar, KPI, kalender, riwayat harus membaca satu sumber kebenaran `ExpenseRepository`.

### 6.10 Risiko dan kredit (`/risiko-kredit`) — F8 / P1

**Isi:**

1. `CreditReadiness`: skor 300–850 dengan label **“Indikator kesiapan (heuristik, bukan skor kredit bank)”**. Empat komponen: disiplin biaya **35%**, kelengkapan catatan **20%**, bukti foto **15%**, kemampuan bayar **30%**.
2. Ringkasan kemampuan biaya: total kebutuhan, gap modal, perkiraan rentang pendapatan, rasio penutupan pinjaman pada skenario terburuk.
3. `LoanApplicationForm`: jumlah pinjaman, tujuan, tenor selaras musim, catatan pendukung, persetujuan berbagi data eksplisit.
4. Dokumen lampiran yang jelas: profil lahan, rencana/aktual biaya, riwayat, panen, foto bukti bila tersedia.
5. `ReferralStatus`: `draft / diajukan / diperiksa / disetujui / ditolak` dan kode rujukan/QR bila benar-benar diterbitkan backend; kode tidak boleh diterbitkan seolah diterima bank ketika masih mock.
6. Disclaimer tepat dekat CTA: **“Kode rujukan bukan persetujuan pinjaman. Keputusan ditentukan bank/koperasi.”**

**Status MVP:** skor heuristik boleh diperagakan; pengajuan/integrasi bank masih simulasi sampai API tersedia. Untuk frontend-only, simpan `LoanApplication` demo dengan label **“Pengajuan contoh — belum dikirim ke bank”**. Halaman verifikasi petugas bank adalah **rencana integrasi produksi terpisah**, jangan menganggapnya sudah aktif.

### 6.11 Beranda (`/beranda`) — F9 / P1

**Sebelum Mulai:** sesuai ketentuan prototipe, bagian konten Beranda yang berisi keuangan diganti **satu kartu ajakan “Mulai perhitungan pembiayaan”** (tanpa angka rupiah atau KPI lain). Akses ke Profil, Musim tanam, Pengingat, dan Cuaca dan lahan tetap tersedia melalui navigasi.

**Setelah Mulai:**

- Hero: komoditas, luas, fase/minggu, rentang biaya musim dan modal tersisa (jelas bedakan rencana vs aktual).
- 3–4 KPI paling relevan: kebutuhan biaya, pengeluaran tercatat, perkiraan biaya 4 minggu ke depan, kecukupan modal.
- `ThisWeekChecklist`: pengingat cek lahan dan aksi pekan ini.
- `AlertsList`: hujan tinggi, biaya melenceng, modal diperkirakan kurang, catatan yang belum lengkap, foto bukti yang perlu dilengkapi.
- `QuickActions`: “Catat pengeluaran”, “Lihat kalender”, “Buka musim”, “Cek lahan”, “Riwayat musim”.
- Jangan memasang 12 panel yang sama penting; maksimum 1 hero + 4 KPI + 2–3 section utama.

**Tanpa musim aktif:** tampilkan empty state dengan CTA “Mulai musim baru”, bukan dashboard kosong dengan angka nol palsu.

### 6.12 Riwayat musim (`/riwayat-musim`, `/:seasonId`) — F11 / P1

Ini **fitur inti pengumpulan data nyata**, bukan sekadar catatan lama.

**Daftar riwayat:** kartu / tabel nama musim, tanaman, tanggal, luas, biaya aktual, total panen, pendapatan, laba/rugi, status kualitas data. Filter komoditas, tahun, status; tombol **Tambah musim**, **Simpan musim ini** bila relevan, **Lihat detail**, **Lengkapi/ubah**, **Hapus** dengan konfirmasi.

**Detail riwayat:**

- Ringkasan keuangan dan hasil panen, beda rencana vs aktual (jika ada).
- Data 18 isian tingkat-musim dari profil, cuaca historis, dan formulir: komoditas, luas, jenis tanah, sumber air, provinsi, bulan tanam, rata-rata hujan, jumlah minggu hujan lebat, suhu maksimum rata-rata, pH, fosfor, nitrogen, kalium, indeks pupuk/upah/pestisida, durasi, total biaya aktual.
- Pengeluaran mingguan dari catatan transaksi **non-simulasi** dengan tanggal; jika pengeluaran tidak lengkap, jangan menghasilkan biaya mingguan buatan.
- Jika data otomatis gagal: tampilkan field kosong dan CTA **Lengkapi data**; jangan mengisi dugaan.
- `TrainingQualityCard`: jumlah isian lengkap, status, daftar yang belum terisi, keterangan ikut/tidak ikut ekspor.
- `ExportTrainingData`: CSV 32 kolom, hanya record berkualitas cukup dan anonim. **Unduhan CSV milik petani bukan persetujuan otomatis untuk penggunaan data tersebut melatih AI.** Jika data akan dikirim/diambil sistem untuk pelatihan, wajib ada persetujuan eksplisit terpisah.

**Status kualitas tepat sesuai sumber:**

| Status | Syarat | Ekspor |
|---|---|---|
| `READY_WEEKLY` — Siap dilatih | Semua 18 isian terisi dan semua biaya minggu valid | Ya, termasuk biaya mingguan |
| `READY_TOTAL_ONLY` — Siap, total biaya saja | Semua 18 isian terisi, tetapi biaya mingguan tidak tersedia | Ya, biaya mingguan dan porsi kosong |
| `INCOMPLETE` — Belum lengkap | Ada field wajib yang tidak diketahui | Tidak |
| `DEMO` — Contoh | Record contoh/demo | Tidak |

**Aturan detail:**

- Baris CSV: **1 baris per minggu musim**, bukan 1 baris per musim; biaya total berulang pada minggu terkait menurut dataset.
- Durasi: cabai 16, tomat 14, bawang 10 minggu.
- Ambang minggu hujan lebat dataset/prototipe: **≥150 mm/minggu**, catat sebagai konstanta terpusat dan beri catatan bahwa definisinya perlu diverifikasi ke generator dataset.
- Tanggal transaksi sebelum awal musim masuk minggu 1; sesudah akhir musim masuk minggu terakhir (aturan sumber; jangan ganti tanpa keputusan domain).
- Rincian mingguan diterima hanya bila total transaksi 90–110% dari total biaya aktual yang petani isi; bila tidak, kosongkan rincian mingguan pada record.
- `sumber="nyata"` hanya jika berasal dari catatan nyata; record demo tidak pernah diekspor.
- Export `musim_id` sebagai kode anonim, format `R` + 8 karakter heksadesimal; tidak boleh ada nama, HP, desa, atau koordinat; lokasi hanya provinsi.
- Dalam skema produksi simpan record terstruktur (`SeasonRecord` dan `WeeklyCost`), dataset 32 kolom berasal dari view/transformasi, tidak perlu tabel duplikat 32 kolom di frontend.

**Urutan kolom CSV harus persis berikut:**

```ts
export const TRAINING_EXPORT_COLUMNS = [
  'musim_id', 'komoditas', 'luas_ha', 'jenis_tanah', 'sumber_air',
  'provinsi', 'bulan_tanam', 'hujan_mm_rata_per_minggu',
  'minggu_hujan_lebat', 'suhu_maks_rata', 'ph', 'fosfor',
  'nitrogen', 'kalium', 'indeks_harga_pupuk', 'indeks_upah',
  'indeks_harga_pestisida', 'minggu_ke', 'durasi_musim',
  'posisi_relatif', 'fase', 'minggu_dalam_fase',
  'jumlah_minggu_fase', 'bulan_kalender_minggu',
  'hujan_mm_minggu_klimatologi', 'ada_tanam', 'ada_pupuk_dasar',
  'ada_panen', 'biaya_total_juta', 'biaya_minggu_juta',
  'porsi_minggu', 'sumber'
] as const;
```

Kolom turunan tidak diinput manual; hasilkan dengan `history-export.ts` dari durasi, fase tanaman, aturan klimatologi, biaya mingguan, dan pembulatan half-to-even sesuai dataset. **Jangan mengarang tabel klimatologi yang tidak ada di dokumen/fixture yang dibaca.** Jika tabel referensi belum disediakan, tuliskan `TODO: provide climate reference data` dan jangan klaim ekspor dataset valid penuh.

### 6.13 Pengingat cek lahan (`/pengingat`) — F10 / P2

- Header “Cek lahan minggu ini”, minggu/fase bila musim aktif, progres checklist dan streak penggunaan (bila dihitung).
- Checklist kegiatan mingguan: status belum/sudah, hari dan jam pengingat, pengaturan notifikasi browser.
- Tampilkan izin notifikasi `belum diminta / diizinkan / ditolak`; jangan memunculkan prompt izin tanpa aksi pengguna.
- Jika belum ada tanggal musim, tampilkan checklist persiapan/empty state yang relevan, tanpa mengarang minggu berjalan.
- Simpan progres per `seasonId + weekNumber + taskId`. Tidak boleh membawa checklist musim sebelumnya ke musim baru.

### 6.14 Asisten (`/asisten`) — F14 / P2

**Tampilan dirancang sekarang, integrasi AI dilakukan kemudian:**

- Chat area putih bersih, pesan pengguna vs asisten, composer dan tombol kirim; suggested questions “Berapa biaya musim ini?”, “Kapan modal saya habis?”, “Apa pengeluaran minggu depan?”, “Bagaimana cuaca?”, “Apakah ada biaya melenceng?”.
- Bila Gemini belum tersambung: tampilkan **“Asisten otomatis belum aktif”**, tombol kirim nonaktif **atau** mode demo yang dilabeli jelas pada **setiap respons**. Jangan membuat chat mock yang tampak seperti Gemini nyata.
- Rencana produksi: frontend memanggil Express.js, bukan langsung Gemini; jawaban penjelasan angka harus menggunakan `PredictionResult`, `Expense`, dan data keuangan dari backend, bukan angka hasil generasi bahasa.
- Pencatatan bahasa alami: hasil ekstraksi wajib menjadi **draft form pengeluaran yang dapat diperiksa dan dikonfirmasi pengguna sebelum tersimpan**. OCR nota dan suara belum tersedia dalam MVP awal.
- Dilarang menjanjikan panen atau persetujuan kredit, dan dilarang mengirim identitas petani yang tidak diperlukan ke model.

---

## 7. Domain types dan kontrak antar modul

Buat model typed minimum berikut. Nama dalam contoh adalah keputusan frontend; DTO Express dapat berbeda asalkan mapping tunggal tersedia.

```ts
export type Crop = 'cabai' | 'tomat' | 'bawang';
export type NutrientLevel = 'rendah' | 'sedang' | 'tinggi';
export type SeasonStatus =
  | 'draft' | 'financing' | 'planting' | 'closed';
export type DataOrigin = 'actual' | 'synthetic' | 'demo' | 'simulated';
export type PredictionSource = 'rule-baseline' | 'xgboost';
export type QualityStatus =
  | 'READY_WEEKLY' | 'READY_TOTAL_ONLY' | 'INCOMPLETE' | 'DEMO';

/** Unit internal uang di frontend = integer Rupiah, bukan float juta. */
export type MoneyIDR = number;

export interface Farm {
  id: string;
  userId: string;
  name: string;
  crop: Crop;
  areaHa: number;
  soilType?: string;
  waterSource?: string;
  province?: string;
  latitude?: number;
  longitude?: number;
  ph?: number;
  phMeasuredAt?: string;
  nitrogen?: NutrientLevel;
  phosphorus?: NutrientLevel;
  potassium?: NutrientLevel;
}

export interface Season {
  id: string;
  farmId: string;
  crop: Crop;
  status: SeasonStatus;
  financingStartedAt?: string;  // YYYY-MM-DD
  plantingStartedAt?: string;   // minggu 1
  closedAt?: string;
  snapshotId?: string;
}

export interface PredictionResult {
  seasonId: string;
  source: PredictionSource;
  modelVersion?: string;
  generatedAt: string;
  p10Idr: MoneyIDR;
  p50Idr: MoneyIDR;
  p90Idr: MoneyIDR;
  overCapitalProbability?: number;  // 0...1
  weekly: Array<{ week: number; plannedIdr: MoneyIDR; phase: string }>;
  drivers: Array<{ label: string; explanation: string; impactIdr?: MoneyIDR }>;
  warnings: string[];
}

export type ExpenseCategory =
  | 'seed' | 'fertilizer' | 'pesticide' | 'labor' | 'other';
export interface Expense {
  id: string;
  seasonId: string;
  spentOn: string;
  category: ExpenseCategory;
  amountIdr: MoneyIDR;
  note?: string;
  origin: DataOrigin;
}

export interface HarvestEntry {
  id: string;
  seasonId: string;
  harvestedOn: string;
  quality: 'A' | 'B' | 'C';
  weightKg: number;
  pricePerKgIdr: MoneyIDR;
  buyer?: string;
}

export interface HarvestSample {
  seasonId: string;
  weightKg: number;
  plotAreaM2: number;
  photos: Array<{ id: string; url: string; takenAt?: string; lat?: number; lng?: number }>;
}

export interface SeasonRecord {
  id: string;
  seasonId: string;
  anonId: string;
  origin: DataOrigin;
  data: Record<string, string | number | null>;
  weeklyCostsIdr: Array<MoneyIDR | null> | null;
  quality: QualityStatus;
}
```

**Prinsip uang:** untuk UI, gunakan integer IDR. Sumber Prisma merencanakan tipe `Decimal` dalam satuan *juta rupiah*. Konversi `amountJt` (string) ↔ `amountIdr` hanya pada `dto-mappers.ts` dengan parsing desimal yang aman dan tes unit; jangan menggunakan perkalian float di setiap komponen. Format semua uang lewat `formatRupiah()` atau `formatJutaRupiah()` pada util tunggal. Input nominal disimpan akurat sebagai IDR.

### Kontrak repository minimum

```ts
export interface AgroRepositories {
  session: SessionRepository;
  farms: FarmRepository;
  seasons: SeasonRepository;
  predictions: PredictionRepository;
  expenses: ExpenseRepository;
  harvests: HarvestRepository;
  histories: HistoryRepository;
  weather: WeatherRepository;
  loans: LoanRepository;
}

// Bentuk contoh. Implementasi HTTP dan mock harus mematuhi signature yang sama.
export interface ExpenseRepository {
  listBySeason(seasonId: string): Promise<Expense[]>;
  create(input: Omit<Expense, 'id'>): Promise<Expense>;
  update(id: string, changes: Partial<Expense>): Promise<Expense>;
  remove(id: string): Promise<void>;
}

export interface PredictionRepository {
  calculate(seasonId: string, scenario?: Record<string, number>): Promise<PredictionResult>;
}
```

**Data/query flow yang diinginkan:**

```text
Page (Server/Client Boundary)
  → Feature Hook / TanStack Query
    → Repository interface
      → Mock adapter (awal) ATAU Express HTTP adapter (produksi)
    → Domain calculations (pure functions)
  → Typed ViewModel
  → Reusable UI components
```

Jangan letakkan `fetch('/api/...')` langsung di tombol, tabel, atau card. Jangan menjalankan engine prediksi berat pada setiap `onChange`; gunakan debounce, batalkan request lama, atau tombol “Terapkan skenario”.

---

## 8. Integrasi API yang **diusulkan** (bukan endpoint yang sudah tersedia)

Endpoint berikut hanya **kontrak usulan frontend** supaya proses implementasi dapat berjalan dengan mock repository. Finalkan bersama tim Express sebelum mengganti adapter.

| Resource | Contoh method/endpoint | Output / tujuan |
|---|---|---|
| Session | `POST /api/v1/auth/login`, `GET /api/v1/me` | Cookie/session dan profil akun |
| Farm | `GET/POST/PATCH /api/v1/farms` | Profil/lahan |
| Season | `GET /api/v1/seasons/active`, `POST /api/v1/seasons` | Musim aktif/baru |
| Financing | `POST /api/v1/seasons/:id/financing/start` | Snapshot awal dan status pembiayaan |
| Planting | `POST /api/v1/seasons/:id/planting/start` | Tanggal minggu 1 |
| Prediction | `POST /api/v1/seasons/:id/predict` | P10/P50/P90 dan weekly plan, source/version |
| Expense | `GET/POST/PATCH/DELETE /api/v1/seasons/:id/expenses` | Transaksi aktual |
| Harvest | `GET/POST/PATCH/DELETE /api/v1/seasons/:id/harvests` | Entri panen |
| Season closing | `POST /api/v1/seasons/:id/close` | Validasi panen dan buat SeasonRecord |
| History | `GET /api/v1/history`, `GET/PATCH /api/v1/history/:id` | Riwayat dan kelengkapan |
| History export | `POST /api/v1/history/export` | CSV dan persetujuan eksplisit bila penggunaan di luar unduh lokal |
| Weather | `GET /api/v1/weather?farmId=...` | Prakiraan 7 hari, status dan waktu update |
| Credit | `GET /api/v1/credit/readiness`, `POST /api/v1/loans` | Heuristik dan aplikasi demo/riil |
| Assistant | `POST /api/v1/assistant/messages` | Jawaban saat Gemini tersedia |

Jangan menciptakan data response yang tidak pernah dijanjikan backend tanpa penanda `mock`. Error HTTP harus menghasilkan pesan yang ramah, retry bila aman, serta fallback yang sesuai. Jangan menyimpan secret Open-Meteo/Gemini/credential DB dalam variabel publik `NEXT_PUBLIC_*`.

---

## 9. Perhitungan dan ketetapan domain yang tidak boleh diubah

### Komoditas dan baseline

| Komoditas | Durasi | Fase persiapan/tanam/rawat/panen | Acuan biaya per ha |
|---|---:|---|---:|
| Cabai merah | 16 minggu | 2 / 2 / 8 / 4 | Rp 73,7 juta |
| Tomat | 14 minggu | 2 / 2 / 7 / 3 | Rp 59 juta |
| Bawang merah | 10 minggu | 2 / 1 / 5 / 2 | Rp 52 juta |

Dataset sintetis acuan yang tertulis pada dokumen adalah **5.000 musim, 66.520 baris mingguan, 32 kolom**, dari lima provinsi. Angka tersebut adalah cakupan data sintetis, **bukan bukti akurasi pada petani nyata**.

Porsi biaya awal 4 fase: **19 / 16 / 50 / 15%**. Penyesuaian baseline: hujan di atas 60 mm/minggu berpengaruh pada tambahan fungisida; pH <6 pada dolomit/fosfor. Monte Carlo baseline: **500 simulasi** → P10/P50/P90. Jangan klaim rentang empiris terkalibrasi dari model sebelum dievaluasi pada data nyata.

### Perhitungan keuangan terpusat

- `plannedTotal`: dari PredictionResult atau baseline; tidak dari jumlah kartu UI.
- `recordedExpenseTotal`: **sum(expenses where origin==='actual')**, dihitung per musim, dan dilabeli **“Pengeluaran tercatat”** agar tidak disalahartikan sebagai total biaya seluruh musim ketika pencatatan belum lengkap. Total biaya aktual penutupan musim berasal dari angka yang petani konfirmasi, dengan rekonsiliasi ke catatan.
- `remainingCapitalScenario`: modal – kumulatif kebutuhan pada skenario.
- `shortfall`: `max(0, plannedTotal - capital)`; bedakan “kekurangan modal menurut estimasi” dan “pengeluaran aktual”.
- `breakEvenPricePerKg`: `plannedTotal / expectedYieldKg` hanya bila expectedYieldKg >0; `expectedYieldKg` harus diberi label estimasi/asumsi, bukan fakta. Jika belum ada dasar hasil panen, tampilkan state “Data belum cukup”.
- `actualRevenue`: `sum(harvest.weightKg * harvest.pricePerKgIdr)`.
- `actualProfit`: `actualRevenue – actualSeasonCost`, hanya jika total biaya aktual benar-benar tersedia.
- `harvestSampleEstimateKg`: `(sampleWeightKg / plotAreaM2) * (areaHa * 10_000)`; selisih absolut >30% dari angka panen aktual perlu pengecekan. Hindari pembagian nol.

### Batasan hasil data latih

`SeasonRecord` tidak boleh mengambil angka biaya dari PredictionResult; jika expense total belum lengkap, minta total aktual dari petani. Biaya mingguan tidak boleh di-*backfill* oleh baseline/model. Seluruh 32 kolom ekspor mengikuti urutan di §6.12; half-to-even rounding untuk kolom turunan yang ditentukan; sumber, status, dan consent tidak boleh disimpulkan dari ada/tidaknya angka saja.

---

## 10. Rekomendasi kode dasar yang harus dibuat pertama

### 10.1 Root layout dengan Nunito (`src/app/layout.tsx`)

```tsx
import type { Metadata } from 'next';
import { Nunito } from 'next/font/google';
import { QueryProvider } from '@/providers/QueryProvider';
import './globals.css';

const nunito = Nunito({
  subsets: ['latin'],
  display: 'swap',
  variable: '--font-nunito',
});

export const metadata: Metadata = {
  title: 'AgroChie — Rencanakan biaya satu musim tanam',
  description: 'Perencanaan biaya musim tanam untuk petani hortikultura.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body className={`${nunito.variable} font-sans antialiased`}>
        <QueryProvider>{children}</QueryProvider>
      </body>
    </html>
  );
}
```

### 10.2 Contoh token global (`src/app/globals.css`)

```css
@import 'tailwindcss';

:root {
  --background: #ffffff;
  --surface: #ffffff;
  --surface-muted: #f5faf6;
  --primary: #176b43;
  --primary-hover: #125535;
  --primary-soft: #e6f4ea;
  --primary-ink: #0d472b;
  --text: #1c2b22;
  --text-muted: #65746a;
  --border: #e3ede6;
  --danger: #c2413b;
  --warning: #a26311;
  --success: #176b43;
}

@theme inline {
  --font-sans: var(--font-nunito), ui-sans-serif, system-ui, sans-serif;
  --color-background: var(--background);
  --color-surface: var(--surface);
  --color-surface-muted: var(--surface-muted);
  --color-primary: var(--primary);
  --color-primary-soft: var(--primary-soft);
  --color-foreground: var(--text);
  --color-muted-foreground: var(--text-muted);
  --color-border: var(--border);
}

body { background: var(--background); color: var(--text); }
button, input, select, textarea { font: inherit; }
:focus-visible { outline: 2px solid var(--primary); outline-offset: 3px; }
```

### 10.3 Konfigurasi menu (`src/config/navigation.ts`)

```ts
export const NAV_ITEMS = [
  { href: '/beranda', label: 'Beranda', mobile: true, priority: 'P1' },
  { href: '/musim-tanam', label: 'Musim tanam', mobile: true, priority: 'P0' },
  { href: '/pengingat', label: 'Cek lahan', mobile: true, priority: 'P2' },
  { href: '/prediksi', label: 'Prediksi musim', mobile: true, priority: 'P0' },
  { href: '/asisten', label: 'Asisten', mobile: true, priority: 'P2' },
  { href: '/profil', label: 'Profil', mobile: true, priority: 'P0' },
  { href: '/rencana-biaya', label: 'Rencana biaya', mobile: false, priority: 'P0' },
  { href: '/kalender-uang', label: 'Kalender uang', mobile: false, priority: 'P0' },
  { href: '/cuaca-lahan', label: 'Cuaca dan lahan', mobile: false, priority: 'P1' },
  { href: '/risiko-kredit', label: 'Risiko dan kredit', mobile: false, priority: 'P1' },
  { href: '/catatan', label: 'Catatan', mobile: false, priority: 'P1' },
  { href: '/riwayat-musim', label: 'Riwayat musim', mobile: false, priority: 'P1' },
] as const;
```

Menu diberi ikon Lucide berdasarkan `href` melalui peta konfigurasi typed, bukan `switch` panjang di tiap komponen.

### 10.4 Satu gate untuk semua komponen uang

```ts
export function canViewFinancing(season: Season | null): boolean {
  return Boolean(season?.financingStartedAt);
}
```

`FinancingGate` harus merender **satu kartu ajakan Mulai** dan tidak merender subtree yang mengandung angka uang ketika gate tidak aktif. Untuk `cuaca-lahan`, gate diterapkan pada **subkomponen rupiah** saja. Untuk `profil`, input modal boleh ditampilkan tetapi estimasi/totals tetap terkunci. Untuk landing, kalkulasi preview hanya setelah interaksi eksplisit.

> **Catatan implementasi:** jangan hanya menutupi angka dengan CSS (`blur`, `display:none`) setelah data sensitif ter-render. Kondisional rendering yang benar mencegah subtree nominal muncul.

### 10.5 Status fitur berdasarkan availability

```ts
export type FeatureAvailability = 'unavailable' | 'demo' | 'ready';

export const FEATURE_AVAILABILITY = {
  xgboost: 'unavailable',
  cnn: 'unavailable',
  gemini: 'unavailable',
  photoMetadataVerification: 'unavailable',
  bankSubmission: 'demo',
} satisfies Record<string, FeatureAvailability>;
```

Ini **nilai awal**, bukan status produksi permanen. Jangan memakai status `ready` tanpa kontrak API, pengujian, dan fakta fitur berjalan. UI harus merefleksikan sumber yang benar dari repository/response metadata.

---

## 11. Data mock, error handling, dan integrasi bertahap

Mock repository minimal menyediakan fixture deterministik (nilai tidak berubah secara acak pada setiap render):

- Profil lengkap untuk cabai 0,5 ha dan satu profil belum lengkap.
- Kasus belum mulai pembiayaan, pembiayaan aktif, aktif tanam pada minggu tertentu, serta musim sudah ditutup.
- Prediksi baseline P10/P50/P90, rencana 16 minggu, catatan aktual 5 kategori, contoh modal cukup dan kurang.
- Dua riwayat contoh: satu `READY_WEEKLY`, satu `INCOMPLETE`; keduanya jelas ditandai **fixture**, tidak ikut ekspor data nyata.
- Prakiraan cuaca mock diberi label “Data simulasi”; saat produksi gunakan timestamp dan sumber Open-Meteo dari API.
- Foto contoh memakai placeholder aman tanpa klaim metadata GPS valid.

Pemilihan repository dilakukan lewat konfigurasi frontend `NEXT_PUBLIC_DATA_MODE=mock|api` (ini bukan secret). Saat `api`, ketidaktersediaan backend harus menjadi error yang ramah, **bukan fallback diam-diam ke data mock**. Simulasi harus dipicu eksplisit dan transparan.

### Ketentuan query dan state

- `queryKeys` terpusat (misalnya `['season', seasonId, 'expenses']`); invalidasi catatan akan memperbarui dashboard, budget, cashflow, dan riwayat yang terkait.
- Setiap request support abort/cancellation bila sesuai; debounce slider dan input scenario.
- Skeleton untuk operasi >300 ms; empty state berkualitas; retry tidak boleh menduplikasi transaksi.
- Offline: tampilkan status koneksi; tidak menjanjikan sinkronisasi offline sebelum mekanismenya dibangun.
- Foto besar dikompres sebelum upload bila memang aman; jangan menghilangkan metadata bukti secara diam-diam.

---

## 12. Testing dan kriteria penerimaan

### Unit tests (fungsi domain)

- [ ] `formatRupiah`, desimal juta→IDR, roundtrip tanpa drift nilai uang.
- [ ] Semua komoditas menghasilkan durasi dan fase benar (16/14/10; 2/2/8/4, 2/2/7/3, 2/1/5/2).
- [ ] Empat porsi fase berjumlah 100%; agregasi fase/kategori sesuai total rencana.
- [ ] Biaya aktual hanya berasal dari Expense `origin=actual`.
- [ ] Catatan pengeluaran bertanggal masuk minggu 1..N sesuai aturan, termasuk transaksi sebelum/sesudah rentang.
- [ ] Perbedaan total transaksi di luar 90–110% membuat weekly history kosong (bukan estimasi).
- [ ] Status `READY_WEEKLY / READY_TOTAL_ONLY / INCOMPLETE / DEMO` sesuai input.
- [ ] CSV tepat 32 kolom berurutan, ID anonim, tidak memuat nama/HP/desa/koordinat; record demo/incomplete tidak diekspor; **ekspor sendiri tidak dianggap consent pelatihan model**.
- [ ] Selisih sampel panen >30% memunculkan peringatan.
- [ ] Perhitungan modal dan arus kas aman jika modal 0 atau belum diisi.

### Component & integration tests

- [ ] Sebelum Mulai, semua route keuangan hanya menunjukkan ajakan, tidak ada nominal rupiah.
- [ ] Mulai → snapshot; Batal → tidak ada angka; Hentikan → gate kembali; profil dan cuaca tetap bisa dibuka.
- [ ] Langkah penanaman terkunci hingga financing selesai; panen terkunci hingga planting dimulai.
- [ ] Tidak bisa tutup musim tanpa satu entri panen, sampel valid, foto bukti, dan total biaya aktual.
- [ ] Catatan create/edit/delete langsung tersinkron pada total aktual, rencana, dashboard, dan riwayat.
- [ ] Jika AI belum siap, label “Belum tersedia/Simulasi” terlihat dan tidak ada klaim diagnosis/akurasi palsu.
- [ ] Semua form punya label dan error; dialog dapat ditutup dengan ESC, fokus kembali ke tombol asal.
- [ ] Halaman mobile tanpa horizontal overflow yang tidak disengaja; navigasi utama mudah dipakai dengan ibu jari.

### E2E minimum (Playwright)

1. Login demo → isi profil → Mulai pembiayaan → lihat Prediksi/Rencana/Kalender.
2. Pilih komoditas → Mulai penanaman → tambah 2 transaksi dengan tanggal berbeda → cek agregasi.
3. Catat beberapa panen, foto sampel, total biaya → tutup musim → lihat Riwayat.
4. Lengkapi data riwayat → status berubah → ekspor CSV jika memenuhi syarat dan consent.
5. Dari keadaan awal, buka semua menu → tidak ada angka uang muncul sebelum Mulai.
6. Buka kondisi tanaman/Asisten/Pinjaman tanpa engine → UI tetap jujur dan tidak mengklaim aksi eksternal berhasil.

### Nonfungsional

- [ ] TypeScript strict lulus tanpa `any` yang tidak dijustifikasi.
- [ ] ESLint, test, dan build sukses.
- [ ] Tidak ada warning hydration / console error pada happy path.
- [ ] SEO/layout marketing baik; gambar tidak menyebabkan layout shift besar.
- [ ] Lighthouse performa dan accessibility ditargetkan ≥90 pada landing dan halaman utama terukur (target, bukan klaim hasil).
- [ ] Hindari bundle CNN/Gemini/Recharts termuat pada semua halaman; gunakan dynamic import bila tepat.
- [ ] Tidak ada credential, token, nomor HP, koordinat sensitif, atau foto pengguna dalam log browser produksi.

---

## 13. Urutan implementasi yang harus diikuti coding agent

### Sprint A — Fondasi UI (belum menambah AI)

1. Inisialisasi Next.js/TS/Tailwind; pasang Nunito dan color tokens.
2. `AppShell`, navigasi responsif, komponen UI standar, QueryProvider, repository contracts + mock.
3. Route landing dan auth demo; struktur `Farm`, `Season`, `MoneyIDR`.
4. Profil petani/lahan (F1), validasi, pemilihan lahan.
5. Gate Mulai/Batal dan snapshot pembiayaan (F2).

**Syarat lanjut:** semua route sudah bisa dibuka tanpa layar kosong; gate nominal lolos tes.

### Sprint B — Jalur P0 lengkap

6. Prediksi baseline F3 dengan label sumber benar, range, simulasi, skenario.
7. Rencana biaya dan kalender F4, chart, peringatan modal.
8. Musim tanam F5: start planting, entri panen, sampel, foto, tutup musim.

**Syarat lanjut:** pengguna bisa menyelesaikan alur profil→pembiayaan→tanam→panen dalam mock.

### Sprint C — P1 dan pengumpulan data nyata

9. Catatan pengeluaran F7 dengan CRUD dan agregasi aktual.
10. Cuaca/tanah F6; Beranda F9; Risiko/kredit F8 berlabel heuristik/simulasi.
11. Riwayat musim F11: kualitas data, lengkapi, 32 kolom, consent/ekspor.

**Syarat lanjut:** semua metrik aktual konsisten; record prediksi tidak menyusup ke training export.

### Sprint D — P2 UI dan integrasi

12. Pengingat F10, BreakEven F12, tab tanaman/bukti F13, UI asisten F14.
13. Hubungkan repository HTTP bertahap setelah kontrak Express tersedia; berikan loading/error state nyata.
14. Integrasi CNN/Gemini hanya setelah backend/model tersedia dan divalidasi. Tidak perlu mengganti komponen yang sudah berjalan.
15. Responsive polish, tests, accessibility, cleanup performa.

**Jangan mengimplementasikan seluruh P0–P2 sekaligus dalam satu file atau satu commit besar.**

---

## 14. Definition of Done per menu (ringkas)

| Menu | Minimal selesai ketika… |
|---|---|
| Landing | CTA jelas, preview sadar aksi, responsif, tidak ada klaim AI palsu |
| Auth | Form valid, demo/session terpisah dari auth produksi |
| Profil | CRUD profil yang tersedia, validasi lahan, koordinat, NPK, progress |
| Musim tanam | Langkah 1–3 terkunci berurutan; penutupan membuat record riwayat |
| Prediksi | P10/P50/P90, scenario controls, label sumber, tampilan risk dan weekly |
| Rencana biaya | Fase/kategori konsisten, rencana vs aktual benar, break even tidak mengarang data |
| Kalender uang | Minggu 1..N, biaya, kekurangan modal, CTA pinjaman kontekstual |
| Cuaca-lahan | Cuaca 7 hari (real/mock berlabel), pH/NPK, tab tanaman/bukti jujur |
| Catatan | CRUD bertanggal, filter, total aktual konsisten, simulasi terpisah |
| Risiko-kredit | Skor heuristik transparan, consent, status pengajuan demo/riil tidak tertukar |
| Beranda | Ringkasan sesuai state; 1 CTA utama; KPI dan alert berasal dari domain data |
| Riwayat | Status kualitas, melengkapi data, ekspor 32 kolom anonim, record demo dikecualikan |
| Pengingat | Checklist per minggu dan izin notif yang jelas |
| Asisten | UI terstruktur, status belum aktif nyata, tidak ada output Gemini palsu |

---

## 15. Perintah operasional untuk AI coding agent

Gunakan instruksi berikut sebagai **prompt kerja** ketika mengimplementasikan repository:

> Kamu adalah frontend engineer untuk AgroChie. Gunakan dokumen ini sebagai spesifikasi implementasi. Bangun menggunakan Next.js App Router, TypeScript strict, Tailwind, Nunito, dominan putih/hijau. Jangan menyalin AgroChie.html monolitik. Terapkan feature-first modules, typed repository adapters (mock dahulu, API kemudian), domain pure functions, komponen UI reusable, dan semantik aksesibilitas. Pertahankan seluruh aturan bisnis dan menu F1–F14 dari dokumen sumber. Urutkan P0→P1→P2. Jangan menyatakan XGBoost, CNN, Gemini, validasi bank, atau verifikasi foto sudah berfungsi jika belum terintegrasi. Semua angka aktual harus dari data aktual dan semua ekspor data latih harus melalui validasi kualitas serta anonimisasi. Untuk setiap sprint: (1) tulis file yang benar-benar diperlukan, (2) jalankan lint/typecheck/test/build, (3) jelaskan file yang dibuat/diubah, (4) laporkan fitur yang masih mock/simulasi, (5) jangan mengubah konfigurasi/fitur di luar cakupan. Jangan membuat arsitektur abstrak berlebihan.

### Format laporan setelah tiap sprint

```text
Sprint: <A/B/C/D>
Fitur selesai: <ID fitur dan route>
File dibuat/diubah: <path + tanggung jawab>
Fitur masih mock: <daftar jujur>
Tes: <lint/typecheck/unit/E2E/build, hasil>
Masalah yang tersisa: <blokir dan keputusan yang diperlukan>
```

---

## 16. Keputusan yang masih perlu dikonfirmasi sebelum integrasi produksi

Ini **bukan asumsi pasti dari dokumen**; sengaja ditandai supaya tim tidak membangun perilaku yang keliru:

1. Apakah login produksi menggunakan email, nomor HP, atau keduanya; bagaimana metode OTP/reset kata sandi?
2. Kapan dan di mana persetujuan pemakaian data pelatihan disimpan; apakah export CSV tetap bisa dilakukan tanpa izin untuk mengirim ke server?
3. Apakah satu petani bisa memiliki beberapa musim aktif sekaligus di beberapa lahan; bagaimana pemilihan `activeSeason`?
4. Bagaimana kontrak pasti API Express untuk prediksi, sumber `rule-baseline/xgboost`, dan status ketersediaan cuaca?
5. Apakah snapshot rencana disimpan setiap perubahan skenario atau hanya pada aksi Simpan/Hitung ulang?
6. Bagaimana pembuktian timestamp/GPS/foto pada browser yang tidak memberikan izin lokasi; apakah foto bisa disimpan sebagai belum terverifikasi?
7. Apakah status pengajuan bank dikelola internal dulu atau diintegrasikan dengan mitra tertentu?
8. Di mana sumber tabel klimatologi dan generator dataset resmi berada agar export view 32 kolom benar-benar identik?

**Arah sementara yang aman:** bangun kontrak/interface dan state UI yang eksplisit; hindari implementasi palsu untuk keputusan yang belum disepakati.

---

## 17. Ringkasan prinsip kualitas

1. **Mudah dipahami petani:** satu tujuan per layar, bahasa sederhana, aksi jelas.
2. **White + green + Nunito:** konsisten; UI bersih dan tidak berlebihan.
3. **Modular:** setiap domain memiliki batas tanggung jawab; tidak ada file komponen raksasa.
4. **Reusable:** komponen UI, format rupiah, date handling, schema, dan repository dipakai bersama.
5. **Optimal:** server/client boundaries tepat, lazy load fitur berat, query caching, render minim.
6. **Jujur:** mock, baseline, dan AI nyata dibedakan.
7. **Aman bagi data:** aktual tidak berasal dari prediksi, consent eksplisit, CSV anonim.
8. **Tumbuh tanpa rewrite:** API Express/XGBoost/Gemini/CNN dapat diintegrasikan lewat adapter/feature boundaries.

**Hasil yang dituju:** sebuah frontend AgroChie yang secara visual siap diuji oleh petani, secara fungsional menunjukkan alur perencanaan→musim→panen→riwayat, dan secara teknis siap dihubungkan ke backend tanpa perlu mengulang struktur besar.
