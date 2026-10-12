import type { MoneyIDR } from '@/domain/models/types';

/**
 * Format angka rupiah ke string Indonesia.
 * Contoh: 42000000 → "Rp 42.000.000"
 */
export function formatRupiah(amount: MoneyIDR, compact = false): string {
  if (compact) {
    if (amount >= 1_000_000_000) {
      return `Rp ${(amount / 1_000_000_000).toFixed(1)} M`;
    }
    if (amount >= 1_000_000) {
      return `Rp ${(amount / 1_000_000).toFixed(1)} jt`;
    }
    if (amount >= 1_000) {
      return `Rp ${(amount / 1_000).toFixed(0)} rb`;
    }
  }
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

/**
 * Format rupiah dalam satuan juta dengan 2 desimal.
 * Contoh: 42000000 → "42,00 juta"
 */
export function formatJuta(amount: MoneyIDR): string {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount / 1_000_000) + ' juta';
}

/**
 * Format persentase.
 * Contoh: 0.35 → "35%"
 */
export function formatPersen(value: number, decimals = 0): string {
  return new Intl.NumberFormat('id-ID', {
    style: 'percent',
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format angka desimal umum.
 */
export function formatNumber(value: number, decimals = 0): string {
  return new Intl.NumberFormat('id-ID', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

/**
 * Format berat dalam kg.
 */
export function formatKg(kg: number): string {
  if (kg >= 1000) return `${formatNumber(kg / 1000, 2)} ton`;
  return `${formatNumber(kg, 1)} kg`;
}

/**
 * Label kategori pengeluaran dalam bahasa Indonesia.
 */
export const EXPENSE_CATEGORY_LABELS: Record<string, string> = {
  seed: 'Benih dan bibit',
  fertilizer: 'Pupuk',
  pesticide: 'Obat hama dan penyakit',
  labor: 'Tenaga kerja',
  other: 'Lain-lain',
};

/**
 * Label komoditas.
 */
export const CROP_LABELS: Record<string, string> = {
  cabai: 'Cabai merah',
  tomat: 'Tomat',
  bawang: 'Bawang merah',
};

/**
 * Label jenis tanah.
 */
export const SOIL_TYPE_LABELS: Record<string, string> = {
  lempung: 'Lempung',
  lempung_berpasir: 'Lempung berpasir',
  lempung_berliat: 'Lempung berliat',
  andisol: 'Andisol',
  latosol: 'Latosol',
};

/**
 * Label sumber air.
 */
export const WATER_SOURCE_LABELS: Record<string, string> = {
  irigasi_teknis: 'Irigasi teknis',
  tadah_hujan: 'Tadah hujan',
  sumur: 'Sumur',
  sungai: 'Sungai',
};

/**
 * Label provinsi.
 */
export const PROVINCE_LABELS: Record<string, string> = {
  jawa_barat: 'Jawa Barat',
  jawa_tengah: 'Jawa Tengah',
  jawa_timur: 'Jawa Timur',
  sumatera_utara: 'Sumatera Utara',
  sulawesi_selatan: 'Sulawesi Selatan',
};

/**
 * Label status musim.
 */
export const SEASON_STATUS_LABELS: Record<string, string> = {
  draft: 'Belum mulai',
  financing: 'Pembiayaan aktif',
  planting: 'Sedang tanam',
  closed: 'Musim selesai',
};

/**
 * Label nutrisi.
 */
export const NUTRIENT_LABELS: Record<string, string> = {
  rendah: 'Rendah',
  sedang: 'Sedang',
  tinggi: 'Tinggi',
};

/**
 * Label kualitas panen.
 */
export const HARVEST_QUALITY_LABELS: Record<string, string> = {
  A: 'Kualitas A (Premium)',
  B: 'Kualitas B (Standar)',
  C: 'Kualitas C (Sortiran)',
};
