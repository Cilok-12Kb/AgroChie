import { Prisma } from "@prisma/client";

// [REVISI] Biaya hasil AI deteksi tanaman. Gemini memberi Rupiah penuh; aplikasi menyimpan juta Rupiah (Decimal).
// Angka ini estimasi rentang, BUKAN biaya mingguan dan tidak boleh dipakai sebagai itu.
export const MAX_RUPIAH = 100_000_000_000; // 100.000 juta, sama dengan MAX_AMOUNT_JT di expense.validator.js
const JT = new Prisma.Decimal(1_000_000);

/** Memastikan Rupiah penuh sah: angka terhingga, tidak negatif, tidak melewati batas. Mengembalikan bilangan bulat. */
export function assertRupiah(v, label = "nilai") {
  if (typeof v !== "number" || !Number.isFinite(v)) throw new RangeError(`${label} harus berupa angka`);
  if (v < 0) throw new RangeError(`${label} tidak boleh negatif`);
  if (v > MAX_RUPIAH) throw new RangeError(`${label} melebihi batas wajar`);
  return Math.round(v);
}

/** Rupiah penuh -> Decimal juta Rupiah (3 desimal, sesuai kolom Decimal(10,3)). min dibulatkan turun, max naik. */
export function rupiahToJt(rp, mode = "down") {
  const n = new Prisma.Decimal(assertRupiah(rp));
  return n.div(JT).toDecimalPlaces(3, mode === "up" ? Prisma.Decimal.ROUND_UP : Prisma.Decimal.ROUND_DOWN);
}

/**
 * Memeriksa tiap bahan (min <= max, tidak negatif), menghitung ulang total dari jumlah bahan, dan membandingkan dengan
 * total klaim AI. Total server selalu dipakai. Melempar RangeError bila ada bahan tidak sah.
 * Mengembalikan { bahan, total: {min, max}, dikoreksi: boolean, catatan: string[] }.
 */
export function recalculateCost(bahan, claimedTotal) {
  if (!Array.isArray(bahan)) throw new RangeError("bahan_dan_alat harus berupa daftar");
  let min = 0;
  let max = 0;
  const clean = bahan.map((b, i) => {
    const lo = assertRupiah(b?.estimasi_biaya_min, `bahan ${i + 1}: estimasi_biaya_min`);
    const hi = assertRupiah(b?.estimasi_biaya_max, `bahan ${i + 1}: estimasi_biaya_max`);
    if (lo > hi) throw new RangeError(`bahan ${i + 1}: estimasi_biaya_min lebih besar dari estimasi_biaya_max`);
    min += lo;
    max += hi;
    return { ...b, estimasi_biaya_min: lo, estimasi_biaya_max: hi };
  });
  if (min > MAX_RUPIAH || max > MAX_RUPIAH) throw new RangeError("total biaya melebihi batas wajar");
  const catatan = [];
  if (claimedTotal) {
    const cMin = Number(claimedTotal.min);
    const cMax = Number(claimedTotal.max);
    if (!Number.isFinite(cMin) || !Number.isFinite(cMax) || cMin < 0 || cMax < 0 || cMin > cMax) {
      catatan.push("Rentang total dari AI tidak sah; dihitung ulang dari jumlah bahan.");
    } else if (Math.round(cMin) !== min || Math.round(cMax) !== max) {
      catatan.push("Total dari AI tidak sama dengan jumlah bahan; dihitung ulang dari jumlah bahan.");
    }
  }
  return { bahan: clean, total: { min, max }, dikoreksi: catatan.length > 0, catatan };
}

// Urutan penting: yang lebih spesifik dulu.
const CATEGORY_RULES = [
  ["BENIH", /\b(benih|bibit|semai|seed|seeds|seedling|seedlings|nursery)\b|种子|种苗|幼苗/],
  ["TENAGA_KERJA", /\b(tenaga|upah|buruh|jasa|ongkos kerja|hok|labor|labour|worker|workers|wage|wages)\b|人工|工钱|工资/],
  ["PUPUK", /(pupuk|npk|urea|\bza\b|\bsp-?36\b|kcl|kompos|kandang|dolomit|kapur|kalsium|kalium|nitrogen|fosfat|magnesium|boron|zpt|pelet organik|pembenah tanah|fertili[sz]er|compost|manure|lime|calcium|potassium|phosphate|soil amendment|肥料|堆肥|粪肥|石灰|钙|钾|磷肥|土壤改良剂)/],
  ["OBAT", /(fungisida|insektisida|akarisida|bakterisida|nematisida|moluskisida|pestisida|herbisida|obat|pengendali|perangkap|perekat|surfaktan|sabun|nabati|agens hayati|trichoderma|bakteri antagonis|semprot|fungicide|insecticide|acaricide|bactericide|nematicide|molluscicide|pesticide|herbicide|biocontrol|trap|spray|杀菌剂|杀虫剂|杀螨剂|杀线虫剂|农药|除草剂|生物防治|诱捕器|喷雾)/],
];

/** Kategori Expense (enum ExpenseCategory) untuk satu bahan, dari namanya. Tidak cocok -> LAIN. */
export function categoryForItem(nama) {
  const t = String(nama ?? "").toLowerCase();
  for (const [cat, re] of CATEGORY_RULES) if (re.test(t)) return cat;
  return "LAIN";
}

/**
 * Kategori Expense untuk seluruh rekomendasi: kategori dengan jumlah nilai tengah rentang ((min+max)/2) terbesar.
 * Seri atau tanpa bahan -> LAIN. Mengembalikan { kategori, rincian: {KATEGORI: nilaiTengahRp} }.
 */
export function expenseCategoryFor(bahan) {
  const rincian = {};
  for (const b of bahan ?? []) {
    const mid = (Number(b.estimasi_biaya_min) + Number(b.estimasi_biaya_max)) / 2;
    const cat = categoryForItem(b.nama);
    rincian[cat] = (rincian[cat] ?? 0) + (Number.isFinite(mid) ? mid : 0);
  }
  const ranked = Object.entries(rincian).sort((a, b) => b[1] - a[1]);
  if (!ranked.length || ranked[0][1] <= 0) return { kategori: "LAIN", rincian };
  if (ranked[1] && ranked[1][1] === ranked[0][1]) return { kategori: "LAIN", rincian };
  return { kategori: ranked[0][0], rincian };
}
