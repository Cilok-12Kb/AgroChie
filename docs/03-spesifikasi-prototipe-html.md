# AgroChie: Spesifikasi Perilaku Prototipe (`AgroChie.html`)

Dokumen ini adalah **hasil membaca kode** `AgroChie.html` (satu berkas, 1.558 baris, satu blok `<script>`), bukan salinan HTML-nya. Markup, CSS, ikon SVG, dan kode render dihilangkan karena tidak berguna bagi model. Yang dipertahankan: konstanta, rumus, struktur data, aturan validasi, alur, dan teks pesan yang bermakna bisnis.

Kegunaan: acuan **perilaku persis** prototipe saat memindahkan logika ke backend Express.js dan engine Python. Bila dokumen PDF dan kode berbeda, bagian 14 mencatat perbedaannya.

Satuan uang di seluruh kode: **juta Rupiah** (`jt`), kecuali `price` (Rp per kg).

---

## 1. Arsitektur prototipe

- Satu berkas HTML, JavaScript murni, tanpa framework. Data di `localStorage` kunci `agrochie_v1`: `DB = { users: {<hp>: U}, session: <hp> }`.
- Layar utama (`S.view`): `home`, `season`, `reminder`, `pred`, `plan`, `cal`, `field` (sub: `weather`, `soil`, `plant`, `proof`), `chat`, `risk`, `log`, `hist`, `profile`.
- `S` = state kalkulator (tidak disimpan): `crop, ha, rain, ph, modal, price, extra[5], fert, wage, rec, recs, anoms, scan, done, view, sub, leaf, chat`.
- `U` = pengguna aktif: `{ id, name, hash, guest, profile, rem, ss, hist }`.
- `CW` = minggu berjalan (global).
- Fungsi pusat: `calc()` (rencana biaya), `mc()` (Monte Carlo), `riskCalc()`, `labaCalc()`, `histRows()`/`histCSV()`.

### Bentuk data per pengguna

```text
U.profile = { name, hp, desa, kelompok, crop, ha, soil, water, prov, nit, fos, kal,
              ph, tanam, lat, lng, modal, price, target, note }
U.rem     = { on:true, day:1, time:"06:00", checks:{}, streak:0, counted:{}, notified:"" }
U.ss      = { fin, plant, done, exp:[], hv:{ rows:[], sample:{kg,m2}, photos:[], note, cost } }
U.hist[]  = { id, rid, label, start, end, kg, price, note, demo, w:[...]|null, d:{18 isian dataset} }
```

Default profil: `crop:"cabai", ha:0.5, ph:5.4`, sisanya kosong atau 0.

---

## 2. Konstanta data

### Tanaman

| Kunci | Nama | Biaya per ha (jt) | Lama fase (minggu) [persiapan, tanam, rawat, panen] | Durasi | Hasil kg/ha | Harga default Rp/kg |
| --- | --- | --- | --- | --- | --- | --- |
| `cabai` | Cabai merah | 73,7 | 2, 2, 8, 4 | 16 | 10.000 | 12.000 |
| `bawang` | Bawang merah | 52 | 2, 1, 5, 2 | 10 | 11.000 | 25.000 |
| `tomat` | Tomat | 59 | 2, 2, 7, 3 | 14 | 25.000 | 8.000 |

Catatan: kunci tanaman di prototipe = `cabai`, `bawang`, `tomat`. Nilai kolom dataset `komoditas` diisi dari kunci yang sama (huruf kecil).

### Fase, kategori, pilihan

- `shares = [0.19, 0.16, 0.50, 0.15]` (porsi biaya per fase).
- Nama fase: Persiapan lahan; Penanaman; Perawatan; Panen dan pascapanen.
- Kategori (urutan indeks 0 sampai 4): Benih dan bibit; Pupuk; Obat hama dan penyakit; Tenaga kerja; Lain-lain.
- `catFrac = [.183, .309, .114, .263, .131]` (porsi kategori, jumlah = 1,000).
- `catFac = [1, 1.09, 1.30, 1.04, .96]` (faktor "aktual dibanding rencana" untuk data demo).
- Jenis tanah: Lempung, Lempung berpasir, Liat, Pasir, Tanah vulkanik (andosol).
- Sumber air: Tadah hujan, Sumur atau pompa, Irigasi teknis, Embung atau sungai.
- Provinsi: Jawa Barat, Jawa Tengah, Jawa Timur, Sulawesi Selatan, Sumatera Utara.
- Tingkat hara (`LVL`): rendah, sedang, tinggi.
- Hari pengingat: 1 = Senin sampai 7 = Minggu.

