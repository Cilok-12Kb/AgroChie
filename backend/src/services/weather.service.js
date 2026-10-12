import { prisma } from "../config/prisma.js";
import { HttpError } from "../utils/http-error.js";
import { CROP_DURATION } from "../utils/season-flow.js";
import { todayWib } from "../validators/season.validator.js";
import { weekWindows, summarize, isoDay } from "../utils/weather.js";

const ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive";
const FORECAST_URL = "https://api.open-meteo.com/v1/forecast";
const TIMEOUT_MS = 10_000;
const CACHE_TTL_MS = 30 * 60 * 1000;
const ARCHIVE_LAG_DAYS = 7; // tanggal lebih lama dari ini -> archive-api; sisanya -> forecast + past_days
const MAX_PAST_DAYS = 92; // batas past_days Open-Meteo
const DAY_MS = 86_400_000;
const USER_AGENT = "AgroChie/1.0 (cuaca musim)";
const FAIL_MSG = "Data cuaca belum dapat diambil. Isi data cuaca secara manual.";

const cache = new Map();
export function clearWeatherCache() {
  cache.clear();
}

const fail = () => new HttpError(503, FAIL_MSG);
const ms = (iso) => Date.parse(`${iso}T00:00:00.000Z`);
const coord = (v) => Number(v).toFixed(4);
const dayMs = (d) => Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());

const logUrl = (url) => { const u = new URL(url); return `${u.origin}${u.pathname}?start_date=${u.searchParams.get("start_date")}&end_date=${u.searchParams.get("end_date")}&past_days=${u.searchParams.get("past_days")}`; }; // [REVISI] tanpa koordinat

// Satu panggilan HTTP: timeout 10 dtk, satu retry untuk galat jaringan/5xx, tanpa retry untuk 4xx.
async function getJson(url) {
  for (let attempt = 0; attempt < 2; attempt++) {
    let res;
    try {
      res = await fetch(url, { headers: { "User-Agent": USER_AGENT }, signal: AbortSignal.timeout(TIMEOUT_MS) });
    } catch (err) {
      console.error(`[weather] Open-Meteo gagal (percobaan ${attempt + 1}) ${logUrl(url)}: ${err?.name ?? "Error"} ${err?.message ?? ""}`); // [REVISI]
      continue; // galat jaringan / timeout -> coba sekali lagi
    }
    if (res.status >= 500) {
      console.error(`[weather] Open-Meteo HTTP ${res.status} (percobaan ${attempt + 1}) ${logUrl(url)}`); // [REVISI]
      continue;
    }
    if (!res.ok) {
      console.error(`[weather] Open-Meteo HTTP ${res.status} ${logUrl(url)}`); // [REVISI]
      throw fail(); // 4xx: tanpa retry
    }
    try {
      return await res.json();
    } catch {
      console.error(`[weather] Open-Meteo mengirim JSON tidak valid ${logUrl(url)}`); // [REVISI]
      throw fail();
    }
  }
  throw fail();
}

// Validasi bentuk respons; mengembalikan [{ date, rainMm, tempMax }] (null dipertahankan).
function parseDaily(body) {
  const d = body?.daily;
  const ok = d && Array.isArray(d.time) && Array.isArray(d.precipitation_sum) && Array.isArray(d.temperature_2m_max) &&
    d.precipitation_sum.length === d.time.length && d.temperature_2m_max.length === d.time.length &&
    d.time.every((t) => typeof t === "string" && /^\d{4}-\d{2}-\d{2}$/.test(t)) &&
    [...d.precipitation_sum, ...d.temperature_2m_max].every((v) => v === null || (typeof v === "number" && Number.isFinite(v)));
  if (!ok) throw fail();
  return d.time.map((date, i) => ({ date, rainMm: d.precipitation_sum[i], tempMax: d.temperature_2m_max[i] }));
}

function buildUrl(base, lat, lon, params) {
  const u = new URL(base);
  u.searchParams.set("latitude", coord(lat));
  u.searchParams.set("longitude", coord(lon));
  u.searchParams.set("daily", "precipitation_sum,temperature_2m_max");
  u.searchParams.set("timezone", "Asia/Jakarta");
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, String(v));
  return u.toString();
}

