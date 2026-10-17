/**
 * Daftar negara (kode ISO 3166-1 alpha-2) dan saran provinsi untuk formulir profil lahan.
 * Nilai yang dikirim ke backend selalu kode ISO; nama tampil dibuat oleh Intl.DisplayNames
 * menurut bahasa aktif, sehingga tidak perlu diterjemahkan oleh AutoTranslate.
 */
export type CountryLang = 'id' | 'en' | 'zh';
export interface CountryOption { code: string; label: string; }

export const DEFAULT_COUNTRY = 'ID';

/** Negara yang ditawarkan. Indonesia selalu ditampilkan paling atas oleh sortedCountries. */
export const COUNTRY_CODES: readonly string[] = [
  'ID', 'MY', 'SG', 'TH', 'VN', 'PH', 'BN', 'TL', 'KH', 'LA', 'MM',
  'IN', 'PK', 'BD', 'LK', 'CN', 'JP', 'KR', 'AU', 'NZ', 'PG',
  'SA', 'AE', 'EG', 'KE', 'NG', 'ZA',
  'US', 'CA', 'BR', 'GB', 'NL', 'DE', 'FR', 'ES', 'IT',
];

/** 5 provinsi yang dikenal model biaya; hanya dipakai sebagai saran untuk Indonesia. */
export const MODEL_PROVINCES: readonly string[] = ['Jawa Barat', 'Jawa Tengah', 'Jawa Timur', 'Sulawesi Selatan', 'Sumatera Utara'];

const INTL_LOCALE: Record<CountryLang, string> = { id: 'id', en: 'en', zh: 'zh-CN' };

/** Nama negara menurut bahasa; bila Intl.DisplayNames tidak ada atau tidak mengenal kode, kembalikan kodenya. */
export function countryLabel(code: string, lang: CountryLang): string {
  try {
    if (typeof Intl === 'undefined' || typeof Intl.DisplayNames !== 'function') return code;
    const name = new Intl.DisplayNames([INTL_LOCALE[lang] ?? 'id'], { type: 'region', fallback: 'code' }).of(code);
    return name && name.length > 0 ? name : code;
  } catch {
    return code;
  }
}

/** Indonesia di atas, sisanya urut menurut nama tampil sesuai aturan bahasa aktif. */
export function sortedCountries(lang: CountryLang, extraCodes: readonly string[] = []): CountryOption[] {
  const locale = INTL_LOCALE[lang] ?? 'id';
  // Kode tambahan (misalnya negara lahan yang tersimpan tetapi tidak ada di daftar) tetap tampil.
  const codes = Array.from(new Set([...COUNTRY_CODES, ...extraCodes.filter(Boolean)]));
  const rest = codes
    .filter(c => c !== DEFAULT_COUNTRY)
    .map(code => ({ code, label: countryLabel(code, lang) }))
    .sort((a, b) => a.label.localeCompare(b.label, locale) || a.code.localeCompare(b.code));
  return [{ code: DEFAULT_COUNTRY, label: countryLabel(DEFAULT_COUNTRY, lang) }, ...rest];
}

/** Saran provinsi untuk <datalist>: 5 provinsi model hanya untuk Indonesia, selain itu kosong. */
export function provinceSuggestions(country: string): string[] {
  return country === DEFAULT_COUNTRY ? [...MODEL_PROVINCES] : [];
}