### Default kalkulator

`rain=92` mm, `ph=5.4`, `fert=6` (% kenaikan harga pupuk), `wage=0` (% kenaikan upah), `ha=0.5`, `modal=25`, `price=12000`, `CW=6`.
Preset skenario (`[hujan mm, fert %, wage %]`): `normal=[92,6,0]`, `basah=[190,6,0]`, `mahal=[92,25,10]`.
Pada `resetLahan()`: `price = harga default tanaman`, `modal = round(total*0.65*2)/2` (kelipatan 0,5 jt), lalu ditimpa `profile.modal` / `profile.price` bila > 0.

---

## 3. Rencana biaya: `calc()`

Dengan `sc = ha / 0.5`:

```text
rainX   = max(0, rain - 60) * 0.028 * sc            # tambahan fungisida (jt); 0 bila hujan <= 60 mm
kapur_kg= max(0, 6 - ph) * 800 * ha                 # kg kapur dolomit
kapur   = kapur_kg * 1500 / 1e6                     # Rp 1.500 per kg -> jt
fosfor  = 0.3 * sc                                  # pupuk fosfor (jt), SELALU ditambahkan (lihat bagian 14)
base    = perHa * ha * (1 + catFrac[1]*fert/100 + catFrac[3]*wage/100)
total   = base + rainX + kapur + fosfor
```

Pembagian ke minggu: untuk fase `p` (0..3) dengan `n` minggu, bobot minggu ke-`i` (0-basis) `w_i = 1 + 0.35 * sin((i+1)*2.1 + p)`; biaya minggu = `total*shares[p] * w_i / sum(w)`. Hasil: `weeks[]` (panjang = durasi), `cum[]` (kumulatif), `phaseTot[]`.

Turunan:

- `peaks` = minggu (1-basis) dengan `weeks[i] >= rata-rata * 1.3`.
- `runOut(d)` = indeks pertama `cum[i] > modal` (minggu modal habis = indeks + 1; `-1` bila cukup).
- Rencana per kategori sampai minggu berjalan: `plan_i = cum[CW-1] * catFrac[i]`; aktual: `act_i = plan_i * catFac[i] + extra[i]`, dengan `extra[i]` = jumlah catatan pengeluaran kategori i.
- Fase saat ini (`phaseNow`): fase pertama yang kumulatif minggunya >= `CW`.

Minggu berjalan dari profil: `CW = clamp(floor((hari_ini - tanam)/7 hari) + 1, 1, durasi - 1)`; bila `tanam` kosong, `CW = 6`.

---

## 4. Prediksi rentang: `mc()` (Monte Carlo 500 kali)

- PRNG deterministik mulberry32, seed 7. `g() = (r+r+r+r - 2) * 1.73` (aproksimasi normal).
- Ketidakpastian dasar `u = max(0.05, 0.15 - 0.01 * recs)` (rentang menyempit saat jumlah catatan `recs` bertambah; `recs` awal 6, naik 1 per catatan).
- Tiap iterasi:

```text
rain = rainX * 0.5 * g()
pest = (r() < 0.3) ? 0.4 * sc * (1 + 0.3*g()) : 0     # serangan hama, peluang 30%
pr   = total * catFrac[1] * 0.04 * g()                # fluktuasi harga pupuk
out  = total + rain + pest + pr + total * u * 0.5 * g()
```

- Urutkan 500 hasil; `p10, p50, p90 = out[floor(p*(n-1))]`; `pOver` = proporsi hasil > modal.
- Kipas grafik: kumulatif dikalikan `p10/total`, `p50/total`, `p90/total`.

Rekomendasi hemat (`recs`), nilai dalam jt:

| Teks | Potensi hemat |
| --- | --- |
| Beli pupuk kolektif bersama 23 petani sekitar | `total*catFrac[1]*0.08` |
| Majukan semprot fungisida sebelum hujan turun | `max(0.1*sc, rainX*0.5)` |
| Kapur dulu, baru pupuk susulan, agar pupuk tidak terbuang | `ph<5.5 ? total*catFrac[1]*0.06 : 0.05*sc` |
| Gotong royong tanam dan panen dengan kelompok tani | `total*catFrac[3]*0.06` |

(Angka "23 petani" dan potensi hemat adalah contoh/ilustrasi di prototipe.)

---

## 5. Risiko, skor kredit, laba

### `riskCalc()`

```text
f      = 1 - (rain > 120 ? 0.08 : 0) - (ph < 5.5 ? 0.06 : 0)     # faktor hasil
kg     = yield_per_ha * ha * f
lo, hi = kg * 0.85, kg * 1.08                                    # panen terburuk, terbaik
revLo, revHi = lo*price/1e6, hi*price/1e6
gap    = max(0, total - modal)
ratio_i= act_i / plan_i ; dev = rata-rata |ratio_i - 1|
cover  = gap ? (revLo - (total - gap)) / (gap * 1.1) : null      # rasio penutupan pinjaman
disc   = round(max(0, 100 - dev*250))                            # disiplin biaya
lg     = min(100, recs * 9)                                      # kelengkapan catatan
ph_sc  = scan ? 95 : 80                                          # verifikasi foto (scan=1 setelah verifikasi)
pay    = gap ? round(clamp(cover*50, 0, 100)) : 100              # kemampuan membayar
score  = round(300 + 550 * (disc*.35 + lg*.20 + ph_sc*.15 + pay*.30) / 100)
label  = score >= 720 ? "sangat layak" : score >= 600 ? "layak" : "perlu diperbaiki"
```

Anomali biaya: kategori dengan `act/plan > 1.15` ditulis "`<kategori>` N% di atas rencana (X dari Y)", ditambah `S.anoms`.

### `labaCalc()`

```text
kg   = (lo + hi) / 2
lo_  = revLo - total ; hi_ = revHi - total ; mid = (lo_ + hi_) / 2
perBln = mid / (durasi / 4.345)
be     = total * 1e6 / kg          # harga impas Rp per kg
roi    = mid / total * 100
```

Pesan laba: jika `lo_ > 0` "bahkan skenario terburuk masih untung ..."; jika `hi_ > 0` "jual di atas `be` per kg dan Anda untung"; selain itu "hasil panen belum menutup biaya".

---

## 6. Akun dan profil

### Auth (hanya prototipe)

- Pengenal akun = nomor HP (hanya angka, minimal 8 digit). Kata sandi minimal 6 karakter. Daftar butuh nama.
- Hash prototipe: SHA-256 dari `"pk:" + sandi` (ini hanya untuk prototipe; produksi argon2 atau bcrypt).
- Pesan: "Isi nama Anda." / "Nomor HP minimal 8 angka." / "Kata sandi minimal 6 karakter." / "Nomor ini sudah terdaftar. Silakan masuk." / "Nomor HP atau kata sandi salah." (satu pesan untuk HP tak ada dan sandi salah).
- Mode tamu: `U = {id:"tamu", guest:1}` tidak disimpan (`persist()` tidak menulis untuk tamu).
- Setelah daftar: langsung ke layar Profil. Setelah masuk ulang tanpa perhitungan aktif: modal "Mulai perhitungan pembiayaan" otomatis terbuka.

### Profil

Isian: nama, nomor HP, desa dan kecamatan, kelompok tani, tanaman, luas (0,1 sampai 5, langkah 0,1), jenis tanah, sumber air, provinsi, nitrogen, fosfor, kalium, tanggal tanam, pH (slider 4,5 sampai 7,5 langkah 0,1), latitude, longitude, modal, harga jual, target laba, catatan lahan.

