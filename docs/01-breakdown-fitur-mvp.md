# AgroChie: Breakdown Fitur MVP

Sumber: `AgroChie_Breakdown_Fitur_MVP_v2.pdf` (8 Oktober 2026), diselaraskan dengan Dokumen Prototipe v2 dan prototipe `AgroChie.html`.
Catatan konversi: tabel "Ringkasan pembaruan" (perubahan dibanding versi 7 Oktober) dihilangkan; isinya sudah tercermin di bagian bawah.

Aplikasi pendamping petani untuk tahu biaya tanam sebelum menanam: memprediksi biaya satu musim ke depan, menyusun kalender uang, mencatat pengeluaran, mengumpulkan riwayat musim berformat data latih, dan menyiapkan bukti kelayakan untuk pinjaman.

Istilah status "jujur" dari prototipe v2: **Berfungsi**, **Berfungsi (aturan)**, **Simulasi**. XGBoost, CNN, Gemini, dan stack produksi belum terpasang.

---

## 1. Ringkasan

Tiga tingkat prioritas:

| Tingkat | Fitur | Peran |
| --- | --- | --- |
| P0 Inti | F1 sampai F5 (5 fitur) | Tanpa ini produk tidak memberi nilai: profil, mulai hitung, prediksi dan kalender biaya, satu musim sampai panen. |
| P1 Pendukung utama | F6, F7, F8, F9, F11 (5 fitur) | Prediksi lebih akurat dan berguna: cuaca dan tanah, catatan pengeluaran, risiko dan kredit, beranda, riwayat musim sekaligus penampung data latih. |
| P2 Pendukung tambahan | F10, F12, F13, F14 (4 fitur) | Kebiasaan pakai dan kemudahan: pengingat, laba, kondisi tanaman, asisten. |

### Prinsip MVP

- Fitur inti: perencanaan pembiayaan pertanian satu musim ke depan.
- **Rentang, bukan angka tunggal**: prediksi menampilkan rentang 80 persen (persentil 10 sampai 90) total biaya dan rincian per minggu.
- **Tanpa angka uang sebelum Mulai**: selama perhitungan pembiayaan belum dimulai, aplikasi tidak menampilkan angka uang sama sekali. Cuaca dan tanah tetap terbuka, dengan angka rupiah disembunyikan.
- **Satu musim, tiga langkah**: Mulai perhitungan pembiayaan, Mulai penanaman (hari itu minggu 1), Panen.
- Bahasa sederhana: seluruh antarmuka berbahasa Indonesia untuk petani.
- **Data nyata dikumpulkan sejak awal**: setiap musim yang selesai disimpan sebagai record berformat dataset latih, sehingga model bisa dilatih ulang dengan data petani.
- **Jujur soal batas**: akurasi model tidak boleh diklaim sebelum diuji pada data nyata; biaya mingguan tidak pernah diperkirakan model untuk mengisi data latih.

### Status prototipe saat ini

Satu file HTML yang berjalan di browser (cabai merah, bawang merah, tomat). Hitungan biaya, risiko, kalender, riwayat, pengingat, dan musim tanam berfungsi dengan aturan di dalam file. Prakiraan cuaca memakai data nyata. Pengambilan cuaca otomatis untuk riwayat memakai data harian Open-Meteo, tetapi baru diuji dengan data tiruan. Model XGBoost, CNN, dan Gemini belum terpasang; stack produksi (Next.js, Express.js, Python, Prisma, PostgreSQL) belum dibangun; bagian yang menyerupai AI (deteksi daun, verifikasi foto, asisten, foto nota, suara) masih simulasi.

---

## 2. Peta fitur

Menu navigasi bawah ponsel: Beranda, Musim, Cek lahan, Prediksi, Asisten, Profil.

