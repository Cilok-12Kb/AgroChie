# BAGIAN 18: Musim dan catatan (F2, F5, F7): keputusan dan sub-langkah

Branch kerja: `feat/bagian-18-musim` (dibuat oleh pemilik proyek; jangan berpindah branch).

## 1. Keputusan yang disetujui

1. **Q1.** Branch `feat/bagian-18-musim` sudah dibuat pemilik. Tidak ada perpindahan branch.
2. **Q2.** Satu musim terbuka per lahan (status bukan `SELESAI`), ditegakkan di service dalam transaksi. Tanpa indeks parsial; `CREATE UNIQUE INDEX` dihapus dari migrasi.
3. **Q3.** Cuaca (`weather`) dan tiga indeks harga (`indices`) datang dari body. Tidak ditebak, tidak diberi nilai bawaan.
4. **Q4.** Hook perubahan luas di Farm hanya menandai `CostPlan.needsRecalc`. Season sumber tunggal; luas Season diubah lewat `PATCH /api/seasons/:id`.
5. **Q5.** Gerbang uang di API. Saat status `DRAFT`, hanya angka hasil prediksi (`CostPlan`: total, p10/p50/p90, kekurangan, mingguan, dan turunannya) yang disembunyikan. Modal, harga jual, dan target di Season tetap tampil karena milik petani sendiri.
6. **Q6.** `catFrac = [0.183, 0.309, 0.114, 0.263, 0.131]` dari docs/03 menjadi konstanta backend. Pemetaan enum: BENIH=0, PUPUK=1, OBAT=2, TENAGA_KERJA=3, LAIN=4. Rencana per kategori sampai minggu berjalan = kumulatif rencana mingguan x catFrac.
7. **Q7.** Foto sampel: metadata saja (tanpa penyimpanan objek). Penyimpanan objek ditunda ke bagian 21. `Photo.sha256` tetap unik global.
8. **Q8.** Riwayat `CostPlan` dipertahankan saat perhitungan dihentikan (tidak ada DELETE).
9. **Q9.** Tanaman boleh diganti sampai status `PEMBIAYAAN` (dengan `needsRecalc = true`); ditolak (409) setelah `TANAM`.
10. **Q10.** `breakEvenPerKg` tetap `null` sampai bagian 20.

Titipan bagian 17 yang harus masuk: salin default Farm ke Season (sub-langkah 3), hook perubahan tanaman (sub-langkah 4), rapikan `POST /farms` (sub-langkah 1).

Tambahan: **periksa D1 sejak sub-langkah 2** dan laporkan hasilnya. D1 = `season.routes.js` memasang `season.close`, tetapi `season.controller.js` hanya mengekspor `predict` dan `start`. Periksa apakah server gagal dimuat atau rute hanya gagal saat dipanggil. Perbaikan controller `close` tetap di sub-langkah 10.

## 2. Perbedaan spesifikasi dan kode yang ada

- D1: rute `/:id/close` tanpa controller `close` (lihat di atas).
- D2: belum ada endpoint buat/baca/ubah Season, tanam, hentikan, hitung ulang, Expense, Harvest, sampel.
- D3: `Farm` tidak punya kolom tanaman; tanaman di `Season.crop`. Hook tanaman ada di PATCH Season.
- D4: `toEngineInput` memakai `season.areaHa`; itu sebabnya Q4 menjadikan Season sumber tunggal.
- D5: `startFinancing` mewajibkan `capitalJt` angka, tidak menyalin default Farm, tidak menyimpan masukan engine.
- D6: engine butuh 16 isian; cuaca dan indeks dari body (Q3), F6 belum ada.
- D7: `closeSeason` tidak memeriksa status, memakai `findFirstOrThrow` (P2025), tutup dua kali memicu unique, tidak mengisi `yieldKg`/`pricePerKg`/`label`, dan tidak memakai Harvest.
- D8: `weeklyFromExpenses` memakai `Number`; diganti `Prisma.Decimal` (aturan 90-110 persen dan penjepit minggu dipertahankan).
- D9: `POST /farms` memakai `validateFarm` lama (membuang kunci tak dikenal, tanpa pasangan pH/koordinat, tanpa kolom modal/harga/target, respons tanpa turunan).
- D10: `Photo.sha256` unik global; tanpa penyimpanan objek (Q7).
- D11: konstanta kategori `catFrac` belum ada di backend (Q6).
- D12: docs/03 bagian 14 butir 1-2 (fosfor, NPK contoh) tidak relevan; hitungan biaya oleh engine.
- D13: sandi minimal 6 dan kelengkapan 10 butir di docs/03 sudah diganti keputusan bagian 17 (8 dan 12 butir).

## 3. Perubahan skema

Migrasi `season_flow` (nama bertanda waktu dibuat saat dijalankan). Hanya menambah kolom; migrasi lama tidak diubah. SQL ditunjukkan dulu sebelum diterapkan; tes memakai database `agrochie_test`.

```sql
-- AlterTable: masukan prediksi disimpan agar "hitung ulang" tidak menebak ulang
ALTER TABLE "cost_plans" ADD COLUMN "input" JSONB;

-- AlterTable: kapan perhitungan dihentikan
ALTER TABLE "seasons" ADD COLUMN "financingStoppedAt" TIMESTAMP(3);
```

Di `schema.prisma`: `CostPlan.input Json?` dan `Season.financingStoppedAt DateTime?`, dengan komentar `[REVISI]`. Setelah itu jalankan `prisma generate`.

## 4. Sub-langkah

Satu sub-langkah = bisa diuji dan di-commit sendiri. Kerjakan satu per task, jalankan tes, tampilkan `git diff --stat`, lalu berhenti.

