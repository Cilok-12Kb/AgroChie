// Fungsi murni cuaca musim (tanpa jaringan, tanpa DB). Satuan: mm dan derajat Celsius.
export const HEAVY_RAIN_WEEK_MM = 150; // minggu dengan total hujan >= nilai ini dihitung "hujan lebat"
const DAY_MS = 86_400_000;

const toMs = (d) => {
  const t = new Date(d);
  if (Number.isNaN(t.getTime())) throw new RangeError("Tanggal tidak valid");
  return Date.UTC(t.getUTCFullYear(), t.getUTCMonth(), t.getUTCDate());
};
export const isoDay = (ms) => new Date(ms).toISOString().slice(0, 10);
// Hanya membuang derau floating point (nilai API 1 desimal); bukan estimasi.
const r2 = (n) => Math.round(n * 100) / 100;
const isNum = (v) => typeof v === "number" && Number.isFinite(v);

/**
 * Bagi musim jadi `durasi` minggu penuh (7 hari berurutan sejak plantedOn).
 * passed = hari terakhir minggu itu sudah sebelum `today` (hari ini belum lengkap, jadi belum lewat).
 */
export function weekWindows(plantedOn, durasi, today) {
  const start = toMs(plantedOn);
  const todayMs = toMs(today);
  return Array.from({ length: durasi }, (_, i) => {
    const s = start + i * 7 * DAY_MS;
    const e = s + 6 * DAY_MS;
    return { minggu: i + 1, start: isoDay(s), end: isoDay(e), passed: e < todayMs };
  });
}

/**
 * daily: [{ date: "YYYY-MM-DD", rainMm, tempMax }]; nilai null = tidak ada data (BUKAN 0).
 * startDate: hari pertama musim (default: tanggal pertama di daily).
 * Minggu dihitung (weeksCounted) hanya bila ke-7 harinya punya curah hujan.
 */
export function summarize(daily, durasi, startDate = daily[0]?.date) {
  const empty = { rainAvgMm: null, heavyRainWks: 0, tempMaxAvg: null, weeksCounted: 0, full: false, weeks: [] };
  if (!startDate || !(durasi > 0)) return empty;
  const start = toMs(startDate);
  const total = durasi * 7;
  const days = Array.from({ length: total }, () => ({ rain: null, temp: null }));
  for (const d of daily) {
    const idx = Math.round((toMs(d.date) - start) / DAY_MS);
    if (idx < 0 || idx >= total) continue;
    if (isNum(d.rainMm)) days[idx].rain = d.rainMm;
    if (isNum(d.tempMax)) days[idx].temp = d.tempMax;
  }
  const weeks = [];
  const rainTotals = [];
  const temps = [];
  for (let w = 0; w < durasi; w++) {
    const slice = days.slice(w * 7, w * 7 + 7);
    const wkTemps = slice.map((x) => x.temp).filter((v) => v !== null);
    temps.push(...wkTemps);
    const rainFull = slice.every((x) => x.rain !== null);
    const rainMm = rainFull ? r2(slice.reduce((a, x) => a + x.rain, 0)) : null;
    if (rainFull) rainTotals.push(rainMm);
    weeks.push({
      minggu: w + 1,
      rainMm,
      tempMaxAvg: wkTemps.length ? r2(wkTemps.reduce((a, v) => a + v, 0) / wkTemps.length) : null,
    });
  }
  return {
    rainAvgMm: rainTotals.length ? r2(rainTotals.reduce((a, v) => a + v, 0) / rainTotals.length) : null,
    heavyRainWks: rainTotals.filter((v) => v >= HEAVY_RAIN_WEEK_MM).length,
    tempMaxAvg: temps.length ? r2(temps.reduce((a, v) => a + v, 0) / temps.length) : null,
    weeksCounted: rainTotals.length,
    full: days.every((x) => x.rain !== null && x.temp !== null),
    weeks,
  };
}
