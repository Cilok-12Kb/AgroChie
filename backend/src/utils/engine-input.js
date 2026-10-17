import { HttpError } from "./http-error.js";
import { KNOWN_MODEL_PROVINCES, FALLBACK_MODEL_PROVINCE } from "../config/options.js"; // [REVISI]

const LABEL = {
  soilType: "jenis tanah", waterSource: "sumber air", province: "provinsi", ph: "pH",
  nitrogen: "nitrogen", phosphorus: "fosfor", potassium: "kalium", startMonth: "bulan tanam",
  rainAvgMm: "rata-rata hujan", heavyRainWks: "minggu hujan lebat", tempMaxAvg: "suhu maksimum rata-rata",
  fertIndex: "indeks harga pupuk", wageIndex: "indeks upah", pestIndex: "indeks harga pestisida",
};

const lower = (v) => (v == null ? v : String(v).toLowerCase());
const num = (v) => (v == null ? v : Number(v)); // Decimal Prisma -> angka

// [REVISI] Normalisasi untuk pencocokan: tanpa beda huruf, spasi ganda, dan awalan "Provinsi".
const normRegion = (v) => String(v ?? "").trim().toLowerCase().replace(/^provinsi\s+/, "").replace(/\s+/g, " ");

/**
 * [REVISI] Petakan negara + provinsi teks bebas ke provinsi yang dikenal model.
 * Hanya country "ID" dengan provinsi yang cocok (tanpa beda huruf/spasi/awalan "Provinsi") yang dipakai apa adanya;
 * selain itu memakai FALLBACK_MODEL_PROVINCE dan fallback=true (UI/respons memberi catatan).
 * Tidak ada pencarian iklim berdasarkan provinsi di backend (cuaca dari body/layanan cuaca), jadi hasil ini
 * satu-satunya nilai provinsi yang boleh sampai ke engine.
 * Catatan data latih: view dataset_latih memakai JOIN climate_rain per provinsi, sehingga SeasonRecord dari luar
 * 5 provinsi model tidak ikut data latih model Indonesia. Itu disengaja (season-record.service.js tidak diubah).
 * @returns {{ value: string, fallback: boolean }}
 */
export function toModelProvince(country, province) {
  const isId = String(country ?? "ID").trim().toUpperCase() === "ID";
  if (isId) {
    const key = normRegion(province);
    const hit = KNOWN_MODEL_PROVINCES.find((p) => p.toLowerCase() === key);
    if (hit) return { value: hit, fallback: false };
  }
  return { value: FALLBACK_MODEL_PROVINCE, fallback: true };
}

/**
 * Susun masukan engine (16 isian tingkat-musim, nama kolom = CSV latih) dari data lahan,
 * musim, cuaca, dan indeks harga. Isian yang belum ada TIDAK ditebak: ditolak dengan daftar.
 */
export function toEngineInput({ farm, season, weather = {}, indices = {}, startMonth }) {
  const month = startMonth ?? (season.plantedOn ? new Date(season.plantedOn).getUTCMonth() + 1 : undefined);
  const raw = {
    soilType: farm.soilType, waterSource: farm.waterSource, province: farm.province, ph: num(farm.ph),
    nitrogen: farm.nitrogen, phosphorus: farm.phosphorus, potassium: farm.potassium, startMonth: month,
    rainAvgMm: weather.rainAvgMm, heavyRainWks: weather.heavyRainWks, tempMaxAvg: weather.tempMaxAvg,
    fertIndex: indices.fertIndex, wageIndex: indices.wageIndex, pestIndex: indices.pestIndex,
  };
  const missing = Object.entries(raw).filter(([, v]) => v === null || v === undefined).map(([k]) => LABEL[k]);
  if (missing.length) throw new HttpError(400, `Lengkapi dulu: ${missing.join(", ")}`);

  return {
    komoditas: lower(season.crop),
    luas_ha: num(season.areaHa),
    jenis_tanah: raw.soilType,
    sumber_air: raw.waterSource,
    provinsi: toModelProvince(farm.country, raw.province).value, // [REVISI] bukan teks bebas; cadangan bila tak dikenal model
    bulan_tanam: Number(raw.startMonth),
    hujan_mm_rata_per_minggu: Number(raw.rainAvgMm),
    minggu_hujan_lebat: Number(raw.heavyRainWks),
    suhu_maks_rata: Number(raw.tempMaxAvg),
    ph: raw.ph,
    fosfor: lower(raw.phosphorus),
    nitrogen: lower(raw.nitrogen),
    kalium: lower(raw.potassium),
    indeks_harga_pupuk: Number(raw.fertIndex),
    indeks_upah: Number(raw.wageIndex),
    indeks_harga_pestisida: Number(raw.pestIndex),
  };
}

/** Model kualitas dipakai bersama untuk tomat dan cabai: tandai bila hasilnya milik tanaman lain dari musim. */
export function checkLeafCrop(result, crop) {
  if (!crop || !result.crop) return result; // engine mengirim result.crop: "cabai" atau "tomat"
  return { ...result, crop_mismatch: result.crop !== String(crop).toLowerCase() };
}