| ID | Fitur | Menu di prototipe | Tingkat | Status prototipe v2 |
| --- | --- | --- | --- | --- |
| F1 | Akun dan profil lahan | Profil | P0 | Berfungsi, tersimpan di browser. Baru: provinsi dan NPK |
| F2 | Mulai perhitungan pembiayaan | Musim tanam | P0 | Berfungsi |
| F3 | Prediksi biaya musim | Prediksi musim | P0 | Berfungsi (aturan dan Monte Carlo, belum XGBoost) |
| F4 | Rencana biaya dan kalender uang | Rencana biaya, Kalender uang | P0 | Berfungsi |
| F5 | Alur musim tanam dan panen | Musim tanam | P0 | Berfungsi, data di browser. Tutup musim membuat record dataset |
| F6 | Cuaca dan kualitas tanah | Cuaca dan lahan | P1 | Cuaca nyata (Open-Meteo) |
| F7 | Catatan pengeluaran | Catatan | P1 | Diperbarui, berfungsi (bertanggal) |
| F8 | Risiko dan kredit | Risiko dan kredit | P1 | Berfungsi (aturan); skor heuristik belum divalidasi; pengajuan masih simulasi |
| F9 | Beranda ringkasan | Beranda | P1 | Berfungsi |
| F11 | Riwayat musim dan data latih | Riwayat musim | P1 (naik dari P2) | Diperbarui, berfungsi, data di browser |
| F10 | Pengingat cek lahan mingguan | Pengingat cek lahan | P2 | Berfungsi |
| F12 | Estimasi laba dan harga impas | Rencana biaya, Beranda | P2 | Berfungsi |
| F13 | Kondisi tanaman dan foto progres lahan | Cuaca dan lahan | P2 | Deteksi daun dan verifikasi foto simulasi; CNN belum dipasang |
| F14 | Asisten tanya jawab | Asisten | P2 | Simulasi; akan memakai Gemini |

---

## 3. P0: Fitur inti MVP

Jalur utama pengguna: daftar, isi lahan, mulai hitung, lihat prediksi dan jadwal uang, tanam, panen.

### F1. Akun dan profil lahan

- **Tujuan**: satu kali isi data lahan, lalu seluruh perhitungan memakainya.
- **Fungsi**:
  - Daftar dan masuk dengan akun; mode tamu (data hilang saat keluar).
  - Profil: nama, nomor HP, desa dan kecamatan, provinsi, tanaman (cabai merah, bawang merah, tomat), luas lahan (ha), jenis tanah, sumber air, tanggal tanam, pH tanah, kadar nitrogen, fosfor, kalium (rendah, sedang, tinggi).
  - Lokasi ladang: latitude dan longitude, tombol lokasi HP, cek titik di Google Maps.
  - Keuangan: modal yang dimiliki, harga jual per kg, target laba musim.
  - Indikator kelengkapan profil (persen).
- **Output**: profil tersimpan; perubahan tanaman atau luas memicu hitung ulang rencana. Provinsi dan NPK tersedia untuk record riwayat musim (F11).
- **Batas data**: profil mengizinkan luas sampai 5 ha, dataset latih hanya 0,1 sampai 3,0 ha. Prediksi di luar rentang latih ditandai atau masukan dibatasi.
- **Kriteria selesai**: profil tersimpan dan dimuat kembali setelah login; koordinat tidak valid ditolak; kelengkapan profil dihitung benar.
- **Teknologi**: prototipe = tersimpan di browser. Produksi = Next.js, Express.js, Prisma, PostgreSQL (entitas User dan Farm, dengan koordinat batas lahan). Kata sandi disimpan sebagai hash (argon2 atau bcrypt).

### F2. Mulai perhitungan pembiayaan

- **Tujuan**: pintu masuk ke semua angka uang. Petani memutuskan sendiri kapan mau melihat hitungan.
- **Fungsi**:
  - Modal (popup) dengan tombol **Mulai** dan **Batal**.
  - Mulai: semua hitungan uang muncul (rencana biaya, prediksi dan rentang, kalender uang, laba, risiko kredit). Modal boleh dikosongkan.
  - Batal: tidak ada hitungan uang sama sekali di aplikasi.
  - Sebelum Mulai, menu yang berisi uang menampilkan satu kartu ajakan untuk memulai. Menu Profil, Pengingat cek lahan, Musim tanam, dan Cuaca dan lahan tetap bisa dipakai; di Cuaca dan lahan angka rupiah disembunyikan.
  - Setelah dimulai: hitung ulang dari data terbaru, atau hentikan perhitungan.
  - Menyimpan **potret awal**: tanggal mulai, total biaya, modal, kekurangan modal, harga impas.
- **Input**: modal (juta Rupiah, opsional), data profil.
- **Output**: status perhitungan aktif, ringkasan awal musim, selisih rencana sekarang dibanding saat dimulai.
- **Kriteria selesai**: sebelum Mulai tidak ada angka uang di halaman mana pun; sesudah Mulai semua menu uang terbuka; Hentikan mengembalikan ke keadaan tanpa angka.
- **Teknologi produksi**: entitas `Season` (tanggal mulai pembiayaan, tanggal tanam, status) dan `CostPlan` (cuplikan saat Mulai: total, persentil 10, 50, 90, modal, kekurangan, versi model).
- **Dependensi**: F1. Menjadi syarat untuk F3, F4, F8, F12.

### F3. Prediksi biaya musim (mesin AI)