- [x] **1. Rapikan `POST /farms`.** `farmCreateSchema` zod memakai ulang skema PATCH (`areaHa` wajib, `strictObject`, pasangan pH/tanggal ukur dan koordinat, kolom modal/harga/target). Respons 201 memuat `kelengkapan` dan `rentang_latih`. `validateFarm` lama tidak dihapus tetapi tidak dipakai rute. Tes: kunci tak dikenal 400, luas di luar 0,1-5 ditolak, koordinat tertukar ditolak, respons berisi turunan.
- [ ] **2. Migrasi `season_flow` dan util.** Dua kolom di atas, `prisma generate`. Util konstanta (`CROP_DURATION`, `catFrac`, pemetaan enum) dan fungsi murni `currentWeek` (dijepit 1..durasi-1) serta `harvestEstimate` (tanam + durasi x 7 hari). Periksa dan laporkan D1. Tes: fungsi murni.
- [ ] **3. Buat dan baca musim.** `POST /api/farms/:farmId/seasons` (body: `crop`), `GET /api/farms/:farmId/seasons`, `GET /api/seasons/:id`. Salin default Farm ke Season satu kali (`areaHa`, `capitalJt`, `sellPricePerKg`, `profitTargetJt`; null tetap null). Satu musim terbuka per lahan dicek di service dalam transaksi (409). Kepemilikan lewat `farm: { userId }` (404). Tes: salinan benar dan tidak berubah setelah Farm diedit, musim kedua 409, milik orang lain 404.
- [ ] **4. Ubah musim dan hook tanaman.** `PATCH /api/seasons/:id` untuk `crop`, `areaHa`, `capitalJt`, `sellPricePerKg`, `profitTargetJt`. Ditolak bila `SELESAI`; `crop` ditolak (409) setelah `TANAM`. Bila `crop` atau `areaHa` benar-benar berubah, `CostPlan` terbaru ditandai `needsRecalc = true` dalam transaksi yang sama. Kolom lain tidak memicu hook. Tes: hook menyala, tidak menyala bila nilai sama, 409 setelah TANAM, 404 milik orang lain.
- [ ] **5. Revisi mulai pembiayaan dan hentikan (F2).** `start-financing`: `capitalJt` opsional (default dari Season, boleh kosong); simpan `CostPlan.input`; `breakEvenPerKg` tetap null. Tambah `POST /api/seasons/:id/stop-financing` (status kembali `DRAFT`, isi `financingStoppedAt`, riwayat `CostPlan` dipertahankan). Tes: modal kosong diterima, mulai dua kali 409, hentikan lalu DRAFT, CostPlan tidak terhapus.
- [ ] **6. Hitung ulang dan selisih.** `POST /api/seasons/:id/recalc-cost` memakai `CostPlan.input` terakhir (atau body). Membuat `CostPlan` baru `kind: "HITUNG_ULANG"`; `needsRecalc` menjadi false. Respons memuat selisih terhadap `kind: "AWAL"`. Hanya untuk status `PEMBIAYAAN` dan `TANAM`. Tes: bendera mati, selisih benar, status lain 409.
- [ ] **7. Mulai penanaman (F5 langkah 2).** `POST /api/seasons/:id/start-planting` (tanggal, default hari ini). Syarat status `PEMBIAYAAN` (409 bila tidak). Hasil: `TANAM`, `plantedOn`, minggu berjalan, estimasi panen. Tes: urutan terkunci, minggu 1 di hari tanam, estimasi panen benar.
- [ ] **8. Catatan pengeluaran (F7).** `POST/GET /api/seasons/:id/expenses`, `DELETE /api/seasons/:id/expenses/:expenseId`, `GET .../expenses/summary` (rencana vs kenyataan per kategori dengan `catFrac`, peringatan bila lebih dari 15 persen di atas rencana). Tanggal boleh mundur; jumlah Decimal(10,3); `simulated` tidak dihitung. `weeklyFromExpenses` diubah ke Decimal dengan komentar `[REVISI]`. Tes: jepit minggu, simulasi diabaikan, ambang 15 persen, 404 milik orang lain.
- [ ] **9. Panen dan sampel (F5 langkah 3).** `POST /api/seasons/:id/harvests` (kg > 0, harga > 0), `PUT /api/seasons/:id/sample` (kg dan m2 > 0). `mismatchOver30` dari `kg/m2 x 10000 x areaHa` (selisih tepat 30 persen masih selaras). Panen pertama memindahkan `TANAM` ke `PANEN`. Tes: dua validasi, ambang 30 persen, urutan status.
- [ ] **10. Foto sampel (metadata) dan revisi tutup musim.** Foto: metadata saja (`objectKey`, `sha256` unik global, waktu, lokasi), maksimal 6. `closeSeason` direvisi dengan `[REVISI]`: urutan validasi persis docs/03 (panen, sampel, foto, total biaya), status harus `PANEN`, tutup dua kali 409, isi `yieldKg`/`pricePerKg`/`label`/`note`, hitung untung/rugi dengan Decimal, tambah controller `close` (D1). Tes: tiap pesan validasi, 409 status salah/duplikat, aturan biaya mingguan 90-110 persen, kualitas record benar.
- [ ] **11. Gerbang uang di API.** Saat `DRAFT`, respons menyembunyikan angka hasil prediksi (`CostPlan`); modal/harga/target Season tetap tampil. Tes: DRAFT tanpa angka prediksi, setelah Mulai muncul, setelah Hentikan hilang lagi, field Season tetap ada.
- [ ] **12. Dokumen dan tes alur penuh.** Tes DB satu musim penuh di `agrochie_test` (buat, mulai, tanam, catat, panen, tutup), pembaruan catatan di dokumen ini, dan `docs/tutorial.md` (contoh PowerShell dengan `-WebSession`, daftar perbedaan).

