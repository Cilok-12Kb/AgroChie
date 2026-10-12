// bagian 17.10: fungsi murni. Dihitung saat dibaca, tidak disimpan ke database.

/** 12 butir kelengkapan profil (keputusan 3). Semua dari Farm; tanaman/tanggal tanam (Season) tidak dihitung. */
export const COMPLETENESS_ITEMS = [
  { key: "village", fields: ["village"] },
  { key: "subdistrict", fields: ["subdistrict"] },
  { key: "province", fields: ["province"] },
  { key: "soilType", fields: ["soilType"] },
  { key: "waterSource", fields: ["waterSource"] },
  { key: "ph", fields: ["ph"] },
  { key: "nitrogen", fields: ["nitrogen"] },
  { key: "phosphorus", fields: ["phosphorus"] },
  { key: "potassium", fields: ["potassium"] },
  { key: "lokasi", fields: ["latitude", "longitude"] }, // terisi hanya bila lintang DAN bujur terisi
  { key: "capitalJt", fields: ["capitalJt"] },
  { key: "sellPricePerKg", fields: ["sellPricePerKg"] },
];

/** Kosong = null, undefined, atau string kosong/spasi. Angka 0 dan Decimal 0 dianggap terisi. */
const isBlank = (v) => v === null || v === undefined || (typeof v === "string" && v.trim() === "");

/** @returns {{ percent: number, missing: string[] }} percent = round(terisi / 12 * 100) */
export function profileCompleteness(farm = {}) {
  const missing = COMPLETENESS_ITEMS.filter((it) => it.fields.some((f) => isBlank(farm[f]))).map((it) => it.key);
  const filled = COMPLETENESS_ITEMS.length - missing.length;
  return { percent: Math.round((filled / COMPLETENESS_ITEMS.length) * 100), missing };
}

export const TRAIN_RANGE = { maxAreaHa: 3.0, minPh: 4.5, maxPh: 7.5 };

/**
 * Di luar rentang latih bila areaHa > 3,0 ("luas") atau ph < 4,5 / > 7,5 ("ph").
 * Batas tepat (3,0; 4,5; 7,5) masih di dalam. ph kosong tidak ditandai (tidak ditebak).
 * Number() hanya untuk membandingkan ambang, bukan untuk menyimpan nilai.
 */
export function outOfTrainingRange(farm = {}) {
  const alasan = [];
  if (!isBlank(farm.areaHa) && Number(farm.areaHa) > TRAIN_RANGE.maxAreaHa) alasan.push("luas");
  if (!isBlank(farm.ph)) {
    const ph = Number(farm.ph);
    if (ph < TRAIN_RANGE.minPh || ph > TRAIN_RANGE.maxPh) alasan.push("ph");
  }
  return { di_luar_rentang_latih: alasan.length > 0, alasan };
}