- **Tujuan**: perkiraan total biaya satu musim ke depan dalam bentuk rentang, plus pola pengeluaran tiap minggu.
- **Fungsi**:
  - Total biaya musim: titik tengah (persentil 50) dan rentang 80 persen (persentil 10 dan 90), misalnya 50 sampai 70 juta.
  - Rincian per minggu sepanjang musim (misalnya minggu 1 = 5 juta).
  - Peluang biaya melebihi modal.
  - Skenario siap pakai: musim normal, musim hujan basah, pupuk dan upah naik; slider hujan, harga pupuk, dan upah.
  - Penjelasan kenapa berupa rentang: cuaca, harga sekitar, riwayat lahan. Rentang menyempit saat catatan pengeluaran bertambah. Di produksi, faktor penyebab dijelaskan dengan SHAP menjadi kalimat seperti "hujan tinggi menambah biaya fungisida".
  - Rekomendasi hemat dan potensi penghematan.
- **Input**: tanaman, luas, jenis tanah, sumber air, pH, NPK, provinsi dan bulan tanam, cuaca, indeks harga pupuk, upah, dan pestisida, riwayat catatan. Fitur riwayat petani (jumlah musim tercatat, selisih realisasi dengan rencana) ditambahkan setelah data nyata terkumpul.
- **Output**: total biaya (rentang 80 persen), biaya per minggu, peluang melebihi modal, rekomendasi.
- **Status prototipe**: berfungsi dengan aturan; simulasi Monte Carlo 500 kali (hujan, serangan hama, harga pupuk, faktor lain) menghasilkan persentil 10, 50, 90. XGBoost belum terpasang. Hitungan aturan ini **dipertahankan sebagai baseline pembanding** setelah XGBoost dipasang.
- **Kriteria selesai**: rentang dan pola mingguan keluar dari model; total mingguan konsisten dengan total musim; skenario mengubah hasil secara masuk akal. Model produksi harus mengalahkan baseline aturan (bila tidak, baseline tetap dipakai) dan cakupan interval 80 persen harus mendekati 80 persen.
- **Teknologi produksi**:
  - XGBoost regresi kuantil (`reg:quantileerror`, XGBoost 2.0 atau lebih baru) di mesin Python, dipanggil hanya oleh Express.js; hasil dan versi model disimpan di PostgreSQL.
  - Dataset sintetis: 5.000 musim, 66.520 baris (satu baris per minggu per musim), 32 kolom; cabai 16 minggu, tomat 14, bawang merah 10. Total musim dan pola mingguan memakai dataset yang sama.
  - Evaluasi: MAE dan MAPE pada biaya per hektare; validasi group k-fold per musim (seluruh baris satu `musim_id` di lipatan yang sama); metrik data sintetis dan nyata dilaporkan terpisah.
- **Peringatan**: selama dilatih pada data sintetis, hasil hanya sebaik aturan pembangkitnya. Akurasi tidak boleh diklaim sebelum diuji pada data nyata. Biaya mingguan tidak pernah diperkirakan model untuk mengisi data latih.
- **Dependensi**: F1, F2; diperkaya F6, F7, F11.

### F4. Rencana biaya dan kalender uang

- **Tujuan**: mengubah prediksi menjadi jadwal uang yang bisa dipegang petani.
- **Fungsi**:
  - Rencana per fase: persiapan lahan, penanaman, perawatan, panen dan pascapanen, dengan porsi **19, 16, 50, 15 persen**; juga per kategori: benih dan bibit, pupuk, obat hama dan penyakit, tenaga kerja, lain-lain. Biaya fase dibagi ke minggu dengan pola naik turun.
  - Penyesuaian otomatis: tambahan fungisida bila hujan melebihi **60 mm per minggu**; kapur dolomit dan pupuk fosfor bila **pH di bawah 6**.
  - Kalender uang: arus kas mingguan, minggu berjalan, minggu puncak biaya, realisasi dibanding rencana, peringatan.
  - Uji modal: modal habis di minggu ke berapa dan berapa kekurangan sampai panen.
  - Akses ke pengajuan pinjaman musiman bila modal kurang (F8).
- **Output**: tabel dan grafik biaya per fase dan per minggu; penanda minggu modal habis.
- **Kriteria selesai**: jumlah semua fase sama dengan total rencana; perubahan cuaca atau pH langsung mengubah angka; minggu modal habis benar.
- **Dependensi**: F2, F3.

#### Acuan baseline per tanaman (prototipe)

| Tanaman | Biaya acuan per hektare | Lama fase (minggu): persiapan, tanam, rawat, panen | Durasi musim |
| --- | --- | --- | --- |
| Cabai merah | Rp 73,7 juta | 2, 2, 8, 4 | 16 minggu |
| Tomat | Rp 59 juta | 2, 2, 7, 3 | 14 minggu |
| Bawang merah | Rp 52 juta | 2, 1, 5, 2 | 10 minggu |

