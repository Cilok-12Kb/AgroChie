# AgroChie: Dokumen Prototipe (konsep, fitur, teknologi AI)

Sumber: `AgroChie_Dokumen_Prototipe_v2.pdf` (8 Oktober 2026). Perencanaan pembiayaan satu musim tanam untuk petani hortikultura; versi prototipe dengan riwayat musim berformat dataset latih.
Catatan konversi: tabel "Ringkasan pembaruan" (perubahan dibanding versi 4 Oktober) dihilangkan. Perubahan utamanya: Riwayat musim kini menyimpan data dalam skema yang sama dengan dataset sintetis AgroChie, sehingga data nyata petani bisa dipakai melatih ulang model.

---

## 1. Ringkasan

AgroChie adalah aplikasi web berbahasa Indonesia yang membantu petani mengetahui berapa biaya satu musim tanam sebelum mulai menanam, memantau biaya selama musim berjalan, mencatat hasil panen, dan menyiapkan pengajuan pinjaman musiman bila modal tidak cukup. Prototipe berupa satu file HTML di browser, mencakup cabai merah, bawang merah, dan tomat.

Fitur inti: perencanaan pembiayaan satu musim ke depan. Prediksi biaya akan memakai XGBoost, cuaca memakai API, pH tanah diisi petani, kualitas tanaman dideteksi dengan CNN, dokumentasi foto lahan tidak memakai AI, asisten percakapan memakai Gemini.

**Stack produksi**: frontend Next.js, backend Express.js, mesin AI Python, ORM Prisma, basis data PostgreSQL.

**Status jujur prototipe**: hitungan biaya, risiko, kalender, riwayat, pengingat, dan musim tanam berfungsi dengan aturan di dalam file. Prakiraan cuaca memakai data nyata. Riwayat musim menyimpan data berformat dataset latih dan bisa diunduh sebagai CSV; pengambilan cuaca otomatis untuk riwayat memakai data harian Open-Meteo, tetapi baru diuji dengan data tiruan. Model XGBoost, CNN, dan Gemini belum terpasang; stack produksi belum dibangun; bagian yang menyerupai AI (deteksi daun, verifikasi foto, asisten, foto nota, suara) masih simulasi.

## 2. Masalah dan tujuan

Petani kecil biasanya mulai menanam tanpa gambaran biaya total, sehingga modal sering habis sebelum panen. Biaya naik karena hujan, serangan hama, harga pupuk, dan upah, sementara bank sulit menilai kelayakan karena petani tidak punya catatan dan bukti lahan yang rapi.

- **Sebelum tanam**: petani tahu total biaya, rentang kemungkinan, dan kekurangan modalnya.
- **Selama musim**: biaya aktual dibandingkan dengan rencana, dengan peringatan dini.
- **Saat modal kurang**: catatan, foto lahan, dan rencana biaya menjadi bahan pengajuan pinjaman.
- **Setelah panen**: hasil dan biaya tercatat sebagai riwayat yang memperbaiki prediksi musim berikutnya. Riwayat disimpan dalam format yang sama dengan data latih model, sehingga tiap musim yang selesai menambah data nyata.

## 3. Konsep dan alur pengguna

Alur utama: tiga langkah di menu Musim tanam, lalu berlanjut ke riwayat dan pengajuan pinjaman.

1. **Mulai perhitungan pembiayaan.** Modal dengan tombol Mulai dan Batal. Jika Mulai, seluruh perhitungan uang muncul. Jika Batal, tidak ada angka uang yang ditampilkan sama sekali.
2. **Mulai penanaman.** Petani menekan tombol di hari tanam. Hari itu dihitung minggu 1, lalu kalender biaya dan pengingat cek lahan mengikuti. Perkiraan tanggal panen ikut dihitung. Dalam data latih, minggu ke-1 adalah awal musim termasuk persiapan lahan (dua minggu pertama berfase persiapan), sehingga tanggal ini diperlakukan sebagai tanggal mulai musim.
3. **Panen.** Petani mencatat semua hasil panen (tanggal, mutu A/B/C, berat, harga, pembeli), mengisi sampel panen (berat dan luas petak contoh) dengan foto bukti yang otomatis bercap waktu dan lokasi, lalu menutup musim. Sistem membandingkan estimasi dari sampel dengan total yang dicatat; selisih lebih dari 30% ditandai untuk diperiksa. Saat musim ditutup, aplikasi membuat record riwayat berformat dataset: data lahan dari Profil, biaya per minggu dari Catatan pengeluaran, cuaca musim diambil otomatis bila lokasi ladang sudah diisi. Isian yang belum ada ditandai, dan petani melengkapinya di menu Riwayat musim.
4. **Riwayat dan pinjaman.** Musim yang selesai masuk ke riwayat. Bila modal kurang, petani mengajukan pinjaman musiman dengan rencana biaya dan catatan terlampir.

