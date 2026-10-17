import { z } from "zod";
import { HttpError } from "../utils/http-error.js";
import { SOIL_TYPES, WATER_SOURCES, LEVELS } from "../config/options.js"; // [REVISI] PROVINCES dihapus (provinsi teks bebas)

const FIELDS = ["name", "village", "subdistrict", "farmerGroup", "province", "country", "latitude",
  "longitude", "areaHa", "soilType", "waterSource", "ph", "nitrogen", "phosphorus", "potassium", "note"];

const oneOf = (value, list, label) => {
  if (value != null && !list.includes(value)) throw new HttpError(400, `${label} harus salah satu dari: ${list.join(", ")}`);
};

// ---- [REVISI] bagian 17.9: validator zod untuk PATCH profil lahan (validateFarm di bawah tidak diubah) ----
const text = (max) =>
  z.string().trim().max(max, `Maksimal ${max} karakter`).transform((v) => (v === "" ? null : v)).nullable();
const oneOfEnum = (list, label) =>
  z.enum(list, { error: `${label} harus salah satu dari: ${list.join(", ")}` }).nullable();

// Angka dari JSON number atau string; diubah ke string desimal (Prisma Decimal), tidak pernah Number ke DB.
const decimal = (label, { min, max, places, minExclusive = false }) =>
  z
    .union([z.number(), z.string().trim()], { error: `${label} harus berupa angka` })
    .transform((v) => (typeof v === "number" ? String(v) : v))
    .refine((s) => /^-?\d+(\.\d+)?$/.test(s), `${label} harus berupa angka`)
    .refine((s) => (s.split(".")[1] ?? "").length <= places, `${label} maksimal ${places} angka desimal`)
    .refine((s) => (minExclusive ? Number(s) > min : Number(s) >= min), `${label} harus ${minExclusive ? "lebih dari" : "minimal"} ${min}`)
    .refine((s) => max === undefined || Number(s) <= max, `${label} maksimal ${max}`);

const money = (label) => decimal(label, { min: 0, max: 99999999, places: 2 }).nullable();