Biaya dasar = biaya per hektare x luas lahan, disesuaikan kenaikan harga pupuk dan upah.

### F5. Alur musim tanam dan panen

- **Tujuan**: memandu petani lewat tiga langkah dari hitungan biaya sampai hasil panen tercatat.
- **Fungsi**:
  - **Langkah 1**: Mulai perhitungan pembiayaan (F2).
  - **Langkah 2**: Mulai penanaman. Tanggal tanam dihitung minggu 1; kalender biaya dan pengingat cek lahan mengikuti. Dalam data latih, minggu 1 adalah awal musim termasuk persiapan lahan (dua minggu pertama berfase persiapan), sehingga tanggal ini diperlakukan sebagai tanggal mulai musim. Perkiraan tanggal panen ditampilkan.
  - **Langkah 3**: Panen. Catat setiap pemetikan atau penjualan: tanggal, mutu (A, B, C atau sortiran), berat, harga per kg, pembeli.
  - Bukti sampel panen: berat hasil dan luas petak sampel, minimal satu foto (maksimal enam) dengan waktu dan lokasi otomatis.
  - Tutup musim: total biaya musim dan catatan (hama, cuaca, harga).
  - Hasil: untung atau rugi, total panen, pendapatan, pembanding hasil sampel dengan total panen yang dicatat (peringatan bila selisih lebih dari **30 persen**).
  - Saat musim ditutup, aplikasi membuat record riwayat berformat dataset: data lahan dari Profil, biaya per minggu dari Catatan pengeluaran, cuaca musim diambil otomatis bila lokasi ladang sudah diisi. Isian yang belum ada ditandai dan petani melengkapinya di Riwayat musim (F11).
  - Musim masuk ke Riwayat musim; tombol mulai musim baru.
- **Validasi**: minimal satu hasil panen, berat dan luas sampel terisi, minimal satu foto sampel, total biaya musim terisi. Total biaya tidak lagi terisi otomatis dari angka prediksi; bila belum ada catatan pengeluaran, dibiarkan kosong agar petani mengisi angka sebenarnya.
- **Kriteria selesai**: langkah berikutnya terkunci sampai langkah sebelumnya selesai; panen tersimpan ke riwayat dan menutup musim; record dataset terbentuk saat tutup musim.
- **Dependensi**: F1, F2; menghasilkan data untuk F11 (dan F7 sebagai sumber biaya mingguan).

---

## 4. P1: Fitur pendukung utama

### F6. Cuaca dan kualitas tanah

- Prakiraan hujan dan suhu 7 hari untuk titik ladang.
- Slider uji total hujan minggu ini beserta dampak biaya.
- pH tanah dan status N, P, K dari test kit atau uji lab (input petani), dampak biaya kapur dan pupuk. Nilai pH dibatasi wajar, ada tanggal ukur dan pengingat bila terlalu lama.
- Cuaca dan tanah tetap terbuka walau perhitungan belum dimulai; angka rupiah disembunyikan sampai Mulai.
- Hubungan: mengubah prediksi (F3) dan rencana biaya (F4) otomatis. Data harian historis mengisi cuaca record riwayat (F11).
- Teknologi: API Open-Meteo (BMKG sebagai tambahan), dipanggil dari Express.js; pH dan NPK input petani.

### F7. Catatan pengeluaran

- Catat pengeluaran: tanggal (boleh diisi mundur), kategori, jumlah.
- Bandingkan rencana dan kenyataan per kategori (benih dan bibit, pupuk, obat hama dan penyakit, tenaga kerja, lain-lain).
- Peringatan bila kategori lebih dari **15 persen** di atas rencana.
- Foto nota dan rekam suara untuk mencatat lebih cepat; di prototipe masih simulasi, ditandai, dan **tidak dihitung atau masuk data latih**.
- Hubungan: mempersempit rentang prediksi (F3); sumber biaya per minggu untuk F11; bukti disiplin untuk F8.
- Teknologi: entitas `Expense` di PostgreSQL (tanggal, kategori, jumlah, penanda simulasi); OCR dan suara tahap lanjut.

### F8. Risiko dan kredit