Selama perhitungan pembiayaan belum dimulai, menu yang berisi uang menampilkan satu kartu ajakan untuk memulai. Menu Profil, Pengingat cek lahan, Musim tanam, dan Cuaca dan lahan tetap bisa dipakai; di Cuaca dan lahan, angka rupiah disembunyikan.

## 4. Fitur prototipe

| Menu | Fungsi | Status prototipe |
| --- | --- | --- |
| Beranda | Ringkasan musim, minggu berjalan, kartu menuju semua fitur | Berfungsi |
| Musim tanam | Mulai pembiayaan, mulai penanaman (minggu 1), panen dengan sampel dan foto bukti, tutup musim ke riwayat. Penutupan musim membuat record riwayat berformat dataset | Berfungsi, data di browser |
| Pengingat cek lahan | Daftar cek mingguan, rutinitas berturut-turut, pengingat | Berfungsi |
| Prediksi musim | Total biaya, rentang 80% dari simulasi Monte Carlo, peluang biaya melewati modal | Berfungsi (aturan, belum XGBoost) |
| Rencana biaya | Biaya per fase dan per kategori, realisasi dibanding rencana, minggu puncak biaya, peringatan | Berfungsi |
| Kalender uang | Arus kas mingguan, minggu modal habis, tombol pengajuan pinjaman | Berfungsi |
| Cuaca dan lahan | Prakiraan hujan 7 hari, pH tanah dari petani, indikasi kondisi tanaman, foto progres lahan | Cuaca nyata; deteksi daun dan verifikasi foto simulasi |
| Asisten | Tanya jawab, catat pengeluaran dari kalimat, suara, atau foto nota | Simulasi; akan memakai Gemini. Catatan dari foto nota dan suara ditandai simulasi dan tidak masuk data latih |
| Risiko dan kredit | Skor kesiapan kredit, rasio penutupan pinjaman oleh pendapatan terburuk, pengajuan | Berfungsi (aturan) |
| Catatan | Catatan pengeluaran aktual per kategori. Tiap catatan punya tanggal (bisa diisi mundur) sehingga bisa dijumlah per minggu musim | Diperbarui, berfungsi |
| Riwayat musim | Daftar musim lalu, hasil, untung atau rugi, perbandingan dengan musim ini. Baru: formulir tambah, simpan musim ini, lengkapi/ubah; status kualitas data; kartu data latih; unduh CSV format dataset | Diperbarui, berfungsi, data di browser |
| Profil | Akun, data lahan, tanggal tanam, modal. Baru: provinsi dan kadar nitrogen, fosfor, kalium tanah | Diperbarui, tersimpan di browser |

## 5. Perhitungan biaya saat ini (baseline berbasis aturan)

Aturan tetap; **dipertahankan sebagai baseline pembanding setelah XGBoost dipasang**.

- Biaya dasar = biaya per hektare tanaman x luas lahan, disesuaikan kenaikan harga pupuk dan upah. Acuan per hektare: cabai merah Rp 73,7 juta, tomat Rp 59 juta, bawang merah Rp 52 juta.
- Tambahan untuk fungisida bila hujan melebihi 60 mm per minggu, serta kapur dolomit dan pupuk fosfor bila pH di bawah 6.
- Empat fase: persiapan lahan, penanaman, perawatan, panen dan pascapanen, dengan porsi biaya **19%, 16%, 50%, 15%**. Biaya fase dibagi ke minggu dengan pola naik turun. Lama fase (minggu): cabai 2, 2, 8, 4; tomat 2, 2, 7, 3; bawang 2, 1, 5, 2.
- Lima kategori: benih dan bibit, pupuk, obat hama dan penyakit, tenaga kerja, lain-lain.
- Rentang ketidakpastian: simulasi Monte Carlo 500 kali (hujan, serangan hama, harga pupuk, faktor lain) menghasilkan persentil 10, 50, 90.
- Skor kesiapan kredit (300 sampai 850): disiplin biaya (35%), kelengkapan catatan (20%), verifikasi foto (15%), kemampuan membayar (30%). Heuristik, belum divalidasi dengan data kredit nyata.

(Rumus persis di prototipe ada di `03-spesifikasi-prototipe-html.md`.)

## 6. Riwayat musim dan data latih

Riwayat musim berperan ganda: ringkasan untung rugi bagi petani, dan penampung data nyata untuk melatih ulang model biaya. Satu musim = satu record dengan skema yang sama seperti `dataset_sintetis_agrochie.csv`.

### 6.1 Skema record

Satu record = 18 isian tingkat-musim, biaya per minggu, dan beberapa isian khusus aplikasi yang tidak masuk dataset (nama musim, tanggal panen, hasil panen, harga jual, catatan). Baris dataset (32 kolom, satu baris per minggu) dibentuk dari record saat data diunduh.

