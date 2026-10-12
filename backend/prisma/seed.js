import { prisma } from "../src/config/prisma.js";
import { readBankSeedInput, seedBankOfficer } from "./seed-bank.js";

// lama fase (minggu): persiapan, tanam, rawat, panen
const LENGTHS = { CABAI: [2, 2, 8, 4], TOMAT: [2, 2, 7, 3], BAWANG: [2, 1, 5, 2] };
const NAMES = ["Persiapan lahan", "Penanaman", "Perawatan", "Panen dan pascapanen"];
const SHARES = [0.19, 0.16, 0.5, 0.15];

// REVISI 10 Okt 2026. Hujan klimatologi per minggu (mm), bulan 1 sampai 12, SAMA untuk semua provinsi.
// = round(75 + 55 * cos(2 * pi * (bulan - 1) / 12)), rumus yang dipakai notebook 05 dan engine.
// Ditulis sebagai tabel (bukan dihitung) karena pembulatan Python (bulan 3: 102) dan JavaScript (103) berbeda.
const CLIM = [130, 123, 102, 75, 48, 27, 20, 27, 47, 75, 102, 123];
const PROVINCES = ["Jawa Barat", "Jawa Tengah", "Jawa Timur", "Sulawesi Selatan", "Sumatera Utara"];

async function main() {
  const phases = Object.entries(LENGTHS).flatMap(([crop, lens]) => {
    let start = 1;
    return lens.map((len, i) => {
      const row = { crop, phase: i + 1, name: NAMES[i], lengthWks: len,
        startWeek: start, endWeek: start + len - 1, costShare: SHARES[i] };
      start += len;
      return row;
    });
  });
  await prisma.cropPhase.createMany({ data: phases, skipDuplicates: true });

  const rain = PROVINCES.flatMap((province) =>
    CLIM.map((avgRainMm, i) => ({ province, month: i + 1, avgRainMm })));
  await prisma.climateRain.createMany({ data: rain, skipDuplicates: true });

  // [REVISI] bagian 17.7: akun petugas bank dari env (tanpa mencetak nilai apa pun)
  const bank = readBankSeedInput(process.env);
  if (!bank.ok) {
    console.log(`Seed petugas bank dilewati: ${bank.reason}.`);
  } else {
    console.log(`Seed petugas bank: ${await seedBankOfficer(prisma, bank.input)}`);
  }

  console.log(`Seed selesai: ${phases.length} fase, ${rain.length} baris hujan`);
}

main().finally(() => prisma.$disconnect());