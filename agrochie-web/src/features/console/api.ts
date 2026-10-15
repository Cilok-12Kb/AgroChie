import { currentLang } from '../auth/copy'; // [REVISI] bahasa untuk field `lang` endpoint email
import { loginRedirectUrl, shouldRedirectOn401 } from '../auth/logic'; // [REVISI] 401 global
import { SERVER_MSG } from '../auth/serverMessages'; // [REVISI]

// [REVISI] 401 global: QueryProvider mendaftarkan fungsi pembersih cache akun; flag mencegah redirect ganda.
let onSessionExpired: (() => void) | null = null;
let redirectingToLogin = false;
export function setSessionExpiredHandler(fn: (() => void) | null) { onSessionExpired = fn; }
/** One network boundary for the frontend. Cookies remain httpOnly on the Express server. */
export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); this.name = 'ApiError'; }
}

export async function request<T>(path: string, init: RequestInit = {}, opts: { skipGlobal401?: boolean } = {}): Promise<T> { // [REVISI] opts.skipGlobal401
  const response = await fetch(`/api${path}`, {
    ...init,
    credentials: 'include',
    // [REVISI] FormData: jangan set Content-Type agar browser mengisi boundary multipart sendiri.
    headers: { ...(init.body && !(init.body instanceof FormData) ? { 'Content-Type': 'application/json' } : {}), ...init.headers },
    cache: 'no-store',
  });
  if (!response.ok) {
    let detail: { message?: string; error?: string } = {};
    try { detail = await response.json(); } catch { /* non-JSON 5xx */ }
    const message = detail.message ?? detail.error ?? `Permintaan gagal (${response.status})`;
    // [REVISI] sesi berakhir/dicabut: bersihkan cache akun lalu ke /masuk?next=... (sekali saja).
    if (typeof window !== 'undefined' && shouldRedirectOn401({
      status: response.status, message, requestPath: path, currentPath: window.location.pathname,
      redirecting: redirectingToLogin, wrongPassword: SERVER_MSG.wrongPassword, googleTokenInvalid: SERVER_MSG.googleTokenInvalid,
      skipGlobal401: opts.skipGlobal401,
    })) {
      redirectingToLogin = true;
      onSessionExpired?.();
      window.location.href = loginRedirectUrl(window.location.pathname, window.location.search);
    }
    throw new ApiError(response.status, message);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

const post = <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) });
const patch = <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) });
const put = <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) });

export type Crop = 'CABAI' | 'BAWANG' | 'TOMAT';
export type SeasonStatus = 'DRAFT' | 'PEMBIAYAAN' | 'TANAM' | 'PANEN' | 'SELESAI';
export type Level = 'RENDAH' | 'SEDANG' | 'TINGGI';
export type ExpenseCategory = 'BENIH' | 'PUPUK' | 'OBAT' | 'TENAGA_KERJA' | 'LAIN';
// [REVISI] Field auth baru (API_AUTH.md bagian 2). Opsional karena akun tamu hanya punya id, name, role, isGuest.
export interface Account {
  id: string; name: string; phone?: string | null; isGuest?: boolean; role: string;
  email?: string | null; emailVerified?: boolean; hasPassword?: boolean; hasGoogle?: boolean; needsProfileCompletion?: boolean;
}
export interface Farm {
  id: string; name: string; areaHa: string; userId: string;
  village?: string | null; subdistrict?: string | null; farmerGroup?: string | null;
  province?: string | null; soilType?: string | null; waterSource?: string | null;
  ph?: string | null; phMeasuredOn?: string | null;
  nitrogen?: Level | null; phosphorus?: Level | null; potassium?: Level | null;
  latitude?: string | null; longitude?: string | null;
  capitalJt?: string | null; sellPricePerKg?: string | null; profitTargetJt?: string | null;
  kelengkapan?: number; rentang_latih?: boolean;
}
// [REVISI] Satu elemen weeklyJt dari API; biaya_jt dalam juta rupiah.
export interface WeeklyCostItem { fase?: number; porsi?: number; minggu: number; biaya_jt: number | string; }
export interface CostPlan {
  id: string; kind: string; totalJt: string; p10Jt: string; p50Jt: string; p90Jt: string;
  capitalJt: string | null; shortfallJt: string; weeklyJt: WeeklyCostItem[]; // [REVISI] bentuk asli API: objek, bukan angka
  breakEvenPerKg: string | null; modelVersion: string; needsRecalc: boolean; createdAt: string;
}
export interface Season {
  id: string; farmId: string; crop: Crop; areaHa: string; status: SeasonStatus;
  financingStartedAt?: string | null; plantedOn?: string | null; closedAt?: string | null;
  capitalJt?: string | null; totalCostJt?: string | null;
  costPlan: CostPlan | null;
}
export interface Expense {
  id: string; seasonId: string; spentOn: string; category: ExpenseCategory;
  amountJt: string; note?: string | null; simulated: boolean;
}
export interface Harvest {
  id: string; seasonId: string; harvestedOn: string; grade: 'A' | 'B' | 'C' | 'SORTIRAN';
  weightKg: string; pricePerKg: string; buyer?: string | null;
}
export interface SeasonRecord {
  id: string; label?: string; crop: Crop; areaHa: string; durationWks: number;
  totalCostJt: string; quality: string; consentTraining: boolean;
  yieldKg?: string; pricePerKg?: string; seasonId: string;
}
export interface WeatherNow {
  tempC: number | null; windKmh: number | null; rainMm: number | null;
  time: string | null; source: string;
}
// [REVISI] cuaca musim: GET /seasons/:id/weather
export interface SeasonWeather {
  rainAvgMm: number | null; heavyRainWks: number; tempMaxAvg: number | null;
  weeksCounted: number; full: boolean; status?: 'not_started' | 'in_progress' | 'complete';
  source: string; weeks: Array<{ minggu: number; rainMm: number | null; tempMaxAvg: number | null }>;
}