| Isian dataset | Asal di aplikasi |
| --- | --- |
| `komoditas`, `luas_ha` | Profil atau formulir musim. Dataset mencakup cabai, tomat, bawang dan luas 0,1 sampai 3,0 ha |
| `jenis_tanah`, `sumber_air` | Profil. Pilihan sama persis dengan nilai di dataset |
| `provinsi` | Profil (baru). Lima provinsi di dataset: Jawa Barat, Jawa Tengah, Jawa Timur, Sulawesi Selatan, Sumatera Utara |
| `bulan_tanam` | Bulan dari tanggal mulai musim |
| `ph` | Profil atau formulir musim |
| `nitrogen`, `fosfor`, `kalium` | Profil (baru). Tiga tingkat: rendah, sedang, tinggi |
| `indeks_harga_pupuk`, `indeks_upah`, `indeks_harga_pestisida` | Formulir musim. Petani mengisi perubahan harga dibanding biasanya dalam persen; indeks = 100 + persen (6% menjadi 106). Tidak diisi otomatis dari tebakan |
| `hujan_mm_rata_per_minggu`, `minggu_hujan_lebat`, `suhu_maks_rata` | Otomatis dari data harian Open-Meteo di titik ladang selama musim, atau diisi manual. Minggu hujan lebat = minggu dengan hujan 150 mm atau lebih (konstanta di kode) |
| `durasi_musim` | Ditetapkan tanaman: cabai 16, tomat 14, bawang 10 minggu |
| `biaya_total_juta` | Jumlah biaya per minggu bila semua minggu terisi; bila tidak, total yang diisi petani |

### 6.2 Kolom turunan

Tidak diisi petani. Aturannya dibaca dari dataset dan diuji terhadap 6 musim asli di dalamnya.

- `minggu_ke`, `posisi_relatif` (`minggu_ke` / durasi, tiga desimal), `fase`, `minggu_dalam_fase`, `jumlah_minggu_fase` dari lama fase tiap tanaman (bagian 5).
- `bulan_kalender_minggu = ((bulan_tanam - 1 + floor((minggu_ke - 1) / 4)) mod 12) + 1` (empat minggu per bulan dari bulan mulai, sama seperti dataset).
- `hujan_mm_minggu_klimatologi`: tabel rata-rata per provinsi dan bulan yang diambil dari dataset.
- `ada_pupuk_dasar` = 1 pada minggu terakhir fase persiapan; `ada_tanam` = 1 pada minggu pertama fase penanaman; `ada_panen` = 1 pada seluruh minggu fase panen. Ketiganya mengikuti jadwal fase seperti di dataset, bukan kejadian yang dicatat petani.
- `porsi_minggu` = biaya minggu / total biaya; `sumber` = "nyata".
- Pembulatan setengah ke genap seperti dataset (mis. 0,0625 menjadi 0,062).

### 6.3 Biaya per minggu

- Catatan pengeluaran menyimpan tanggal, kategori, jumlah. Saat musim disimpan, catatan dijumlah per minggu sejak minggu ke-1. Catatan bertanggal sebelum musim masuk ke minggu 1, sesudah akhir musim masuk ke minggu terakhir.
- Catatan dari foto nota dan rekam suara adalah simulasi di prototipe: ditandai dan **tidak dihitung**.
- Saat tutup panen, biaya mingguan dipakai hanya bila catatan mencakup **90 sampai 110 persen** dari total biaya yang diisi petani. Bila tidak, biaya mingguan dikosongkan dan hanya total yang disimpan.
- **Biaya mingguan tidak pernah diperkirakan oleh model.** Mengisinya dengan perkiraan membuat model belajar dari keluarannya sendiri.
- Formulir "Simpan musim ini" dan form tutup panen tidak terisi dari angka prediksi. Bila belum ada catatan pengeluaran, total biaya dibiarkan kosong agar petani mengisi angka sebenarnya.

### 6.4 Status kualitas dan ekspor

| Status | Arti | Ikut diunduh |
| --- | --- | --- |
| Siap dilatih | Semua 18 isian terisi dan biaya tiap minggu lengkap | Ya, dengan biaya mingguan |
| Siap, total biaya saja | Semua 18 isian terisi, biaya per minggu kosong | Ya, kolom `biaya_minggu_juta` dan `porsi_minggu` kosong |
| Belum lengkap | Ada isian yang belum diketahui. Daftar yang kurang ditampilkan, tombol Lengkapi data | Tidak |
| Contoh | Data demo dari tombol Lihat contoh | Tidak |

