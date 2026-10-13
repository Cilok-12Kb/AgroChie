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

// [REVISI] asisten: kode cuaca WMO (Open-Meteo) -> kondisi dalam Bahasa Indonesia.
const WMO_ID = new Map([
  [0, "Cerah"], [1, "Cerah berawan"], [2, "Berawan sebagian"], [3, "Berawan tebal"],
  [45, "Berkabut"], [48, "Berkabut"],
  [51, "Gerimis ringan"], [53, "Gerimis"], [55, "Gerimis lebat"],
  [56, "Gerimis beku"], [57, "Gerimis beku"],
  [61, "Hujan ringan"], [63, "Hujan sedang"], [65, "Hujan lebat"],
  [66, "Hujan beku"], [67, "Hujan beku"],
  [71, "Salju ringan"], [73, "Salju"], [75, "Salju lebat"], [77, "Butiran salju"],
  [80, "Hujan lokal ringan"], [81, "Hujan lokal sedang"], [82, "Hujan lokal lebat"],
  [85, "Salju lokal"], [86, "Salju lokal lebat"],
  [95, "Badai petir"], [96, "Badai petir dengan es"], [99, "Badai petir dengan es lebat"],
]);
export const describeWeatherCode = (code) => (isNum(code) && WMO_ID.get(code)) || null;

const numOrNull = (v) => (isNum(v) ? v : null);

/**
 * [REVISI] Ubah respons Open-Meteo (current + daily, forecast_days=4) menjadi
 * { current, today, forecast[3 hari berikutnya] }. Nilai tak ada tetap null (tidak ditebak).
 * Melempar RangeError bila bentuk respons tidak sesuai.
 */
export function parseFarmWeather(body) {
  const c = body?.current;
  const d = body?.daily;
  if (!c || typeof c !== "object" || !d || !Array.isArray(d.time) || d.time.length < 1) {
    throw new RangeError("Respons cuaca tidak valid");
  }
  const day = (i) => ({
    date: d.time[i],
    condition: describeWeatherCode(d.weather_code?.[i]),
    rainMm: numOrNull(d.precipitation_sum?.[i]),
    rainProbabilityPct: numOrNull(d.precipitation_probability_max?.[i]),
    tempMinC: numOrNull(d.temperature_2m_min?.[i]),
    tempMaxC: numOrNull(d.temperature_2m_max?.[i]),
  });
  return {
    current: {
      time: typeof c.time === "string" ? c.time : null,
      tempC: numOrNull(c.temperature_2m),
      humidityPct: numOrNull(c.relative_humidity_2m),
      rainMm: numOrNull(c.precipitation),
      windKmh: numOrNull(c.wind_speed_10m),
      condition: describeWeatherCode(c.weather_code),
    },
    today: day(0),
    forecast: d.time.slice(1, 4).map((_, i) => day(i + 1)),
  };
}

const PHASES = Object.freeze({
  CABAI: [["persiapan lahan", 2], ["penanaman", 2], ["perawatan", 8], ["panen dan pascapanen", 4]],
  TOMAT: [["persiapan lahan", 2], ["penanaman", 2], ["perawatan", 7], ["panen dan pascapanen", 3]],
  BAWANG: [["persiapan lahan", 2], ["penanaman", 1], ["perawatan", 5], ["panen dan pascapanen", 2]],
});

/** [REVISI] Minggu ke-n dan fase musim (sesuai knowledge/fase-dan-durasi.md). null bila belum ditanam. */
export function seasonPhase(crop, plantedOn, today) {
  const phases = PHASES[crop];
  if (!phases || !plantedOn) return null;
  const week = Math.floor((toMs(today) - toMs(plantedOn)) / (7 * DAY_MS)) + 1;
  if (week < 1) return null;
  const total = phases.reduce((a, [, w]) => a + w, 0);
  if (week > total) return { week, phase: "melewati durasi musim", totalWeeks: total };
  let left = week;
  for (const [name, w] of phases) {
    if (left <= w) return { week, phase: name, totalWeeks: total };
    left -= w;
  }
  return null;
}

