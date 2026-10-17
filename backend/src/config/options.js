export const SOIL_TYPES = ["Lempung", "Lempung berpasir", "Liat", "Pasir", "Tanah vulkanik (andosol)"];
export const WATER_SOURCES = ["Embung atau sungai", "Irigasi teknis", "Sumur atau pompa", "Tadah hujan"];
// [REVISI] provinsi di profil lahan kini teks bebas; daftar ini hanya provinsi yang dikenal model engine.
export const KNOWN_MODEL_PROVINCES = ["Jawa Barat", "Jawa Tengah", "Jawa Timur", "Sulawesi Selatan", "Sumatera Utara"];
// Nilai cadangan bila wilayah lahan tidak dikenal model (paling dekat rata-rata kelima provinsi).
export const FALLBACK_MODEL_PROVINCE = "Jawa Barat";
export const LEVELS = ["RENDAH", "SEDANG", "TINGGI"];