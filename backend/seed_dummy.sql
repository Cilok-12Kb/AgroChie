-- ============================================================
-- DATA DUMMY: Budi Santoso, petani cabai Magelang
-- Login: phone=085712345678 | password=tani1234
-- ============================================================

DO $$
DECLARE
  v_user_id   TEXT;
  v_farm_id   TEXT;
  v_season_id TEXT;
BEGIN

-- 1. User
INSERT INTO users (id, name, phone, email, "passwordHash", role, "isGuest", "createdAt")
VALUES (
  'cm_budi_001',
  'Budi Santoso',
  '085712345678',
  NULL,
  '$argon2id$v=19$m=65536,p=4,t=3$FbiumKfilfEILRJGci78sA$OToXwtcCNnwqotW7wJvsqqWD3HOpaA65pSU2YcGXfN8',
  'PETANI',
  false,
  NOW()
) ON CONFLICT (phone) DO NOTHING;

SELECT id INTO v_user_id FROM users WHERE phone = '085712345678';
RAISE NOTICE 'user_id = %', v_user_id;

-- 2. Farm
INSERT INTO farms (
  id, "userId", name, village, subdistrict, province, "areaHa",
  "soilType", "waterSource", ph, "phMeasuredOn",
  nitrogen, phosphorus, potassium,
  "capitalJt", "sellPricePerKg", "profitTargetJt",
  latitude, longitude
) VALUES (
  'farm_budi_001',
  v_user_id,
  'Lahan Sawah Budi',
  'Ngablak',
  'Ngablak',
  'Jawa Tengah',
  0.75,
  'Lempung berdebu',
  'Irigasi',
  6.5,
  '2026-09-10',
  'SEDANG',
  'SEDANG',
  'TINGGI',
  30.00,
  28000,
  8.00,
  -7.476900,
  110.387800
) ON CONFLICT (id) DO NOTHING;

SELECT id INTO v_farm_id FROM farms WHERE "userId" = v_user_id LIMIT 1;
RAISE NOTICE 'farm_id = %', v_farm_id;

-- 3. Season aktif (TANAM, minggu ke-4 dari 16)
INSERT INTO seasons (
  id, "farmId", crop, "areaHa", status,
  "capitalJt", "sellPricePerKg", "profitTargetJt",
  "financingStartedAt", "plantedOn"
) VALUES (
  'season_budi_001',
  v_farm_id,
  'CABAI',
  0.75,
  'TANAM',
  30.00,
  28000,
  8.00,
  '2026-09-12 07:00:00',
  '2026-09-15'
) ON CONFLICT (id) DO NOTHING;

SELECT id INTO v_season_id FROM seasons WHERE "farmId" = v_farm_id LIMIT 1;
RAISE NOTICE 'season_id = %', v_season_id;

-- 4. CostPlan (estimasi awal pembiayaan)
INSERT INTO cost_plans (
  id, "seasonId", kind, "totalJt", "p10Jt", "p50Jt", "p90Jt",
  "capitalJt", "shortfallJt", "weeklyJt", "modelVersion", "needsRecalc", "createdAt"
) VALUES (
  'plan_budi_001',
  v_season_id,
  'AWAL',
  24.50,
  20.20,
  24.50,
  29.80,
  30.00,
  0.00,
  '[1.2,1.3,1.4,1.5,1.6,1.7,1.8,1.7,1.6,1.5,1.4,1.3,1.2,1.1,1.0,0.9]',
  'rule-baseline-v1',
  false,
  NOW()
) ON CONFLICT (id) DO NOTHING;

-- 5. Catatan pengeluaran nyata minggu 1-4
INSERT INTO expenses (id, "seasonId", "spentOn", category, "amountJt", note, simulated, "createdAt")
VALUES
  ('exp_b_01', v_season_id, '2026-09-15', 'BENIH',        0.850, 'Benih cabai F1 Dewata 20 sachet @Rp 42.500', false, NOW()),
  ('exp_b_02', v_season_id, '2026-09-16', 'TENAGA_KERJA', 0.600, 'Upah olah lahan 3 orang x 2 hari @Rp 100.000/hari', false, NOW()),
  ('exp_b_03', v_season_id, '2026-09-18', 'PUPUK',        0.750, 'Pupuk kandang 1 ton + TSP 50 kg', false, NOW()),
  ('exp_b_04', v_season_id, '2026-09-22', 'PUPUK',        0.480, 'NPK Phonska 2 sak 50 kg @Rp 240.000/sak', false, NOW()),
  ('exp_b_05', v_season_id, '2026-09-25', 'TENAGA_KERJA', 0.450, 'Upah tanam bibit 0.75 ha borongan', false, NOW()),
  ('exp_b_06', v_season_id, '2026-09-29', 'OBAT',         0.320, 'Fungisida Dithane M-45 + Previcur N', false, NOW()),
  ('exp_b_07', v_season_id, '2026-10-03', 'PUPUK',        0.540, 'Pupuk susulan KCl 25 kg + Urea 25 kg', false, NOW()),
  ('exp_b_08', v_season_id, '2026-10-06', 'TENAGA_KERJA', 0.300, 'Penyiangan manual + pasang ajir bambu', false, NOW()),
  ('exp_b_09', v_season_id, '2026-10-09', 'OBAT',         0.280, 'Akarisida Omite + Bakterisida Agrept', false, NOW()),
  ('exp_b_10', v_season_id, '2026-10-11', 'LAIN',         0.180, 'Tali rafia 2 gulung + plastik mulsa tambahan', false, NOW())
ON CONFLICT (id) DO NOTHING;

RAISE NOTICE '=== SELESAI === user=%, farm=%, season=%', v_user_id, v_farm_id, v_season_id;

END
$$;