- **Skor kesiapan kredit 300 sampai 850**: disiplin biaya 35%, kelengkapan catatan 20%, verifikasi foto 15%, kemampuan membayar 30%. Heuristik, belum divalidasi dengan data kredit nyata; ringkasan kesiapan, bukan keputusan kredit.
- Perkiraan hasil panen dan pendapatan terburuk sampai terbaik.
- Rasio penutupan pinjaman oleh pendapatan terburuk.
- Deteksi biaya tidak wajar.
- Ajukan pinjaman musiman: jumlah, tujuan, tenor sesuai musim, persetujuan berbagi data, lampiran rencana, catatan, dan foto.
- Hasilnya **kode rujukan** (unik, sekali pakai, kedaluwarsa misalnya 14 hari, dengan QR) yang dibawa ke bank. **Kode ini bukan persetujuan**; keputusan tetap di bank. Status: Diajukan, Diperiksa bank, Disetujui atau Ditolak.
- Hubungan: memakai F3, F4, F7, F5 (foto bukti); menjawab kebutuhan modal dari F4.
- Teknologi: aturan skor di backend; entitas `LoanApplication`; halaman verifikasi bank; integrasi bank tahap lanjut (di prototipe simulasi).

### F9. Beranda ringkasan

- Ringkasan semua fitur: prediksi satu musim, biaya empat minggu ke depan, status rencana dibanding kenyataan.
- Daftar hal yang perlu diperhatikan (hujan, biaya melenceng, modal habis, cek lahan, foto).
- Tugas minggu ini beserta uangnya. Pintasan ke setiap fitur.
- Agregasi F3, F4, F6, F7, F10. Teknologi: frontend.

### F11. Riwayat musim dan data latih

- **Tujuan**: berperan ganda: ringkasan untung rugi bagi petani, dan penampung data nyata untuk melatih ulang model biaya. Satu musim = satu record dengan skema yang sama seperti dataset sintetis AgroChie.
- **Fungsi**:
  - Daftar musim lalu, hasil, untung atau rugi, harga rata-rata, catatan; perbandingan dengan musim ini; statistik dan garis perbandingan antar musim.
  - Formulir tambah, Simpan musim ini, Lengkapi atau ubah; hapus manual; data contoh yang dapat dihapus.
  - Status kualitas data tiap record; kartu data latih; tombol **Unduh CSV** format dataset (32 kolom, urutan sama dengan dataset).
  - Record lama di penyimpanan browser diubah otomatis ke format baru; isian yang tidak pernah dicatat dibiarkan kosong, tidak ditebak.
- **Isi record**: 18 isian tingkat-musim, biaya per minggu, dan isian khusus aplikasi yang tidak masuk dataset (nama musim, tanggal panen, hasil panen, harga jual, catatan). Baris dataset (satu baris per minggu) dibentuk dari record saat data diunduh.
- **Asal isian**:
  - komoditas, luas, jenis tanah, sumber air, provinsi, pH, NPK: dari Profil atau formulir musim.
  - bulan tanam: dari tanggal mulai musim.
  - durasi: ditetapkan tanaman (cabai 16, tomat 14, bawang 10 minggu).
  - indeks harga pupuk, upah, pestisida: diisi petani (perubahan harga dalam persen; indeks = 100 + persen, jadi 6% menjadi 106); **tidak diisi otomatis dari tebakan**.
  - hujan rata-rata per minggu, minggu hujan lebat (**150 mm atau lebih per minggu**), suhu maksimum rata-rata: otomatis dari data harian Open-Meteo di titik ladang selama musim, atau diisi manual.
- **Kolom turunan** (tidak diisi petani): `minggu_ke`, `posisi_relatif`, `fase`, `minggu_dalam_fase`, `jumlah_minggu_fase`, `bulan_kalender_minggu` (empat minggu per bulan dari bulan mulai), hujan klimatologi per provinsi dan bulan, penanda `ada_pupuk_dasar`, `ada_tanam`, `ada_panen` (mengikuti jadwal fase, bukan kejadian yang dicatat), `porsi_minggu`, dan `sumber` bernilai "nyata". Pembulatan setengah ke genap seperti dataset.
- **Biaya per minggu**:
  - Catatan pengeluaran dijumlah per minggu sejak minggu 1; catatan sebelum musim masuk ke minggu 1 dan sesudah akhir musim masuk ke minggu terakhir.
  - Catatan foto nota dan suara (simulasi) ditandai dan tidak dihitung.
  - Saat tutup panen, biaya mingguan dipakai hanya bila catatan mencakup **90 sampai 110 persen** dari total biaya yang diisi petani; bila tidak, biaya mingguan dikosongkan dan hanya total yang disimpan.
  - Biaya mingguan tidak pernah diperkirakan model; mengisinya dengan perkiraan membuat model belajar dari keluarannya sendiri.