- Tombol Unduh CSV format dataset menghasilkan file 32 kolom dalam urutan yang sama dengan dataset. `musim_id` berisi kode acak anonim (huruf R diikuti 8 karakter heksadesimal).
- Nama, nomor HP, desa, dan koordinat ladang tidak ikut; lokasi hanya diwakili provinsi.
- Record lama di penyimpanan browser diubah otomatis ke format baru. Isian yang tidak pernah dicatat dibiarkan kosong, tidak ditebak.

### 6.5 Hasil pengujian

- Enam musim asli dari dataset (dua per tanaman) dimasukkan sebagai record, lalu baris yang dihasilkan dibandingkan dengan CSV: dari 30 kolom yang dibandingkan (`musim_id` dan `sumber` memang berbeda), 28 identik pada 2.400 sel. Dua kolom berbeda karena sifat dataset: `hujan_mm_minggu_klimatologi` di dataset berderau acak sampai 19 mm di sekitar rata-rata bulanan, sedangkan data nyata memakai rata-rata itu; `porsi_minggu` berbeda paling besar 0,00004 karena dataset menghitungnya dari biaya sebelum dibulatkan.
- Dua belas tampilan aplikasi dirender tanpa galat (formulir profil, catatan bertanggal, formulir musim, tutup panen, unduhan CSV).
- Pengambilan cuaca otomatis diuji dengan data tiruan (hujan rata-rata, minggu hujan lebat, suhu dihitung benar). Panggilan ke server Open-Meteo sungguhan belum diuji.
- Pengujian di lingkungan simulasi browser, belum di perangkat petani.

## 7. Stack teknologi dan arsitektur

| Lapisan | Teknologi | Peran |
| --- | --- | --- |
| Frontend | Next.js | Antarmuka petani dan halaman verifikasi bank; menjalankan model CNN di browser dengan TensorFlow.js; dapat dibuat PWA agar offline |
| Backend API | Express.js | REST API untuk akun dan sesi, musim, biaya, panen, foto, pinjaman; perantara ke Gemini dan API cuaca; meneruskan permintaan prediksi ke mesin Python |
| Mesin AI | Python | Melatih dan menyajikan model XGBoost; melatih model CNN. Diakses internal oleh Express.js lewat HTTP |
| ORM | Prisma | Akses data bertipe dari Express.js, definisi skema, migrasi |
| Basis data | PostgreSQL | Akun, lahan, musim, rencana biaya, pengeluaran bertanggal, record riwayat, panen, metadata foto, pengajuan pinjaman, log prediksi |

### Teknologi AI per fitur

| Fitur | Teknologi | Catatan |
| --- | --- | --- |
| Prediksi rencana biaya | XGBoost (regresi kuantil) di mesin Python | Data tabular kecil; mudah dijelaskan dengan SHAP |
| Prakiraan cuaca | API Open-Meteo; BMKG tambahan | Prakiraan 7 hari sudah dipakai di prototipe. Data harian historis dipakai mengisi cuaca riwayat. Dipanggil dari Express.js dengan titik lahan dari profil |
| pH tanah | Input petani | Batas nilai wajar, tanggal ukur, pengingat bila terlalu lama |
| Kualitas tanaman | CNN (transfer learning) | Dilatih di Python, dijalankan di browser lewat TensorFlow.js agar bisa offline |
| Foto dokumentasi lahan | Tanpa AI | Pemeriksaan berbasis aturan: GPS, waktu, hash foto |
| Asisten percakapan | Gemini lewat API | Dipanggil dari Express.js; kunci API tidak pernah ada di browser |

### Alur permintaan

1. Petani memakai antarmuka Next.js; setiap aksi dikirim ke API Express.js.
2. Express.js memeriksa sesi, lalu membaca dan menulis data lewat Prisma ke PostgreSQL.
3. Untuk prediksi biaya, Express.js memanggil mesin Python (model XGBoost), lalu menyimpan hasil beserta versi modelnya ke PostgreSQL.
4. Untuk cuaca dan percakapan, Express.js memanggil Open-Meteo atau BMKG dan Gemini.
5. Untuk foto, berkas disimpan di penyimpanan objek (kompatibel S3), sedangkan hash, GPS, dan waktunya di PostgreSQL. Model CNN berjalan di browser.

**Mesin Python tidak dibuka ke internet; hanya Express.js yang boleh memanggilnya.** Kunci API Gemini dan kredensial basis data hanya ada di server, lewat variabel lingkungan.

## 8. Model data: Prisma dan PostgreSQL

Skema ditulis sekali di berkas Prisma, migrasi dengan Prisma Migrate. Nilai rupiah bertipe Decimal.