- Batas simpan: luas dibatasi 0,1 sampai 5; modal dan target maksimal 10.000; harga maksimal 500.000.
- Validasi koordinat: dua-duanya angka (koma desimal dan tanda minus unicode diterima); tolak bila `|lat|>90` dan `|lng|<=90` (kemungkinan tertukar, pesan khusus); tolak bila `|lat|>90` atau `|lng|>180`; disimpan 6 desimal.
- Menempel "lat,lng" ke kolom latitude memecah otomatis ke dua kolom. Tombol: lokasi HP (`geolocation`), cek titik di Google Maps (`https://www.google.com/maps?q=<lat>,<lng>`).
- **Kelengkapan profil (persen)** = jumlah terisi dari 10 butir dibagi 10: `name, hp, desa, soil, water, tanam, lokasi valid, modal>0, price>0, target>0`. (Provinsi, NPK, dan pH tidak dihitung di prototipe.)
- Ubah tanaman atau luas mereset kalkulator (`resetLahan`); ubah lainnya hanya menerapkan profil.

---

## 7. Cuaca (F6)

- **Prakiraan**: `GET https://api.open-meteo.com/v1/forecast?latitude=<4 desimal>&longitude=<4 desimal>&daily=precipitation_sum,precipitation_probability_max,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=7`.
- Cache 30 menit per koordinat. Total hujan 7 hari `sum` menjadi `S.rain = min(250, round(sum))`. Tanpa lokasi, `S.rain` kembali 92.
- Status: `idle`, `load`, `ok`, `err`. Bila gagal, tampilan memakai pola hujan contoh `[4,8,26,32,14,6,2]/92`.
- Slider hujan 0 sampai 250 mm/minggu; dampak = `rainX` (bagian 3). Ambang: hujan >= 60 mm dianggap "tinggi" (saran semprot fungisida); >= 150 mm "batas asuransi cuaca" (simulasi, di luar MVP).
- **Tanah**: slider pH 4,5 sampai 7,5. Status: `<5,5` asam; `<6` agak asam; `<=7` ideal; selain itu basa ringan. Dampak biaya = `kapur + fosfor` (bagian 3), masuk ke biaya persiapan lahan. Batang N, P, K di layar ini **nilai contoh tetap** (sedang, rendah, sedang), bukan dari profil.
- Sebelum perhitungan dimulai (`!hasFin()`), layar cuaca dan tanah menyembunyikan semua angka Rp dan menampilkan tombol "Mulai perhitungan pembiayaan".

---

## 8. Alur musim (F2 dan F5)

### Langkah 1: Mulai pembiayaan (`openFin`, `confirmFin`, `startFin`, `stopFin`)

- Modal (popup): "Modal yang Anda miliki (juta Rp, boleh kosong)". Tombol Mulai / Batal. Mulai dengan modal > 0 menyimpan ke `profile.modal`.
- Potret awal `U.ss.fin = { date: hari_ini, total, modal, gap: max(0,total-modal), be: total*1e6/((lo+hi)/2), crop, ha, price }`. (Prototipe belum menyimpan P10/P50/P90; produksi `CostPlan` menambahkannya.)
- `stopFin()` mengosongkan `fin`. `hasFin()` = `fin` ada; semua layar uang memakai `gateView()` bila belum: judul "Perhitungan pembiayaan belum dimulai", tombol "Mulai perhitungan pembiayaan"; Profil dan Pengingat tetap terbuka.

### Langkah 2: Mulai penanaman (`startPlant`)

- Tanggal tanam (default hari ini) disimpan ke `ss.plant` dan `profile.tanam`; `CW` dihitung ulang. Toast "Penanaman dimulai. Sekarang minggu ke-N".
- Perkiraan tanggal panen = tanggal tanam + durasi tanaman * 7 hari.

### Langkah 3: Panen (`addHv`, `addPhotos`, `finishHv`)

- Entri panen: `{ id, date (default hari ini), grade, kg, price, buyer }`. Wajib `kg > 0` ("Isi berat panen (kg)") dan `price > 0` ("Isi harga jual per kg").
- Foto sampel: maksimal 6, diperkecil sisi terpanjang 720 px, JPEG kualitas 0,6, disimpan sebagai data URL dengan `{ src, t: ISO waktu, ll: [lat,lng] | null }` (GPS dari `geolocation`, batas waktu 8 detik).
- **Validasi tutup musim (`finishHv`)**, urutan dan pesan persis:
  1. `rows` kosong: "Tambahkan minimal satu hasil panen"
  2. berat atau luas sampel <= 0: "Isi berat dan luas petak sampel panen"
  3. tanpa foto: "Tambahkan minimal satu foto bukti sampel panen"
  4. total biaya <= 0: "Isi total biaya musim"
