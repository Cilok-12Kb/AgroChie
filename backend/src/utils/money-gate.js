// [REVISI] 18.11: gerbang uang (Q5). SATU-SATUNYA tempat yang memutuskan apakah angka hasil prediksi boleh keluar.
// Fungsi murni: tidak membaca DB, tidak mengubah masukan. Penyaringan hanya di lapisan respons;
// baris CostPlan di database tidak disentuh (Q8: riwayat tetap ada walau status kembali DRAFT).

/** Angka prediksi hanya boleh tampil bila pembiayaan sudah dimulai (status selain DRAFT). */
export const predictionVisible = (status) => status !== "DRAFT";

/**
 * Pagar untuk CostPlan mentah (dipakai ringkasan pengeluaran dan asisten).
 * DRAFT atau tanpa plan -> null; selain itu plan dikembalikan apa adanya (objek yang sama, tidak disalin).
 */
export function redactPlan(status, plan) {
  return plan && predictionVisible(status) ? plan : null;
}

// Kolom CostPlan yang boleh dikirim ke klien. `input` (masukan engine) sengaja tidak ikut.
export const PLAN_PUBLIC_FIELDS = [
  "id", "kind", "totalJt", "p10Jt", "p50Jt", "p90Jt", "capitalJt", "shortfallJt",
  "breakEvenPerKg", "weeklyJt", "needsRecalc", "modelVersion", "createdAt",
];

/**
 * Bentuk respons Season. Masukan: baris Season dengan `costPlans` (CostPlan terbaru, 0 atau 1 elemen; boleh tidak ada).
 * Keluaran: salinan Season tanpa `costPlans`, ditambah `costPlan`:
 *  - DRAFT atau belum ada plan -> null (angka prediksi, termasuk needsRecalc, tidak keluar);
 *  - selain itu -> kolom publik plan terbaru.
 * Field milik petani (capitalJt, sellPricePerKg, profitTargetJt, financingStoppedAt, dll.) selalu ikut.
 */
export function seasonView(season) {
  if (!season) return season;
  const { costPlans, ...rest } = season;
  const plan = redactPlan(season.status, Array.isArray(costPlans) ? costPlans[0] ?? null : null);
  const costPlan = plan ? Object.fromEntries(PLAN_PUBLIC_FIELDS.filter((k) => k in plan).map((k) => [k, plan[k]])) : null;
  return { ...rest, costPlan };
}