| Entitas | Isi | Catatan |
| --- | --- | --- |
| User | Akun, peran (petani atau petugas bank), kata sandi ter-hash | Dasar hak akses |
| Farm (lahan) | Nama, luas, koordinat batas, jenis tanah, sumber air, provinsi, kadar N, P, K, pH beserta tanggal ukur | Satu petani, banyak lahan. Provinsi dan NPK baru |
| Season | Tanaman, tanggal mulai pembiayaan, tanggal tanam, status musim | Mewakili langkah 1 dan 2 |
| CostPlan | Cuplikan hitungan saat Mulai: total, persentil 10, 50, 90, modal, kekurangan, versi model | Acuan realisasi vs rencana |
| Expense | Pengeluaran aktual: tanggal, kategori, jumlah, penanda simulasi | Sumber biaya per minggu; data latih model. Tanggal dan penanda baru |
| SeasonRecord | Isian tingkat-musim yang sama dengan 18 isian dataset, kode anonim untuk ekspor, hasil panen, harga jual, penanda kualitas | Satu per musim selesai. Baru |
| WeeklyCost | Biaya per minggu untuk satu SeasonRecord; nilai boleh kosong | Baru |
| Harvest | Tanggal, mutu, berat, harga per kg, pembeli | Satu musim, banyak entri |
| HarvestSample dan Photo | Berat dan luas petak sampel; foto progres dan foto sampel dengan URL, hash, GPS, waktu | Berkas foto di penyimpanan objek |
| Reminder | Daftar cek mingguan dan status selesai | Menghitung rutinitas |
| LoanApplication | Jumlah, tenor, status, kode rujukan, masa berlaku, persetujuan berbagi data | Dilihat bank lewat kode |
| PredictionLog | Masukan, keluaran, versi model, waktu | Pemantauan dan latih ulang |

Potongan skema Prisma (model lain disingkat):

```prisma
enum Level { RENDAH SEDANG TINGGI }

model Expense {
  id        String   @id @default(cuid())
  seasonId  String
  season    Season   @relation(fields: [seasonId], references: [id])
  spentOn   DateTime @db.Date
  category  String
  amountJt  Decimal  @db.Decimal(10, 3) // juta Rp
  simulated Boolean  @default(false)    // foto nota dan suara di prototipe
}

model SeasonRecord {
  id          String  @id @default(cuid())
  seasonId    String  @unique
  anonId      String  @unique // musim_id pada ekspor
  crop        String
  areaHa      Decimal @db.Decimal(5, 2)
  soilType    String?
  waterSource String?
  province    String?
  startMonth  Int?
  rainAvgMm   Decimal? @db.Decimal(6, 1)
  heavyRainWks Int?
  tempMaxAvg  Decimal? @db.Decimal(4, 1)
  ph          Decimal? @db.Decimal(3, 1)
  nitrogen    Level?
  phosphorus  Level?
  potassium   Level?
  fertIndex   Decimal? @db.Decimal(5, 1)
  wageIndex   Decimal? @db.Decimal(5, 1)
  pestIndex   Decimal? @db.Decimal(5, 1)
  durationWks Int
  totalCostJt Decimal  @db.Decimal(10, 2)
  yieldKg     Decimal? @db.Decimal(10, 2)
  pricePerKg  Decimal? @db.Decimal(12, 2)
  weeks       WeeklyCost[]
}

model WeeklyCost {
  recordId String
  record   SeasonRecord @relation(fields: [recordId], references: [id])
  week     Int
  costJt   Decimal? @db.Decimal(10, 3) // kosong bila tidak diketahui
  @@id([recordId, week])
}
```

Dataset latih dibentuk sebagai **view**, bukan tabel 32 kolom. View dibuat lewat migrasi SQL (Prisma tidak mengelolanya langsung) dengan menggabungkan SeasonRecord, WeeklyCost, tabel referensi lama fase per tanaman, dan tabel referensi hujan klimatologi per provinsi dan bulan. Dengan cara ini kolom turunan tidak bisa menyimpang dari aturannya, dan ekspor untuk pelatihan cukup satu kueri. Kolom `sumber` dipertahankan agar data nyata dan sintetis bisa dicampur atau dipisah.

Foto tidak disimpan sebagai isi berkas di PostgreSQL; tabel hanya memegang alamat berkas, hash, koordinat, dan waktu.

## 9. Model prediksi biaya: XGBoost

### Tujuan

Memprediksi total biaya satu musim, biaya tiap minggu, dan rentang 80% (persentil 10 dan 90) dari data lahan, cuaca, dan harga, sebelum petani menanam dan diperbarui selama musim berjalan.

### Mengapa XGBoost

Data biaya tani berbentuk tabel dengan baris kecil sampai menengah. Gradient boosting umumnya lebih akurat, lebih cepat dilatih, dan lebih mudah dijelaskan kepada petani dan bank dibanding transformer. XGBoost mendukung regresi kuantil, sehingga rentang ketidakpastian berasal langsung dari model.

### Dataset sintetis saat ini