- **Privasi ekspor**: `musim_id` diganti kode acak anonim (huruf R diikuti 8 karakter heksadesimal). Nama, nomor HP, desa, dan koordinat ladang tidak ikut; lokasi hanya provinsi. Petani perlu memberi persetujuan eksplisit sebelum datanya dipakai melatih model.
- **Kriteria selesai**: record terbentuk saat tutup musim; status kualitas benar; CSV unduhan 32 kolom berurutan sama dengan dataset; kolom turunan cocok dengan aturan dataset.
- **Teknologi produksi**: entitas `SeasonRecord` (18 isian dataset, kode anonim, hasil panen, harga jual, penanda kualitas) dan `WeeklyCost` (nilai boleh kosong) lewat Prisma. Dataset latih dibentuk sebagai **view SQL** (menggabungkan SeasonRecord, WeeklyCost, tabel lama fase, tabel hujan klimatologi) agar kolom turunan tidak menyimpang; kolom `sumber` dipertahankan agar data nyata dan sintetis bisa dicampur atau dipisah.
- **Dependensi**: F1 (profil, provinsi, NPK), F5 (terisi saat tutup musim), F7 (biaya mingguan), F6 (cuaca musim); memperkuat F3 dan F8.

#### Status kualitas data

| Status | Arti | Ikut diunduh |
| --- | --- | --- |
| Siap dilatih | Semua 18 isian terisi dan biaya tiap minggu lengkap | Ya, dengan biaya mingguan |
| Siap, total biaya saja | Semua 18 isian terisi, biaya per minggu kosong | Ya; kolom `biaya_minggu_juta` dan `porsi_minggu` kosong |
| Belum lengkap | Ada isian yang belum diketahui; daftar yang kurang ditampilkan dengan tombol Lengkapi data | Tidak |
| Contoh | Data demo dari tombol Lihat contoh | Tidak |

#### Hasil pengujian prototipe

- Enam musim asli dari dataset (dua per tanaman) dimasukkan sebagai record: dari 30 kolom yang dibandingkan, 28 identik pada 2.400 sel. Dua kolom berbeda karena sifat dataset (hujan klimatologi berderau acak di dataset; `porsi_minggu` berbeda paling besar 0,00004).
- Dua belas tampilan aplikasi dirender tanpa galat, di lingkungan simulasi browser, belum di perangkat petani.
- Pengambilan cuaca otomatis diuji dengan data tiruan; panggilan ke server Open-Meteo sungguhan belum diuji dan perlu dicoba dengan koneksi internet sebelum pilot.

---

## 5. P2: Fitur pendukung tambahan

Boleh menyusul setelah P0 dan P1 stabil.

### F10. Pengingat cek lahan mingguan

- Hari dan jam pengingat dapat diatur. Daftar cek mingguan dengan centang, kemajuan, dan rutinitas berturut-turut.
- Notifikasi peramban; peringatan di beranda bila belum selesai.
- Jadwal mengikuti minggu tanam (F5). Teknologi: notifikasi web, entitas `Reminder`.

### F12. Estimasi laba dan harga impas

- Harga impas per kg dan perkiraan untung atau rugi pada harga jual pilihan. Pembanding dengan target laba di profil.
- Skenario harga, **bukan prediksi harga pasar**.
- Memakai total biaya F3 dan F4. Teknologi: hitungan di backend.

### F13. Kondisi tanaman dan foto progres lahan

- **Kondisi tanaman**: foto daun untuk indikasi awal (bercak, keriting, sehat) beserta perkiraan tambahan biaya penanganan; selalu **indikasi awal, bukan diagnosis pasti**, dengan tingkat keyakinan. Di bawah ambang batas, aplikasi meminta foto ulang. Di prototipe deteksi masih simulasi.
- **Foto progres lahan** mingguan dengan lokasi dan waktu, jadi bukti lahan ditanami dan bukti bagi bank. Keabsahan dijaga dengan pemeriksaan **berbasis aturan, bukan AI**:
  - titik GPS di dalam batas lahan;
  - cap waktu cocok dengan minggu musim berjalan;
  - hash SHA-256 untuk menandai berkas diubah;
  - hash sama tidak diterima dua kali.
- Layar "Verifikasi foto lahan" di prototipe masih mensimulasikan pemeriksaan AI, termasuk klaim mendeteksi foto layar; bagian itu diganti dengan pemeriksaan di atas dan klaim tersebut dihapus.
- Foto bukti memperkuat skor di F8.
- Teknologi: CNN transfer learning (MobileNetV2 atau EfficientNet-B0), dilatih di Python, dijalankan di browser lewat TensorFlow.js agar bisa offline; data PlantVillage ditambah foto lapangan sendiri. Foto progres tanpa AI; berkas di penyimpanan objek, metadata di PostgreSQL.