- Estimasi dari sampel: `est = sample.kg / sample.m2 * 10000 * ha` (kg). Selisih `df = (total_kg_tercatat / est - 1) * 100`; dianggap selaras bila `|df| <= 30`, selain itu pesan "Selisih besar, periksa lagi timbangan atau catatan." Kartu hasil menampilkan Untung atau Rugi = `rev - cost`, total panen, pendapatan, total biaya, jumlah foto sampel.
- Hasil: `done = { date, kg, rev (jt), cost, ha, est }`.
- **Biaya mingguan**: `ew = expWeeks(ss.plant, crop)`; dipakai bila `ss.plant` ada, `ew.count > 0`, dan `|ew.total / cost - 1| <= 0.1` (yaitu 90 sampai 110%). Bila dipakai, `cost = round(ew.total, 2)` dan `w = ew.w`; bila tidak, `w = null`.
- **Record riwayat** yang dibuat:

```text
{ id, rid: "R"+8 hex acak huruf besar, label: "<Nama tanaman> <tanggal panen terakhir>",
  start: ss.plant, end: tanggal panen terakhir, kg: total kg, price: round(rev/kg),
  note, w, d: { komoditas, luas_ha, jenis_tanah, sumber_air, provinsi, bulan_tanam,
                ph, fosfor, nitrogen, kalium, durasi_musim, biaya_total_juta } }
```

  Isian lain di `d` (indeks harga, hujan, minggu hujan lebat, suhu) dibiarkan `null`.
- Bila lokasi ladang valid dan `start` ada, cuaca musim diambil di latar belakang (`pullWeather`, bagian 10) dan mengisi `hujan_mm_rata_per_minggu`, `minggu_hujan_lebat`, `suhu_maks_rata`; gagal = dibiarkan kosong.
- Toast: bila ada isian kurang "Panen tersimpan. Lengkapi data model di menu Riwayat musim", jika tidak "Panen tersimpan dan masuk riwayat musim".
- `newSeason()` mengosongkan `U.ss` dan `profile.tanam`.

---

## 9. Catatan pengeluaran (F7) dan asisten (F14)

### Catatan

- Entri `{ id, date (YYYY-MM-DD, default hari ini, boleh mundur), kat (0..4), jt, sim (0|1) }`; `logExp` menambahkan ke `ss.exp`. Catatan baru menaikkan `S.extra[kat]` dan `S.recs` (mempersempit rentang MC).
- `expWeeks(start, crop)`: abaikan `sim = 1`; indeks minggu = `floor((tanggal - start) / 7 hari)` dijepit ke `[0, durasi-1]` (sebelum musim ke minggu 1, sesudah akhir ke minggu terakhir); jumlah per minggu dibulatkan `r_(x, 3)`; kembalikan `{ w[], total, count }`.

### Asisten (simulasi; nanti Gemini)

Pertanyaan cepat: `pred` (total biaya musim), `need` (uang 4 minggu ke depan: jumlahkan `weeks[CW..CW+3]`, minggu puncak), `weather`, `over` (kategori paling melenceng), `run` (kapan modal habis), `log1` ("Tadi beli pupuk 2 sak 350 ribu"), `risk`, dan satu contoh di luar cakupan ("Sesuk udan ora?") yang dijawab "Maaf, saya belum bisa menjawab itu di versi demo."

Parser kalimat catatan (`logNL`):

- Cari angka + satuan `ribu|rb|juta|jt` (regex `(\d+(?:[.,]\d+)?)\s*(ribu|rb|juta|jt)\b`, ambil kecocokan **terakhir**); ribu = x 0,001 jt, juta = x 1 jt. Tanpa jumlah: "Berapa jumlahnya? Contoh: tadi beli pupuk 2 sak 350 ribu."
- Kategori dari kata kunci: `benih|bibit` -> 0; `pupuk|urea|npk|sak` -> 1; `obat|fungisida|pestisida|insektisida` -> 2; `upah|buruh|tenaga|tanam|panen` -> 3; selain itu 4.
- Catatan dari foto nota dan suara memakai `sim = 1` (ditandai dan tidak dihitung ke biaya mingguan atau data latih).
- Angka rupiah di jawaban asisten selalu dari `calc()`/`mc()` (mesin biaya), bukan dikarang.