const dateOnly = z
  .string({ error: "phMeasuredOn harus berupa tanggal YYYY-MM-DD" })
  .regex(/^\d{4}-\d{2}-\d{2}$/, "phMeasuredOn harus berupa tanggal YYYY-MM-DD")
  .refine((s) => {
    const d = new Date(`${s}T00:00:00.000Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s; // tolak 2026-02-31
  }, "Tanggal tidak valid")
  .transform((s) => new Date(`${s}T00:00:00.000Z`))
  .refine((d) => d.getTime() <= Date.now() + 24 * 3600 * 1000, "Tanggal ukur pH tidak boleh di masa depan");

// [REVISI] bagian 18.1: objek dasar dipakai bersama oleh skema PATCH dan POST (aturan tidak disalin).
// [REVISI] 18.4: diekspor agar PATCH Season memakai ulang aturan nilai.
export const farmObject = z
  .strictObject(
    {
      name: z.string().trim().min(1, "Nama lahan wajib diisi").max(100, "Nama lahan terlalu panjang"),
      village: text(100),
      subdistrict: text(100),
      farmerGroup: text(100),
      note: text(500),
      province: text(100), // [REVISI] teks bebas (trim, maks 100, kosong -> null)
      // [REVISI] kode negara 2 huruf; huruf kecil diubah jadi besar. Tidak nullable: kolom DB NOT NULL default "ID".
      country: z
        .string({ error: "Negara harus berupa kode 2 huruf" })
        .trim()
        .toUpperCase()
        .regex(/^[A-Z]{2}$/, "Negara harus berupa kode 2 huruf (A-Z)"),
      soilType: oneOfEnum(SOIL_TYPES, "Jenis tanah"),
      waterSource: oneOfEnum(WATER_SOURCES, "Sumber air"),
      nitrogen: oneOfEnum(LEVELS, "nitrogen"),
      phosphorus: oneOfEnum(LEVELS, "phosphorus"),
      potassium: oneOfEnum(LEVELS, "potassium"),
      ph: decimal("pH", { min: 3, max: 9, places: 1 }).nullable(),
      phMeasuredOn: dateOnly.nullable(),
      latitude: decimal("latitude", { min: -90, max: 90, places: 6 }).nullable(),
      longitude: decimal("longitude", { min: -180, max: 180, places: 6 }).nullable(),
      areaHa: decimal("Luas lahan", { min: 0.1, max: 5, places: 2 }), // wajib ada di DB: null ditolak
      capitalJt: money("capitalJt"),
      sellPricePerKg: money("sellPricePerKg"),
      profitTargetJt: money("profitTargetJt"),
    },
    { error: (iss) => (iss.code === "unrecognized_keys" ? `Isian tidak dikenal: ${iss.keys.join(", ")}` : undefined) },
  );

// [REVISI] bagian 18.1: aturan pasangan (pH/tanggal ukur, koordinat) dipakai bersama PATCH dan POST.
const pairRules = (d, ctx) => {
    const bad = (message, path) => ctx.addIssue({ code: "custom", message, path: [path] });
    // pH dan tanggal ukur selalu sepasang; pH dikosongkan berarti tanggal ikut kosong.
    if ("ph" in d || "phMeasuredOn" in d) {
      if (d.ph == null && d.phMeasuredOn != null) bad("phMeasuredOn tidak boleh diisi tanpa ph", "phMeasuredOn");
      if (d.ph != null && d.phMeasuredOn == null) bad("pH harus disertai phMeasuredOn (tanggal ukur)", "ph");
    }
    // Koordinat selalu sepasang (keduanya terisi atau keduanya null).
    if ("latitude" in d || "longitude" in d) {
      if ((d.latitude == null) !== (d.longitude == null)) bad("latitude dan longitude harus dikirim bersamaan", "latitude");
    }
};

export const farmPatchSchema = farmObject.partial().superRefine((d, ctx) => {
  if (Object.keys(d).length === 0) ctx.addIssue({ code: "custom", message: "Tidak ada isian yang dikirim", path: ["body"] });
  pairRules(d, ctx);
});

// [REVISI] bagian 18.1: skema POST /farms. Aturan sama dengan PATCH; areaHa wajib, dan name wajib
// karena kolom wajib di DB (tanpa itu Prisma menjawab 500). Kunci lain opsional.
export const farmCreateSchema = farmObject.partial().required({ name: true, areaHa: true }).superRefine(pairRules);

export function parseFarmCreate(body) {
  const r = farmCreateSchema.safeParse(body ?? {});
  if (!r.success) throw new HttpError(400, r.error.issues.map((i) => i.message).join("; "));
  const data = { ...r.data };
  if ("ph" in data && data.ph == null) data.phMeasuredOn = null;
  return data;
}

/** Hasil: objek berisi hanya kunci yang dikirim (nilai sudah dinormalisasi). Galat -> HttpError 400. */
export function parseFarmPatch(body) {
  const r = farmPatchSchema.safeParse(body ?? {});
  if (!r.success) throw new HttpError(400, r.error.issues.map((i) => i.message).join("; "));
  const data = { ...r.data };
  if ("ph" in data && data.ph == null) data.phMeasuredOn = null;
  return data;
}

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
  // [REVISI] provinsi teks bebas (maks 100 karakter); negara kode 2 huruf.
  if (data.province != null && String(data.province).trim().length > 100) throw new HttpError(400, "Provinsi maksimal 100 karakter");
  if (data.country != null && !/^[A-Za-z]{2}$/.test(String(data.country).trim())) throw new HttpError(400, "Negara harus berupa kode 2 huruf (A-Z)");
  for (const k of ["nitrogen", "phosphorus", "potassium"]) oneOf(data[k], LEVELS, k);
  return data;
}