// [REVISI] deteksi kualitas tanaman: /api/deteksi-tanaman
export type DetectionQuality = 'baik' | 'sedang' | 'buruk';
export type DetectionSeverity = 'ringan' | 'sedang' | 'berat';
export type DetectionPriority = 'segera' | 'minggu_ini' | 'pencegahan';
export interface DetectionProblem { nama: string; jenis: string; tingkat_keparahan: DetectionSeverity; gejala_terlihat: string }
export interface DetectionSolution {
  ringkasan: string; kemungkinan_penyebab: string[];
  langkah_penanganan: Array<{ urutan: number; langkah: string; prioritas: DetectionPriority }>;
  bahan_dan_alat: Array<{ nama: string; dosis_atau_jumlah: string; estimasi_biaya_min: number; estimasi_biaya_max: number }>;
  estimasi_total_biaya: { min: number; max: number; per_hektar_atau_per_lahan: string; asumsi: string[] }; // Rupiah penuh
  risiko_jika_tidak_ditangani: string; pencegahan: string[]; kapan_konsultasi_ahli: string;
}
export interface Detection {
  id: string; lahan_id: string; status: 'SELESAI' | 'TIDAK_YAKIN';
  alasan: string | null; pesan: string | null; provider: string; catatan: string | null; dibuat_pada: string; foto_url: string;
  sumber_deteksi?: { provider: string; model_versi: string | null } | null; // [REVISI] opsional
  hasil: { tanaman_terlihat?: boolean; kondisi: string; kategori_kualitas: DetectionQuality; skor_kepercayaan: number; masalah_terdeteksi: DetectionProblem[] } | null;
  solusi: DetectionSolution | null;
  biaya_jt: { min: string; max: string } | null;
  ke_catatan: { tersedia?: boolean; sudah_disimpan: boolean; alasan?: string | null; expense_id: string | null };
}
export interface DetectionPage { data: Detection[]; page: number; limit: number; total: number; total_halaman: number }