| Ukuran | Nilai |
| --- | --- |
| Musim / baris / kolom | 5.000 musim, 66.520 baris (satu baris per minggu per musim), 32 kolom |
| Komoditas | Cabai 1.596 musim (16 minggu), tomat 1.736 musim (14 minggu), bawang merah 1.668 musim (10 minggu) |
| Cakupan | 5 provinsi, 5 jenis tanah, 4 sumber air, 12 bulan tanam, luas 0,1 sampai 3,0 ha, pH 4,5 sampai 7,5 |
| Rentang indeks harga | Pupuk 90 sampai 130, upah 90 sampai 120, pestisida 90 sampai 125 |
| Kolom `sumber` | Seluruhnya "sintetis"; data nyata dari aplikasi bernilai "nyata" |

### Fitur masukan

Disamakan dengan kolom dataset, sehingga data nyata dari Riwayat musim dapat dipakai langsung.

| Kelompok | Kolom dataset |
| --- | --- |
| Tanaman dan lahan | `komoditas`, `luas_ha`, `jenis_tanah`, `sumber_air`, `ph`, `nitrogen`, `fosfor`, `kalium` |
| Waktu dan lokasi | `provinsi`, `bulan_tanam`, `bulan_kalender_minggu`, `hujan_mm_minggu_klimatologi` |
| Cuaca musim | `hujan_mm_rata_per_minggu`, `minggu_hujan_lebat`, `suhu_maks_rata` |
| Harga input | `indeks_harga_pupuk`, `indeks_upah`, `indeks_harga_pestisida` |
| Posisi dalam musim | `minggu_ke`, `durasi_musim`, `posisi_relatif`, `fase`, `minggu_dalam_fase`, `jumlah_minggu_fase`, `ada_tanam`, `ada_pupuk_dasar`, `ada_panen` |
| Riwayat petani (rencana) | Jumlah musim tercatat dan selisih realisasi dengan rencana pada musim lalu; belum ada di dataset, ditambahkan setelah data nyata terkumpul |

### Target dan keluaran

- Total biaya satu musim (`biaya_total_juta`), keluaran persentil 10, 50, 90. Dataset menyimpan total per musim dengan luas sebagai fitur; biaya per hektare = total / luas.
- Biaya per minggu (`biaya_minggu_juta`, atau `porsi_minggu` terhadap total) untuk jadwal dan kalender uang. Biaya per fase = jumlah minggu dalam fase. Nilai nyata baru tersedia dari musim yang biaya mingguannya lengkap (status Siap dilatih); sebelum itu pola mingguan memakai baseline.
- Penjelasan faktor penyebab memakai SHAP, diterjemahkan menjadi kalimat seperti "hujan tinggi menambah biaya fungisida".

### Data

Sumber terencana: data ongkos usaha tani BPS dan Kementerian Pertanian, harga input dari sumber resmi, cuaca historis, dan data sintetis dari aturan agronomi (mis. aturan baseline) untuk mengisi kekosongan. Setelah aplikasi dipakai, realisasi biaya petani dari Riwayat musim menjadi data latih terpenting.

> Selama modelnya dilatih pada data sintetis, hasilnya hanya sebaik aturan pembangkitnya. Akurasi tidak boleh diklaim sebelum diuji pada data nyata.

### Contoh pelatihan rentang 80%

```python
import xgboost as xgb
params = dict(objective="reg:quantileerror",
              quantile_alpha=[0.1, 0.5, 0.9],
              tree_method="hist", max_depth=5,
              learning_rate=0.05, subsample=0.8)
dtrain = xgb.DMatrix(X_train, label=y_train)
dval = xgb.DMatrix(X_val, label=y_val)
model = xgb.train(params, dtrain, num_boost_round=600,
                  evals=[(dval, "val")], early_stopping_rounds=40)
p10, p50, p90 = model.predict(xgb.DMatrix(X_new)).T
```

Regresi kuantil bawaan memerlukan XGBoost 2.0 atau lebih baru.

### Evaluasi

- Akurasi titik: MAE dan MAPE pada total biaya per hektare.
- Kalibrasi rentang: cakupan interval 80% harus mendekati 80%; bila jauh, lakukan kalibrasi.
- Pembanding: model harus mengalahkan baseline aturan; bila tidak, baseline tetap dipakai.
- Pemisahan data: validasi per wilayah dan per musim (group k-fold). Satu musim punya 10 sampai 16 baris mingguan dengan fitur musim yang sama, jadi seluruh baris satu `musim_id` harus di lipatan yang sama; membagi per baris membocorkan data dan membuat akurasi tampak terlalu baik.
- Data sintetis dan nyata: laporkan metrik terpisah untuk `sumber` "sintetis" dan "nyata"; jangan menilai model hanya dari data sintetis.