---

## 10. Riwayat musim (F11)

### Urutan 32 kolom CSV (`HIST_COLS`) — **urutan ini wajib dipertahankan**

```text
musim_id, komoditas, luas_ha, jenis_tanah, sumber_air, provinsi, bulan_tanam,
hujan_mm_rata_per_minggu, minggu_hujan_lebat, suhu_maks_rata, ph, fosfor, nitrogen, kalium,
indeks_harga_pupuk, indeks_upah, indeks_harga_pestisida, minggu_ke, durasi_musim,
posisi_relatif, fase, minggu_dalam_fase, jumlah_minggu_fase, bulan_kalender_minggu,
hujan_mm_minggu_klimatologi, ada_tanam, ada_pupuk_dasar, ada_panen,
biaya_total_juta, biaya_minggu_juta, porsi_minggu, sumber
```

Perhatikan: **`fosfor` datang sebelum `nitrogen`** (bukan urutan N-P-K).

### 18 isian tingkat-musim yang harus terisi (`HIST_FEAT`)

`komoditas, luas_ha, jenis_tanah, sumber_air, provinsi, bulan_tanam, hujan_mm_rata_per_minggu, minggu_hujan_lebat, suhu_maks_rata, ph, fosfor, nitrogen, kalium, indeks_harga_pupuk, indeks_upah, indeks_harga_pestisida, durasi_musim, biaya_total_juta`.

Nilai dianggap terisi bila bukan `null`, `undefined`, `""`, atau angka tak hingga (`nn()`).

### Status kualitas (`histState`)

1. `h.demo` -> `demo` (Contoh)
2. ada isian kurang -> `kurang` (Belum lengkap)
3. `w` ada, panjangnya = `durasi_musim`, semua terisi -> `lengkap` (Siap dilatih)
4. selain itu -> `total` (Siap, total biaya saja)

### Membentuk baris dataset (`histRows`), untuk `w = 1..durasi`

```text
fase, minggu_dalam_fase(mdf), jumlah_minggu_fase(jmf) = dari lama fase tanaman (phaseOf)
bulan_kalender_minggu = ((bulan_tanam - 1 + floor((w-1)/4)) mod 12) + 1
hujan_mm_minggu_klimatologi = CLIM[provinsi][bulan_kalender_minggu - 1]
posisi_relatif = r_(w / durasi, 3)
ada_tanam       = (fase == 2 && mdf == 1) ? 1 : 0
ada_pupuk_dasar = (fase == 1 && mdf == jmf) ? 1 : 0
ada_panen       = (fase == 4) ? 1 : 0
biaya_total_juta = r_(total, 2)
biaya_minggu_juta = w[w-1] bila ada, kosong bila tidak   # r_(., 3)
porsi_minggu      = biaya_minggu / total                  # r_(., 5), kosong bila biaya minggu kosong
sumber = "nyata"
musim_id = h.rid
```

- `r_(x, n)` = pembulatan **setengah ke genap** ke `n` desimal (mis. 0,0625 -> 0,062).
- CSV: pemisah koma, sel yang berisi koma, kutip, atau baris baru diberi tanda kutip dengan kutip digandakan; baris akhir diakhiri `\n`; nama berkas `agrochie_riwayat_<YYYY-MM-DD>.csv`.
- Ekspor hanya record **bukan demo dan tanpa isian kurang**. Jika tidak ada: "Belum ada musim yang lengkap. Lengkapi dulu isian yang kurang."
- Nama, HP, desa, koordinat tidak termasuk; `musim_id` = `rid` acak.

### Tabel klimatologi (`CLIM`, mm per minggu, bulan 1 sampai 12)