export const api = {
  auth: {
    me: () => request<Account>('/auth/me'),
    login: (identifier: string, password: string) => post<Account>('/auth/login', { identifier, password }), // [REVISI] identifier = HP atau email
    register: (name: string, phone: string, password: string) => post<Account>('/auth/register', { name, phone, password }),
    guest: async () => (await post<{ user: Account }>('/auth/guest', {})).user,
    logout: () => request<void>('/auth/logout', { method: 'POST' }),
    // [REVISI] Endpoint auth tambahan. Nilai sensitif (password, idToken, token) hanya dilewatkan, tidak disimpan/dicatat.
    google: (idToken: string) => post<Account>('/auth/google', { idToken }),
    googleLink: (idToken: string, password: string) => post<Account>('/auth/google/link', { idToken, password, lang: currentLang() }),
    setEmail: (email: string) => post<Account>('/auth/email', { email, lang: currentLang() }),
    // [REVISI] khusus alur daftar: 401 diperlakukan sebagai email gagal, bukan redirect global.
    setEmailAfterRegister: (email: string) => request<Account>('/auth/email', { method: 'POST', body: JSON.stringify({ email, lang: currentLang() }) }, { skipGlobal401: true }),
    resendVerification: () => post<{ ok: boolean }>('/auth/email/resend-verification', { lang: currentLang() }),
    verifyEmail: (token: string) => post<{ ok: boolean }>('/auth/verify-email', { token }),
    forgotPassword: (email: string) => post<{ ok: boolean; message: string }>('/auth/forgot-password', { email, lang: currentLang() }),
    resetPassword: (token: string, passwordBaru: string) => post<{ ok: boolean }>('/auth/reset-password', { token, passwordBaru, lang: currentLang() }),
  },
  farms: {
    list: () => request<Farm[]>('/farms'),
    create: (payload: object) => post<Farm>('/farms', payload),
    update: (id: string, payload: object) => patch<Farm>(`/farms/${id}`, payload),
  },
  seasons: {
    list: (farmId: string) => request<Season[]>(`/farms/${farmId}/seasons`),
    create: (farmId: string, crop: Crop) => post<Season>(`/farms/${farmId}/seasons`, { crop }),
    startFinancing: (id: string, body: object) => post<{ plan: CostPlan }>(`/seasons/${id}/start-financing`, body),
    startPlanting: (id: string, date: string) => post<{ season: Season }>(`/seasons/${id}/start-planting`, { plantedOn: date }),
    stopFinancing: (id: string) => post<Season>(`/seasons/${id}/stop-financing`, {}),
    recalc: (id: string, body: object) => post<{ plan: CostPlan }>(`/seasons/${id}/recalc-cost`, body),
    close: (id: string, body: object) => post<{ record: SeasonRecord; summary: object }>(`/seasons/${id}/close`, body),
  },
  expenses: {
    list: (seasonId: string) => request<Expense[]>(`/seasons/${seasonId}/expenses`),
    create: (seasonId: string, body: object) => post<Expense>(`/seasons/${seasonId}/expenses`, body),
    remove: (seasonId: string, id: string) => request<{ deleted: boolean }>(`/seasons/${seasonId}/expenses/${id}`, { method: 'DELETE' }),
  },
  photos: {
    list: (seasonId: string) => request<Array<{id:string;kind:string;objectKey:string;takenAt:string}>>(`/seasons/${seasonId}/photos`),
    upload: async (seasonId: string, file: File) => {
      const response = await fetch(`/api/seasons/${seasonId}/photos/upload`, {
        method: 'POST', credentials: 'include',
        headers: { 'Content-Type': 'application/octet-stream', 'X-Photo-Type': file.type },
        body: file,
      });
      if (!response.ok) {
        let data: { error?: string } = {};
        try { data = await response.json(); } catch { /* upstream unavailable */ }
        throw new ApiError(response.status, data.error ?? 'Gagal mengunggah foto');
      }
      return response.json() as Promise<{id: string; kind: string}>;
    },
    fileUrl: (seasonId: string, photoId: string) => `/api/seasons/${seasonId}/photos/${photoId}/file`,
  },
  checklist: {
    get: (seasonId: string, week: number) => request<{week:number;items:{key:string;done:boolean}[]}>(`/seasons/${seasonId}/checklist?week=${week}`),
    set: (seasonId: string, week: number, key: string, done: boolean) => put<{week:number;key:string;done:boolean}>(`/seasons/${seasonId}/checklist/${key}`, {week,done}),
  },
  loans: {
    list: (seasonId: string) => request<Array<{id:string;amountJt:string;tenorWeeks:number;purpose:string;status:string;referralCode:string;expiresAt:string}>>(`/seasons/${seasonId}/loans`),
    create: (seasonId: string, body: object) => post<{id:string;referralCode:string}>(`/seasons/${seasonId}/loans`,body),
  },
  harvests: {
    getSample: (seasonId: string) => request<{sampleKg:string;sampleM2:string;mismatchOver30:boolean}|null>(`/seasons/${seasonId}/sample`),
    list: (seasonId: string) => request<Harvest[]>(`/seasons/${seasonId}/harvests`),
    create: (seasonId: string, body: object) => post<Harvest>(`/seasons/${seasonId}/harvests`, body),
    sample: (seasonId: string, body: object) => put<object>(`/seasons/${seasonId}/sample`, body),
  },
  history: { list: () => request<SeasonRecord[]>('/history') },
  assistant: { chat: (message: string, seasonId?: string, sessionId?: string, farmId?: string) => post<{ answer: string; sessionId: string; sources: unknown[] }>('/assistant/chat', { message, seasonId, sessionId, farmId, lang: currentLang() }) }, // [REVISI] farmId dan bahasa aktif
  detection: {
    analyze: (farmId: string, file: File, note?: string) => {
      const form = new FormData();
      form.append('lahan_id', farmId);
      if (note?.trim()) form.append('catatan', note.trim());
      form.append('lang', currentLang());
      form.append('foto', file); // file terakhir agar field teks terbaca lebih dulu oleh multer
      return request<Detection>('/deteksi-tanaman', { method: 'POST', body: form });
    },
    list: (farmId: string, page = 1, limit = 10) => request<DetectionPage>(`/deteksi-tanaman?lahan_id=${encodeURIComponent(farmId)}&page=${page}&limit=${limit}`),
    get: (id: string) => request<Detection>(`/deteksi-tanaman/${encodeURIComponent(id)}`),
    photoUrl: (id: string) => `/api/deteksi-tanaman/${encodeURIComponent(id)}/foto`,
    toNote: (id: string) => request<{ expense_id: string; musim_id: string; kategori: string; jumlah_jt: string; tanggal: string; catatan: string }>(`/deteksi-tanaman/${encodeURIComponent(id)}/ke-catatan`, { method: 'POST' }),
  },
  weather: {
    season: (seasonId: string) => request<SeasonWeather>(`/seasons/${seasonId}/weather`), // [REVISI]
    current: (latitude: number, longitude: number) => request<WeatherNow>(`/weather/current?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`),
    forecast: (latitude: number, longitude: number) => request<{source:string;days:Array<{date:string;rainMm:number|null;maxTempC:number|null}>}>(`/weather/forecast?latitude=${encodeURIComponent(latitude)}&longitude=${encodeURIComponent(longitude)}`),
  },
};