### Alur dari data sampai layanan

1. Kumpulkan dan bersihkan data, buat fitur.
2. Latih dan atur parameter (mis. Optuna), validasi per wilayah.
3. Simpan model (JSON XGBoost atau ONNX) dan pasang di mesin Python.
4. Next.js memanggil API Express.js saat petani menekan Mulai; Express.js meneruskan ke mesin Python, menyimpan hasilnya ke PostgreSQL, dan memperbarui prediksi bila cuaca atau pH berubah.
5. Pantau selisih prediksi dan realisasi, latih ulang berkala dengan data musim selesai dari PostgreSQL (view dataset latih).

## 10. Deteksi kualitas tanaman: CNN

- **Tujuan**: indikasi awal kondisi daun (bercak, keriting, sehat) dari foto, lalu saran tindakan dan perkiraan tambahan biaya penanganan.
- **Model**: CNN transfer learning (MobileNetV2 atau EfficientNet-B0), lapisan akhir dilatih ulang lalu disesuaikan sebagian.
- **Data**: dataset publik seperti PlantVillage, ditambah foto lapangan sendiri (PlantVillage berlatar laboratorium dan sering gagal pada foto di lahan). Augmentasi: rotasi, pencahayaan, latar.
- **Label**: perlu ditetapkan sejak awal: penyakit, tahap tumbuh, atau mutu panen. Mutu panen (A/B/C) dapat dihubungkan dengan fitur panen.
- **Evaluasi**: F1 per kelas dan confusion matrix, set uji berupa foto lapangan terpisah dari data latih.
- **Penyajian**: dilatih di Python, diekspor ke TensorFlow.js agar jalan di browser Next.js, termasuk offline. Tampilkan tingkat keyakinan; di bawah ambang batas, minta foto ulang.

Hasil selalu **indikasi awal, bukan diagnosis pasti**, dengan anjuran bertanya ke penyuluh pertanian untuk kasus serius.

## 11. Asisten percakapan: Gemini

- **Fungsi**: menjawab pertanyaan petani, membantu mencatat pengeluaran dari kalimat, menjelaskan angka di aplikasi.
- **Konteks**: Express.js mengirim ringkasan data aplikasi ke Gemini (tanaman, minggu berjalan, pH, cuaca, hasil prediksi).
- **Angka dari mesin biaya**: Gemini menjelaskan dan menyusun kalimat; nilai rupiah berasal dari model biaya, bukan dikarang model bahasa.
- **Pencatatan**: pengeluaran lewat percakapan tersimpan dengan tanggal dan masuk ke biaya mingguan seperti catatan lain; hasil simulasi (foto nota dan suara di prototipe) ditandai dan tidak ikut.
- **Batasan**: tidak menjanjikan persetujuan pinjaman atau kepastian hasil panen.
- **Keamanan**: kunci API hanya di server Express.js (variabel lingkungan), data identitas tidak dikirim ke model, percakapan dibatasi pada topik pertanian dan pembiayaan.

## 12. Foto dokumentasi lahan (tanpa AI)

Foto progres lahan dan foto sampel panen berfungsi sebagai bukti bagi bank. Keabsahan dijaga dengan pemeriksaan berbasis aturan, bukan AI:

- **Lokasi**: titik GPS foto berada di dalam batas lahan yang terdaftar.
- **Waktu**: cap waktu foto cocok dengan minggu musim berjalan.
- **Keutuhan**: hash (mis. SHA-256) disimpan saat foto diambil untuk menandai bila berkas diubah.
- **Duplikat**: hash yang sama tidak diterima dua kali sebagai bukti berbeda.

Layar "Verifikasi foto lahan" di prototipe masih mensimulasikan pemeriksaan AI, termasuk klaim mendeteksi foto layar. Bagian itu perlu diganti dengan pemeriksaan di atas dan klaim tersebut dihapus.

## 13. Pengajuan pinjaman dan kode rujukan (rencana)

Setelah form pengajuan diisi, petani menerima **kode rujukan** yang dibawa ke bank. **Kode ini bukan persetujuan; keputusan tetap di tangan bank.**

- **Form**: data petani, lahan, komoditas, jumlah dan tujuan pinjaman, tenor sesuai musim, persetujuan berbagi data.
- **Kode**: unik, sekali pakai, kedaluwarsa (mis. 14 hari), dengan QR.
- **Paket data untuk bank**: profil lahan, rencana dan realisasi biaya, riwayat musim, foto berlokasi dan berwaktu, catatan panen, skor kesiapan.
- **Halaman verifikasi bank**: petugas memasukkan kode atau memindai QR untuk melihat paket data.
- **Status**: Diajukan, Diperiksa bank, Disetujui atau Ditolak.
- **Kepatuhan**: format isian disesuaikan dengan syarat produk bank (mis. KUR), serta aturan perlindungan data pribadi.

