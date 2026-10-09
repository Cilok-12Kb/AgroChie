import { HttpError } from "../utils/http-error.js";

const FIELDS = ["name", "village", "subdistrict", "farmerGroup", "province", "latitude",
  "longitude", "areaHa", "soilType", "waterSource", "ph", "nitrogen", "phosphorus", "potassium", "note"];

export function validateFarm(body = {}) {
  const data = Object.fromEntries(FIELDS.filter((k) => body[k] !== undefined).map((k) => [k, body[k]]));

  const area = Number(data.areaHa);
  if (!(area > 0 && area <= 5)) throw new HttpError(400, "Luas lahan harus lebih dari 0 dan maksimal 5 ha");
  if (data.latitude != null && !(Math.abs(data.latitude) <= 90)) throw new HttpError(400, "Koordinat tidak valid");
  if (data.longitude != null && !(Math.abs(data.longitude) <= 180)) throw new HttpError(400, "Koordinat tidak valid");
  if (data.ph != null && !(data.ph >= 3 && data.ph <= 9)) throw new HttpError(400, "pH di luar batas wajar (3 sampai 9)");
  return data;
}