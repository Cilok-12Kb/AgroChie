CREATE VIEW dataset_latih AS
SELECT
  r."anonId"                         AS musim_id,
  lower(r."crop"::text)              AS komoditas,
  r."areaHa"                         AS luas_ha,
  r."soilType"                       AS jenis_tanah,
  r."waterSource"                    AS sumber_air,
  r."province"                       AS provinsi,
  r."startMonth"                     AS bulan_tanam,
  r."rainAvgMm"                      AS hujan_mm_rata_per_minggu,
  r."heavyRainWks"                   AS minggu_hujan_lebat,
  r."tempMaxAvg"                     AS suhu_maks_rata,
  r."ph"                             AS ph,
  lower(r."phosphorus"::text)        AS fosfor,
  lower(r."nitrogen"::text)          AS nitrogen,
  lower(r."potassium"::text)         AS kalium,
  r."fertIndex"                      AS indeks_harga_pupuk,
  r."wageIndex"                      AS indeks_upah,
  r."pestIndex"                      AS indeks_harga_pestisida,
  g.w                                AS minggu_ke,
  r."durationWks"                    AS durasi_musim,
  round(g.w::numeric / r."durationWks", 3) AS posisi_relatif,
  p."phase"                          AS fase,
  g.w - p."startWeek" + 1            AS minggu_dalam_fase,
  p."lengthWks"                      AS jumlah_minggu_fase,
  ((r."startMonth" - 1 + (g.w - 1) / 4) % 12) + 1 AS bulan_kalender_minggu,
  c."avgRainMm"                      AS hujan_mm_minggu_klimatologi,
  (p."phase" = 2 AND g.w = p."startWeek")::int AS ada_tanam,
  (p."phase" = 1 AND g.w = p."endWeek")::int   AS ada_pupuk_dasar,
  (p."phase" = 4)::int               AS ada_panen,
  r."totalCostJt"                    AS biaya_total_juta,
  wc."costJt"                        AS biaya_minggu_juta,
  round(wc."costJt" / r."totalCostJt", 5) AS porsi_minggu,
  'nyata'::text                      AS sumber
FROM season_records r
CROSS JOIN LATERAL generate_series(1, r."durationWks") AS g(w)
JOIN crop_phases p
  ON p."crop" = r."crop" AND g.w BETWEEN p."startWeek" AND p."endWeek"
JOIN climate_rain c
  ON c."province" = r."province"
 AND c."month" = ((r."startMonth" - 1 + (g.w - 1) / 4) % 12) + 1
LEFT JOIN weekly_costs wc
  ON wc."recordId" = r."id" AND wc."week" = g.w
WHERE r."quality" IN ('SIAP_DILATIH', 'TOTAL_SAJA')
  AND r."consentTraining" = true;