/** Cuaca harian start..end (YYYY-MM-DD), digabung per tanggal tanpa ganda. Tanpa nilai pengganti. */
export async function fetchDaily(lat, lon, start, end, today = todayWib()) {
  const key = `${coord(lat)},${coord(lon)},${start},${end}`;
  const hit = cache.get(key);
  if (hit && hit.exp > Date.now()) return hit.rows;

  const todayIso = isoDay(dayMs(today));
  const cutoff = isoDay(ms(todayIso) - ARCHIVE_LAG_DAYS * DAY_MS); // tanggal <= cutoff -> archive
  const byDate = new Map();
  const put = (r) => {
    const old = byDate.get(r.date);
    if (!old) byDate.set(r.date, { ...r });
    else { // tanggal ganda: nilai non-null pertama menang
      if (old.rainMm === null) old.rainMm = r.rainMm;
      if (old.tempMax === null) old.tempMax = r.tempMax;
    }
  };
  const inRange = (r) => r.date >= start && r.date <= end;

  if (start <= cutoff) {
    const archEnd = end < cutoff ? end : cutoff;
    const rows = parseDaily(await getJson(buildUrl(ARCHIVE_URL, lat, lon, { start_date: start, end_date: archEnd })));
    rows.filter(inRange).forEach(put);
  }
  if (end > cutoff) {
    const fStart = start > cutoff ? start : isoDay(ms(cutoff) + DAY_MS);
    const pastDays = Math.round((ms(todayIso) - ms(fStart)) / DAY_MS);
    if (pastDays > MAX_PAST_DAYS) throw fail();
    const rows = parseDaily(await getJson(buildUrl(FORECAST_URL, lat, lon, { past_days: Math.max(0, pastDays), forecast_days: 1 })));
    rows.filter((r) => inRange(r) && r.date >= fStart).forEach(put);
  }
  const rows = [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
  cache.set(key, { rows, exp: Date.now() + CACHE_TTL_MS });
  return rows;
}

// Hanya membaca; tidak menulis ke database.
export async function getSeasonWeather(userId, id, week, today = todayWib()) {
  const season = await prisma.season.findFirst({
    where: { id, farm: { userId } },
    select: { crop: true, plantedOn: true, farm: { select: { latitude: true, longitude: true } } },
  });
  if (!season) throw new HttpError(404, "Musim tidak ditemukan");
  if (!season.plantedOn) throw new HttpError(409, "Mulai penanaman dulu");
  const { latitude, longitude } = season.farm;
  if (latitude === null || longitude === null) throw new HttpError(409, "Lengkapi dulu: lokasi lahan");

  const durasi = CROP_DURATION[season.crop];
  if (week !== undefined && (!Number.isInteger(week) || week < 1 || week > durasi)) {
    throw new HttpError(400, `Minggu harus 1 sampai ${durasi}`);
  }
  const windows = weekWindows(season.plantedOn, durasi, today);
  const yesterday = isoDay(dayMs(today) - DAY_MS);

  // Rentang diminta: seluruh musim atau satu minggu; hanya sampai kemarin (hari ini belum lengkap).
  const target = week === undefined
    ? { s: windows[0].start, e: windows[durasi - 1].end }
    : { s: windows[week - 1].start, e: windows[week - 1].end };
  const reqEnd = target.e < yesterday ? target.e : yesterday;
  const daily = target.s <= reqEnd
    ? await fetchDaily(Number(latitude), Number(longitude), target.s, reqEnd, today)
    : [];

  const sum = summarize(daily, week === undefined ? durasi : 1, target.s);
  const weeks = week === undefined ? sum.weeks : sum.weeks.map((w) => ({ ...w, minggu: week }));
  const full = week === undefined ? sum.full && windows.every((w) => w.passed) : sum.full && windows[week - 1].passed;
  const { rainAvgMm, heavyRainWks, tempMaxAvg, weeksCounted } = sum;
  // [REVISI] status musim: belum ada minggu selesai -> not_started; semua minggu lewat -> complete.
  const anyPassed = windows.some((w) => w.passed);
  const status = !anyPassed ? "not_started" : windows.every((w) => w.passed) ? "complete" : "in_progress";
  return { rainAvgMm, heavyRainWks, tempMaxAvg, weeksCounted, full, status, source: "Open-Meteo", weeks };
}