### F14. Asisten tanya jawab

- Pertanyaan cepat: total biaya musim, uang yang dibutuhkan bulan depan, cuaca minggu ini, biaya melenceng, kapan modal habis, kelayakan pinjaman.
- Catat pengeluaran dengan bahasa sehari-hari (misalnya "beli pupuk 2 sak 350 ribu"); tersimpan dengan tanggal dan masuk ke biaya mingguan seperti catatan lain. Hasil simulasi (foto nota dan suara) ditandai dan tidak ikut.
- Gemini menjelaskan dan menyusun kalimat; **nilai rupiah berasal dari model biaya, bukan dikarang model bahasa**.
- Batasan: tidak menjanjikan persetujuan pinjaman atau kepastian hasil panen; topik dibatasi pada pertanian dan pembiayaan; data identitas tidak dikirim ke model.
- Hubungan: membaca hasil F3, F4, F7, F8. Teknologi: Gemini lewat API, dipanggil dari Express.js; kunci API hanya di server (variabel lingkungan). Di prototipe masih simulasi.

---

## 6. Alur dan dependensi

### Alur pengguna utama

1. Daftar atau masuk, isi profil lahan termasuk provinsi dan NPK (F1).
2. Tekan Mulai perhitungan pembiayaan, isi modal (F2).
3. Lihat prediksi rentang dan pola mingguan (F3), lalu rencana dan kalender uang (F4).
4. Bila modal kurang, buka ajuan pinjaman musiman (F8).
5. Tekan Mulai penanaman di hari tanam, hari itu minggu 1 (F5).
6. Selama musim: catat pengeluaran bertanggal (F7), cek cuaca dan tanah (F6), cek lahan mingguan (F10).
7. Saat panen: catat hasil, bukti sampel, tutup musim (F5). Aplikasi membuat record riwayat berformat dataset; petani melengkapi isian yang kurang di Riwayat musim (F11).
8. Dengan persetujuan petani, CSV format dataset dapat diunduh dan dipakai melatih ulang model (F3).

### Tabel dependensi

| Fitur | Bergantung pada | Catatan |
| --- | --- | --- |
| F2 | F1 | Modal dan data lahan dipakai untuk potret awal musim |
| F3 | F1, F2 (diperkaya F6, F7, F11) | Model XGBoost butuh dataset yang sama untuk total dan mingguan; data nyata dari F11 untuk latih ulang |
| F4 | F2, F3 | Kalender uang diturunkan dari pola mingguan prediksi |
| F5 | F1, F2 | Tanggal tanam menentukan minggu berjalan dan tanggal mulai musim |
| F8 | F3, F4, F5, F7 (foto bukti dari F13) | Skor memakai disiplin, catatan, foto, kemampuan bayar |
| F10 | F5 | Pengingat aktif setelah penanaman dimulai |
| F11 | F1, F5, F7 (cuaca dari F6) | Record terbentuk saat panen disimpan; biaya mingguan dari catatan bertanggal |

---

## 7. Komponen teknologi dan AI

| Komponen | Dipakai di | Keputusan dan status |
| --- | --- | --- |
| Prototipe | Semua fitur | Satu file HTML; data di browser; acuan antarmuka dan alur untuk stack produksi |
| Frontend | Semua fitur | Next.js; dapat dibuat PWA agar offline; menjalankan model CNN di browser dengan TensorFlow.js |
| Backend | API, hitungan, skor | Express.js: REST API, perantara ke Gemini dan API cuaca, meneruskan permintaan prediksi ke mesin Python |
| Engine prediksi | F3, F4 | Python dengan XGBoost regresi kuantil (bukan transformer; mudah dijelaskan dengan SHAP); diakses internal oleh Express.js, tidak dibuka ke internet |
| Basis data | Profil, musim, catatan, riwayat | PostgreSQL dengan Prisma; rupiah bertipe Decimal. Entitas: User, Farm, Season, CostPlan, Expense, SeasonRecord, WeeklyCost, Harvest, HarvestSample, Photo, Reminder, LoanApplication, PredictionLog |
| Penyimpanan foto | F5, F8, F13 | Penyimpanan objek (kompatibel S3); PostgreSQL hanya memegang alamat, hash, GPS, waktu |
| Cuaca | F6, F3, F11 | Open-Meteo (prakiraan 7 hari dan data harian historis), BMKG tambahan |
| Kualitas tanah | F6 | pH dan NPK diisi petani, dengan batas wajar dan tanggal ukur |
| Kondisi tanaman | F13 | CNN transfer learning; dataset publik + foto lapangan |
| Foto dokumentasi lahan | F8, F13 | Tanpa AI: GPS, waktu, hash foto |
| Asisten | F14 | Gemini lewat API; simulasi di prototipe |