| Provinsi | Jan | Feb | Mar | Apr | Mei | Jun | Jul | Agu | Sep | Okt | Nov | Des |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Jawa Barat | 130 | 123 | 102 | 75 | 48 | 28 | 20 | 27 | 48 | 75 | 103 | 123 |
| Jawa Tengah | 130 | 123 | 102 | 75 | 47 | 28 | 20 | 27 | 48 | 75 | 102 | 123 |
| Jawa Timur | 130 | 123 | 102 | 75 | 47 | 27 | 20 | 27 | 47 | 75 | 103 | 123 |
| Sulawesi Selatan | 130 | 123 | 102 | 75 | 48 | 27 | 20 | 27 | 47 | 75 | 102 | 123 |
| Sumatera Utara | 130 | 123 | 102 | 75 | 48 | 28 | 20 | 27 | 48 | 75 | 103 | 123 |

`HUJAN_LEBAT_MM = 150` (ambang minggu hujan lebat, mm per minggu; "samakan dengan definisi saat dataset dibuat").

### Migrasi record lama (`normHist`)

Record format lama `{ crop, ha, cost, start, end, kg, price, note }` diubah menjadi `d` baru: `komoditas`, `luas_ha`, `biaya_total_juta`, `durasi_musim` dari tanaman, `bulan_tanam` dari bulan `start`; semua isian lain `null` (tidak ditebak); `w = null`; `rid` baru dibuat.

### Statistik per record (`hc`)

`rev = kg*price/1e6`, `profit = rev - biaya_total_juta`, `costHa = biaya_total_juta/luas_ha`, `kgHa = kg/luas_ha`.

### Cuaca musim otomatis (`pullWeather`)

- Syarat: lokasi valid dan tanggal mulai ada.
- `end = min(tanggal_mulai + durasi*7 - 1 hari, hari_ini - 6 hari)`; bila `end < start` kembalikan `null`.
- `GET https://archive-api.open-meteo.com/v1/archive?latitude=<4 desimal>&longitude=<4 desimal>&start_date=<start>&end_date=<end>&daily=precipitation_sum,temperature_2m_max&timezone=auto`.
- Hanya minggu penuh (`floor(jumlah_hari/7)`, minimal 1). Hujan per minggu = jumlah 7 hari. `hujan_mm_rata_per_minggu = r_(rata-rata per minggu, 1)`, `minggu_hujan_lebat` = jumlah minggu dengan hujan >= 150, `suhu_maks_rata = r_(rata-rata suhu maks, 1)`. `full = minggu_terhitung >= durasi`.
- Bila musim belum selesai: tampilkan "angka ini baru dari N minggu pertama. Perbarui setelah musim selesai."
- **Status uji**: baru diuji dengan data tiruan, belum ke server Open-Meteo sungguhan. Selalu sediakan isian manual.

### Data contoh

`loadDemoHist()` menambah record `demo` yang dapat dihapus (`clearDemoHist()`); tidak pernah ikut ekspor.

---

## 11. Pengingat cek lahan (F10)

- Default: aktif, hari Senin, pukul 06:00. Centang disimpan per minggu musim: kunci `"<CW>-<indeks butir>"`.
- Lima butir mingguan; butir pertama bergantung fase:
  - Fase 1: "Cek pupuk dasar dan perbaiki saluran air"
  - Fase 2: "Cek bibit yang mati dan sulam yang kosong"
  - Fase 3: "Cek jadwal pupuk susulan, semprot sebelum hujan"
  - Fase 4: "Cek kematangan buah dan hubungi calon pembeli"
  - lalu selalu: "Periksa daun atas dan bawah: bercak, keriting, kutu"; "Cek kelembapan tanah dan saluran air"; "Cabut gulma dan periksa tanaman rebah"; "Foto lahan agar lokasi dan waktunya tercatat".
- Jadwal pengingat berikutnya = hari dan jam terpilih terdekat setelah sekarang. Notifikasi lewat Notification API peramban. Rutinitas (`streak`): bila kelima butir minggu itu dicentang semua, `streak` naik 1 (sekali per minggu, dicatat di `counted[minggu]`) dengan toast "Cek lahan minggu ini selesai. Rutin N minggu"; bila ada centang dilepas sesudahnya, `streak` turun 1 (minimum 0).

---