export const CROP_NAME: Record<Crop, string> = { CABAI: 'Cabai merah', BAWANG: 'Bawang merah', TOMAT: 'Tomat' };
export const CROP_WEEKS: Record<Crop, number> = { CABAI: 16, BAWANG: 10, TOMAT: 14 };
export const CATEGORY_NAME: Record<ExpenseCategory, string> = { BENIH: 'Benih & bibit', PUPUK: 'Pupuk', OBAT: 'Obat & pestisida', TENAGA_KERJA: 'Tenaga kerja', LAIN: 'Lain-lain' };
export const JUTA = 1_000_000;
export const amount = (value?: string | number | null) => Number(value ?? 0);
// [REVISI] Baca weeklyJt dengan aman. Bila bukan array, kosong, atau ada elemen tak valid
// (minggu bukan bilangan bulat >= 1, biaya_jt bukan angka hingga >= 0), kembalikan [] agar UI menampilkan keadaan kosong.
export const weeklyCosts = (raw: unknown): Array<{ minggu: number; biaya: number }> => {
  if (!Array.isArray(raw) || raw.length === 0) return [];
  const out: Array<{ minggu: number; biaya: number }> = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') return [];
    const { minggu, biaya_jt } = item as { minggu?: unknown; biaya_jt?: unknown };
    const m = typeof minggu === 'number' ? minggu : NaN;
    const b = typeof biaya_jt === 'number' || (typeof biaya_jt === 'string' && biaya_jt.trim() !== '') ? Number(biaya_jt) : NaN;
    if (!Number.isInteger(m) || m < 1 || !Number.isFinite(b) || b < 0) return [];
    out.push({ minggu: m, biaya: b });
  }
  return out.sort((a, b) => a.minggu - b.minggu);
};
export const rupiah = (juta?: string | number | null) => `Rp ${amount(juta).toLocaleString('id-ID', { maximumFractionDigits: 2 })} jt`;
export const idr = (value: number) => `Rp ${Math.round(value).toLocaleString('id-ID')}`;
export const shortDate = (value?: string | null) => value ? new Date(value).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric' }) : '—';
export const dateOnly = (date = new Date()) => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Jakarta', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(date);
  const get = (type: string) => parts.find(p => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')}`;
};
export const percent = (part: number, total: number) => total ? Math.min(100, Math.round(part / total * 100)) : 0;
