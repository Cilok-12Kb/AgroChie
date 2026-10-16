import { prisma } from "../config/prisma.js";
import { HttpError } from "../utils/http-error.js";
import { getFarmWeather } from "./weather.service.js";
import { seasonPhase } from "../utils/weather.js";
import { todayWib } from "../validators/season.validator.js";

// Alat (function calling) untuk Gemini. Hanya membaca; koordinat tidak pernah dikirim ke model.
export const TOOL_DECLARATIONS = [
  {
    name: "get_weather",
    description:
      "Ambil cuaca aktual (suhu, kelembapan, curah hujan, angin, kondisi) dan prakiraan 3 hari ke depan di lokasi lahan petani. " +
      "Panggil untuk pertanyaan tentang cuaca, hujan, panas, angin, prakiraan, atau waktu menyiram, memupuk, dan menyemprot.",
    parametersJsonSchema: {
      type: "object",
      properties: { lahan_id: { type: "string", description: "ID lahan aktif petani (lihat <data_petani>)." } },
      required: ["lahan_id"],
    },
  },
  {
    name: "get_land_context",
    description: "Ambil data lahan petani: nama lahan, komoditas, lokasi (desa, kecamatan, provinsi), minggu dan fase musim.",
    parametersJsonSchema: {
      type: "object",
      properties: { lahan_id: { type: "string", description: "ID lahan aktif petani (lihat <data_petani>)." } },
      required: ["lahan_id"],
    },
  },
];

/** Lahan harus milik pengguna; milik orang lain dijawab 404. */
async function ownedFarm(userId, farmId) {
  if (typeof farmId !== "string" || !farmId) throw new HttpError(400, "lahan_id wajib diisi");
  const farm = await prisma.farm.findFirst({ where: { id: farmId, userId } });
  if (!farm) throw new HttpError(404, "Lahan tidak ditemukan");
  return farm;
}

export const locationText = (farm) =>
  [farm.village, farm.subdistrict, farm.province].filter(Boolean).join(", ") || null;

export async function landContext(userId, farmId, today = todayWib()) {
  const farm = await ownedFarm(userId, farmId);
  const season = await prisma.season.findFirst({
    where: { farmId: farm.id, status: { not: "SELESAI" } },
    orderBy: { id: "desc" },
  });
  const phase = season ? seasonPhase(season.crop, season.plantedOn, today) : null;
  return {
    namaLahan: farm.name,
    lokasi: locationText(farm),
    koordinatTersedia: farm.latitude !== null && farm.longitude !== null,
    luasHa: farm.areaHa != null ? Number(farm.areaHa) : null,
    komoditas: season ? String(season.crop).toLowerCase() : null,
    statusMusim: season?.status ?? null,
    mingguKe: phase?.week ?? null,
    fase: phase?.phase ?? (season ? "belum ditanam" : null),
  };
}

const MONTHS = {
  id: ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"],
  en: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"],
};

/** [REVISI] B4: ISO lokal "YYYY-MM-DDTHH:mm" (atau tanggal saja) menjadi teks per bahasa; angka tidak diubah. Tak valid -> null. */
export function formatWeatherTime(iso, lang = "id") {
  const m = /^(\d{4})-(\d{2})-(\d{2})(?:T(\d{2}):(\d{2}))?/.exec(String(iso ?? ""));
  if (!m) return null;
  const [, y, mo, d, hh, mm] = m;
  const mi = Number(mo) - 1;
  if (mi < 0 || mi > 11) return null;
  const day = Number(d);
  const time = hh !== undefined ? `${hh}:${mm}` : null;
  if (lang === "en") return `${MONTHS.en[mi]} ${day}, ${y}${time ? `, ${time}` : ""}`;
  if (lang === "zh") return `${y}年${mi + 1}月${day}日${time ? ` ${time}` : ""}`;
  return `${day} ${MONTHS.id[mi]} ${y}${time ? `, pukul ${hh}.${mm}` : ""}`;
}

export async function weatherForFarm(userId, farmId, lang = "id") {
  const farm = await ownedFarm(userId, farmId);
  if (farm.latitude === null || farm.longitude === null) {
    return { error: "Lahan belum punya koordinat lokasi, jadi cuaca tidak dapat diambil." };
  }
  const w = await getFarmWeather(Number(farm.latitude), Number(farm.longitude));
  return {
    namaLahan: farm.name,
    lokasi: locationText(farm),
    sumber: w.source,
    zonaWaktu: w.timezone,
    waktuDataSaatIni: w.current.time,
    waktuTerformat: formatWeatherTime(w.current.time, lang), // [REVISI] B4
    tanggalPrakiraanTerformat: (w.forecast ?? []).map((f) => formatWeatherTime(f.date, lang)), // [REVISI] B4
    diambilPada: w.fetchedAt,
    saatIni: w.current,
    hariIni: w.today,
    prakiraan3Hari: w.forecast,
  };
}

export function buildTools(userId, lang = "id") {
  return {
    declarations: TOOL_DECLARATIONS,
    handlers: {
      get_weather: ({ lahan_id }) => weatherForFarm(userId, lahan_id, lang),
      get_land_context: ({ lahan_id }) => landContext(userId, lahan_id),
    },
  };
}
