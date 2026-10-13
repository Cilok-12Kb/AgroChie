// [REVISI] Pemetaan kelas model CNN kualitas tanaman -> format detectionService.
// Kunci HARUS persis sama dengan metadata.json "classes" (engine/models/kualitas_tanaman). Tes memeriksa kecocokannya.
// Kelas yang tidak ada di sini ditolak dengan error jelas oleh engine-provider (tidak ditebak).
//
// Catatan isi:
// - kategori_kualitas adalah penilaian kebijakan per kelas (bukan keluaran model): sehat = baik; penyakit/hama/hara = sedang;
//   kelas yang umumnya merusak berat (hawar daun, keriting kompleks murda) = buruk. Mohon ditinjau ahli agronomi.
// - Tingkat keparahan TIDAK bisa diturunkan dari kelas maupun skor, jadi selalu "sedang" dan ditandai sebagai perkiraan.
// - masalah = null untuk kelas sehat. Model tidak menguraikan gejala, jadi gejala_terlihat berisi keterangan netral.
export const SEVERITY_ESTIMATED = "sedang";
export const GEJALA_NETRAL = "Terdeteksi oleh model klasifikasi daun; model tidak menguraikan gejala secara rinci.";

export const LEAF_CLASS_MAP = {
  "cabai__cercospora": { crop: "cabai", kategori_kualitas: "sedang", masalah: { nama: "Bercak daun Cercospora", jenis: "penyakit" } },
  "cabai__healthy": { crop: "cabai", kategori_kualitas: "baik", masalah: null },
  "cabai__murda complex(mites,trips)": { crop: "cabai", kategori_kualitas: "buruk", masalah: { nama: "Keriting daun (kompleks murda: tungau dan thrips)", jenis: "hama" } },
  "cabai__nutritional": { crop: "cabai", kategori_kualitas: "sedang", masalah: { nama: "Gangguan hara (nutrisi)", jenis: "defisiensi_nutrisi" } },
  "cabai__powdery mildew": { crop: "cabai", kategori_kualitas: "sedang", masalah: { nama: "Embun tepung", jenis: "penyakit" } },
  "tomat__Bacterial spot": { crop: "tomat", kategori_kualitas: "sedang", masalah: { nama: "Bercak bakteri", jenis: "penyakit" } },
  "tomat__Black mold": { crop: "tomat", kategori_kualitas: "sedang", masalah: { nama: "Jamur hitam", jenis: "penyakit" } },
  "tomat__Gray spot": { crop: "tomat", kategori_kualitas: "sedang", masalah: { nama: "Bercak abu-abu", jenis: "penyakit" } },
  "tomat__Late blight": { crop: "tomat", kategori_kualitas: "buruk", masalah: { nama: "Hawar daun (late blight)", jenis: "penyakit" } },
  "tomat__health": { crop: "tomat", kategori_kualitas: "baik", masalah: null },
  "tomat__powdery mildew": { crop: "tomat", kategori_kualitas: "sedang", masalah: { nama: "Embun tepung", jenis: "penyakit" } },
};

/** Komoditas yang dilatih model (diturunkan dari peta di atas, sama dengan awalan kelas di metadata.json). */
export const TRAINED_CROPS = [...new Set(Object.values(LEAF_CLASS_MAP).map((v) => v.crop))];

/** Komoditas terlatih yang cocok dengan teks komoditas lahan (mis. "cabai merah" -> "cabai"); null bila tidak ada. */
export function findTrainedCrop(komoditas) {
  const k = String(komoditas ?? "").toLowerCase();
  return TRAINED_CROPS.find((c) => k.includes(c)) ?? null;
}