## 14. Privasi dan keamanan

- **Prototipe**: akun dan data di browser perangkat, foto dikompres, tidak ada data ke server kecuali permintaan cuaca (prakiraan, dan data harian historis untuk riwayat) yang memuat koordinat ladang ke Open-Meteo. Data latih keluar dari aplikasi hanya lewat unduhan CSV oleh petani sendiri.
- **Ekspor data latih**: `musim_id` diganti kode acak anonim; nama, nomor HP, desa, koordinat tidak ikut; lokasi hanya provinsi. Petani perlu memberi persetujuan eksplisit sebelum datanya dipakai melatih model.
- **Produksi**: PostgreSQL dengan enkripsi, akses berdasarkan peran, persetujuan eksplisit petani sebelum data dibagikan ke bank. Kode anonim dan identitas petani disimpan terpisah dari view dataset latih.
- **Aplikasi**: kata sandi di-hash (argon2 atau bcrypt), masukan divalidasi di Express.js, akses data lewat Prisma dengan kueri berparameter.
- **Data minimal**: identitas kependudukan tidak disimpan di prototipe dan hanya diminta bila benar-benar diperlukan untuk pengajuan.

## 15. Keterbatasan dan risiko

| Risiko | Penanganan |
| --- | --- |
| Data latih sintetis membuat prediksi tampak lebih akurat dari kenyataan | Kumpulkan data biaya nyata sedini mungkin; sampaikan batasan; bandingkan dengan baseline; laporkan metrik data nyata terpisah |
| Definisi "minggu hujan lebat" pada dataset tidak terdokumentasi; aplikasi memakai 150 mm per minggu | Cocokkan dengan definisi di generator data. Bila berbeda, ubah konstanta di aplikasi atau hitung ulang kolom pada data sintetis agar fitur berarti sama |
| Hujan klimatologi di dataset berderau acak dan hampir sama antarprovinsi, sedangkan data nyata memakai rata-rata bulanan | Perlakukan sebagai fitur musiman saja; ganti dengan klimatologi sebenarnya per wilayah bila tersedia |
| Data nyata di luar rentang dataset (profil izinkan luas sampai 5 ha, dataset hanya 3 ha; indeks harga dan suhu juga terbatas) | Tandai prediksi di luar rentang latih, atau batasi masukan; tambah data nyata di rentang itu |
| Petani jarang mencatat biaya mingguan secara lengkap | Catatan bertanggal yang mudah (kalimat, suara, nota); musim dengan total biaya saja tetap berguna untuk model total; biaya mingguan tidak diperkirakan |
| Indeks harga input diisi petani dari perkiraan, bukan sumber resmi | Pada produksi isi dari indeks harga resmi daerah; petani hanya mengoreksi |
| Cuaca otomatis untuk riwayat belum diuji pada server nyata | Uji di browser dengan koneksi internet sebelum pilot; siapkan isian manual |
| Penanda `ada_tanam`, `ada_pupuk_dasar`, `ada_panen` mengikuti jadwal, bukan kejadian nyata | Catat tanggal kejadian sebenarnya bila ingin dipakai sebagai fitur informatif |
| CNN gagal pada foto lapangan | Tambahkan foto lapangan, tetapkan ambang keyakinan, tampilkan sebagai indikasi awal |
| Skor kredit belum teruji | Perlakukan sebagai ringkasan kesiapan, bukan keputusan kredit; validasi bersama bank |
| Ketergantungan pada mitra bank | Mulai dengan simulasi dan satu mitra pilot |
| Sinyal internet lemah di desa | PWA, model CNN di perangkat, sinkron saat tersambung |
| Petani salah paham bahwa kode rujukan sama dengan persetujuan | Tampilkan penjelasan jelas di setiap layar dan di kode |

## 16. Peta jalan

1. **Prototipe (sekarang)**: alur musim tanam, hitungan berbasis aturan, cuaca nyata, riwayat berformat dataset dengan unduhan CSV; bagian AI simulasi.
2. **Data dan model**: kumpulkan data ongkos usaha tani dan CSV riwayat dari petani pilot, selaraskan definisi fitur dengan generator data sintetis, latih XGBoost dengan validasi per musim dan bandingkan dengan baseline; kumpulkan foto lapangan dan latih CNN.
3. **Aplikasi produksi**: Next.js, API Express.js, skema Prisma di PostgreSQL (termasuk SeasonRecord, WeeklyCost, view dataset latih), mesin Python untuk prediksi, perantara Gemini, form pinjaman dengan kode rujukan, halaman verifikasi bank.
4. **Pilot**: uji dengan kelompok petani dan satu bank, ukur selisih prediksi dengan realisasi, perbaiki model dan alur.
