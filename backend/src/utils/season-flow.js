// [REVISI] bagian 18.2: konstanta dan fungsi murni alur musim (tanpa DB).
// Durasi sama dengan season-record.service.js (DURATION) dan backend/knowledge/fase-dan-durasi.md.
export const CROP_DURATION = Object.freeze({ CABAI: 16, TOMAT: 14, BAWANG: 10 });

// Porsi biaya per kategori (docs/03, Q6). Urutan indeks = CATEGORY_INDEX.
export const catFrac = Object.freeze([0.183, 0.309, 0.114, 0.263, 0.131]);

// Pemetaan enum ExpenseCategory -> indeks catFrac.
export const CATEGORY_INDEX = Object.freeze({ BENIH: 0, PUPUK: 1, OBAT: 2, TENAGA_KERJA: 3, LAIN: 4 });

const DAY_MS = 86_400_000;
const WEEK_MS = 7 * DAY_MS;

const durationOf = (crop) => {
  const d = CROP_DURATION[crop];
  if (!d) throw new RangeError(`Tanaman tidak dikenal: ${crop}`);
  return d;
};

// Tanggal dibandingkan sebagai hari kalender UTC (kolom @db.Date), jam diabaikan.
const dayStart = (d) => {
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) throw new RangeError("Tanggal tidak valid");
  return Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
};

/** Minggu berjalan (1 di hari tanam), dijepit 1..durasi-1. Sebelum tanam -> 1, lewat durasi -> durasi-1. */
export function currentWeek(plantedOn, today, crop) {
  const max = durationOf(crop) - 1;
  const wk = Math.floor((dayStart(today) - dayStart(plantedOn)) / WEEK_MS) + 1;
  return Math.min(max, Math.max(1, wk));
}

/** Estimasi panen = tanggal tanam + durasi x 7 hari (Date UTC tengah malam). */
export function harvestEstimate(plantedOn, crop) {
  return new Date(dayStart(plantedOn) + durationOf(crop) * 7 * DAY_MS);
}
