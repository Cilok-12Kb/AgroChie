import { prisma } from "../src/config/prisma.js";

// lama fase (minggu): persiapan, tanam, rawat, panen
const LENGTHS = { CABAI: [2, 2, 8, 4], TOMAT: [2, 2, 7, 3], BAWANG: [2, 1, 5, 2] };
const NAMES = ["Persiapan lahan", "Penanaman", "Perawatan", "Panen dan pascapanen"];
const SHARES = [0.19, 0.16, 0.5, 0.15];

// hujan klimatologi per minggu (mm), bulan 1-12, dari dataset
const CLIM = {
  "Jawa Barat": [130, 123, 102, 75, 48, 28, 20, 27, 48, 75, 103, 123],
  "Jawa Tengah": [130, 123, 102, 75, 47, 28, 20, 27, 48, 75, 102, 123],
  "Jawa Timur": [130, 123, 102, 75, 47, 27, 20, 27, 47, 75, 103, 123],
  "Sulawesi Selatan": [130, 123, 102, 75, 48, 27, 20, 27, 47, 75, 102, 123],
  "Sumatera Utara": [130, 123, 102, 75, 48, 28, 20, 27, 48, 75, 103, 123],
};

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

  const rain = Object.entries(CLIM).flatMap(([province, arr]) =>
    arr.map((avgRainMm, i) => ({ province, month: i + 1, avgRainMm })));
  await prisma.climateRain.createMany({ data: rain, skipDuplicates: true });

  console.log(`Seed selesai: ${phases.length} fase, ${rain.length} baris hujan`);
}

main().finally(() => prisma.$disconnect());