## 12. Pengajuan pinjaman (F8, simulasi)

`openLoan()` menampilkan ringkasan: jumlah = kekurangan modal (`max(0, total - modal)`), dibutuhkan mulai minggu ke-(`runOut+1`), pencairan bertahap sesuai kalender, pelunasan dari hasil panen, dilampirkan rencana biaya + catatan + foto lahan. Tombol "Kirim pengajuan" hanya menampilkan toast "Pengajuan terkirim (simulasi)". **Belum ada kode rujukan, QR, atau halaman bank** (rencana: bagian 13 dokumen prototipe).

---

## 13. Bagian simulasi (jangan dianggap fitur nyata)

- **Deteksi daun** (menu Cuaca dan lahan, sub `plant`): ilustrasi SVG dan hasil contoh tetap; belum ada CNN.
- **Verifikasi foto lahan** (sub `proof`): menampilkan empat langkah buatan dengan jeda waktu (tanaman terdeteksi, tahap tumbuh, lokasi GPS "di dalam batas lahan", "foto asli, bukan foto layar") lalu menetapkan `S.scan = 1` (menaikkan skor foto 80 menjadi 95). **Klaim AI dan deteksi foto layar harus dihapus** dan diganti pemeriksaan GPS, cap waktu, hash SHA-256, dan penolakan hash ganda.
- **Foto nota dan suara** (menu Catatan/Asisten): tombol simulasi yang menambah catatan berpenanda `sim`.
- **Asuransi cuaca**: pada hujan >= 150 mm tampil "klaim sekitar Rp 4,0 jt dikirim otomatis" (hanya ilustrasi, di luar MVP).
- **Unggah hasil uji tanah**: toast simulasi.

---

## 14. Catatan implementasi: perbedaan dan keanehan yang ditemukan di kode

1. **Fosfor selalu ditambahkan.** Di `calc()`, `fosfor = 0.3 * sc` tanpa syarat. Dokumen menulis "pupuk fosfor bila pH di bawah 6". Putuskan salah satu saat memindahkan ke backend: (a) ikuti dokumen (kondisi pH < 6), atau (b) bersyarat pada kadar fosfor profil `rendah`. Prototipe tidak membaca `profile.fos`.
2. **Batang N, P, K di layar tanah** adalah angka contoh tetap, bukan dari profil. Di produksi harus dari `profile.nit/fos/kal`.
3. **Kelengkapan profil** di prototipe tidak menghitung provinsi, NPK, dan pH; dokumen F1 tidak merinci daftar butirnya. Sepakati daftar final.
4. **Potret awal `fin`** hanya menyimpan total tunggal; dokumen produksi (`CostPlan`) menambah P10/P50/P90 dan versi model.
5. **Hash sandi SHA-256 tanpa garam** hanya untuk prototipe; produksi wajib argon2 atau bcrypt.
6. **Monte Carlo** memakai seed tetap (7) agar hasil stabil; ini baseline aturan, bukan model produksi. Setelah XGBoost terpasang, hitungan ini tetap menjadi baseline pembanding.
7. **Tabel `CLIM`** di HTML berbeda ±1 mm antar provinsi pada beberapa bulan. Tutorial database (revisi 10 Oktober 2026) memakai **satu rumus untuk semua provinsi** (130, 123, 102, 75, 48, 27, 20, 27, 47, 75, 102, 123) agar sama dengan model yang sudah dilatih. Untuk backend, ikuti tutorial, bukan tabel HTML.
8. **Ambang hujan**: 60 mm (tambahan fungisida), 120 mm (faktor hasil panen riskCalc), 150 mm (minggu hujan lebat dan batas asuransi simulasi). Jangan dicampur.
9. **Luas lahan**: profil 0,1 sampai 5 ha; dataset latih 0,1 sampai 3,0 ha. Tandai prediksi bila luas > 3,0 ha.
10. **Ekspor CSV di prototipe tidak meminta persetujuan eksplisit**; dokumen mewajibkannya sebelum data dipakai melatih model. Di produksi, simpan persetujuan per petani.
11. **Pesan "Terverifikasi"** pada foto dan angka "23 petani sekitar" dalam rekomendasi adalah teks demo, bukan data nyata.