---

## 8. Urutan pengerjaan dan di luar MVP

| Tahap | Isi | Hasil yang bisa didemokan |
| --- | --- | --- |
| Tahap 1 | F1, F2, F3, F4, F5 | Petani menjalani satu musim penuh: profil, mulai hitung, prediksi dan kalender, tanam, panen; tutup musim membentuk record riwayat |
| Tahap 2 | F6, F7, F8, F9, F11 | Prediksi menyesuaikan cuaca dan tanah; ada catatan, skor kesiapan, ajuan pinjaman, riwayat berformat dataset dengan unduhan CSV |
| Tahap 3 | F10, F12, F13, F14 | Pengingat, laba, foto tanaman, asisten |

### Kaitan dengan peta jalan prototipe v2

| Fase | Kegiatan |
| --- | --- |
| 1. Prototipe (sekarang) | Alur musim tanam, hitungan berbasis aturan, cuaca nyata, riwayat berformat dataset dengan unduhan CSV; bagian AI simulasi |
| 2. Data dan model | Kumpulkan data ongkos usaha tani dan CSV riwayat dari petani pilot; selaraskan definisi fitur dengan generator data sintetis; latih XGBoost dengan validasi per musim dan bandingkan dengan baseline; kumpulkan foto lapangan dan latih CNN |
| 3. Aplikasi produksi | Next.js, Express.js, skema Prisma (termasuk SeasonRecord, WeeklyCost, view dataset latih), mesin Python, perantara Gemini, form pinjaman dengan kode rujukan, halaman verifikasi bank |
| 4. Pilot | Uji dengan kelompok petani dan satu bank; ukur selisih prediksi dengan realisasi; perbaiki model dan alur |

### Di luar MVP (simulasi atau ide lanjutan)

- Klaim asuransi cuaca otomatis (prototipe hanya simulasi saat hujan 150 mm atau lebih).
- Pengiriman pengajuan pinjaman ke bank atau koperasi sungguhan dan skor kredit resmi (prototipe simulasi). Kode rujukan bukan persetujuan.
- Prediksi harga pasar; harga jual hanya skenario.
- Data harga pupuk dari lahan sekitar; angka di prototipe contoh. Di produksi, indeks harga dari sumber resmi daerah dan petani hanya mengoreksi.
- Verifikasi foto otomatis berbasis AI dan rekam suara sungguhan (verifikasi foto MVP berbasis aturan).

---

## 9. Risiko utama dan penanganan

| Risiko | Penanganan |
| --- | --- |
| Data latih sintetis membuat prediksi tampak lebih akurat dari kenyataan | Kumpulkan data biaya nyata sedini mungkin; bandingkan dengan baseline; laporkan metrik data nyata terpisah; jangan klaim akurasi sebelum uji data nyata |
| Definisi "minggu hujan lebat" pada dataset tidak terdokumentasi; aplikasi memakai 150 mm per minggu | Cocokkan dengan generator data; bila berbeda, ubah konstanta atau hitung ulang kolom sintetis |
| Hujan klimatologi dataset berderau acak dan hampir sama antarprovinsi | Perlakukan sebagai fitur musiman saja; ganti dengan klimatologi sebenarnya per wilayah bila tersedia |
| Data nyata di luar rentang dataset (luas sampai 5 ha, indeks harga, suhu) | Tandai prediksi di luar rentang latih atau batasi masukan; tambah data nyata di rentang itu |
| Petani jarang mencatat biaya mingguan secara lengkap | Catatan bertanggal yang mudah (kalimat, suara, nota); musim dengan total biaya saja tetap berguna untuk model total; biaya mingguan tidak diperkirakan |
| Cuaca otomatis untuk riwayat belum diuji pada server nyata | Uji di browser dengan koneksi internet sebelum pilot; sediakan isian manual sebagai cadangan |
| Penanda `ada_tanam`, `ada_pupuk_dasar`, `ada_panen` mengikuti jadwal, bukan kejadian nyata | Catat tanggal kejadian sebenarnya bila ingin dipakai sebagai fitur informatif |
| CNN gagal pada foto lapangan; skor kredit belum teruji | Tambah foto lapangan dan tetapkan ambang keyakinan; skor sebagai ringkasan kesiapan dan divalidasi bersama bank |
| Petani salah paham bahwa kode rujukan sama dengan persetujuan | Tampilkan penjelasan jelas di setiap layar dan di kode |
| Sinyal internet lemah di desa | PWA, model CNN di perangkat, sinkron saat tersambung |
