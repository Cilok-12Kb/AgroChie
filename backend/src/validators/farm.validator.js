import { HttpError } from "../utils/http-error.js";
import { SOIL_TYPES, WATER_SOURCES, PROVINCES, LEVELS } from "../config/options.js";

const FIELDS = ["name", "village", "subdistrict", "farmerGroup", "province", "latitude",
  "longitude", "areaHa", "soilType", "waterSource", "ph", "nitrogen", "phosphorus", "potassium", "note"];

const oneOf = (value, list, label) => {
  if (value != null && !list.includes(value)) throw new HttpError(400, `${label} harus salah satu dari: ${list.join(", ")}`);
};

/** Ambil hanya field yang diizinkan dan periksa nilainya. */
export function validateFarm(body = {}) {
  const data = Object.fromEntries(FIELDS.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));

  const area = Number(data.areaHa);
  if (!(area > 0 && area <= 5)) throw new HttpError(400, "Luas lahan harus lebih dari 0 dan maksimal 5 ha");
  if (data.latitude != null && !(Math.abs(data.latitude) <= 90)) throw new HttpError(400, "Koordinat tidak valid");
  if (data.longitude != null && !(Math.abs(data.longitude) <= 180)) throw new HttpError(400, "Koordinat tidak valid");
  if (data.ph != null && !(data.ph >= 3 && data.ph <= 9)) throw new HttpError(400, "pH di luar batas wajar (3 sampai 9)");
  oneOf(data.soilType, SOIL_TYPES, "Jenis tanah");
  oneOf(data.waterSource, WATER_SOURCES, "Sumber air");
  oneOf(data.province, PROVINCES, "Provinsi");
  for (const k of ["nitrogen", "phosphorus", "potassium"]) oneOf(data[k], LEVELS, k);
  return data;
}