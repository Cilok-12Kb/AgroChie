-- CreateEnum
CREATE TYPE "Role" AS ENUM ('PETANI', 'PETUGAS_BANK');

-- CreateEnum
CREATE TYPE "Crop" AS ENUM ('CABAI', 'BAWANG', 'TOMAT');

-- CreateEnum
CREATE TYPE "Level" AS ENUM ('RENDAH', 'SEDANG', 'TINGGI');

-- CreateEnum
CREATE TYPE "SeasonStatus" AS ENUM ('DRAFT', 'PEMBIAYAAN', 'TANAM', 'PANEN', 'SELESAI');

-- CreateEnum
CREATE TYPE "ExpenseCategory" AS ENUM ('BENIH', 'PUPUK', 'OBAT', 'TENAGA_KERJA', 'LAIN');

-- CreateEnum
CREATE TYPE "HarvestGrade" AS ENUM ('A', 'B', 'C', 'SORTIRAN');

-- CreateEnum
CREATE TYPE "PhotoKind" AS ENUM ('PROGRES', 'SAMPEL');

-- CreateEnum
CREATE TYPE "LoanStatus" AS ENUM ('DIAJUKAN', 'DIPERIKSA_BANK', 'DISETUJUI', 'DITOLAK');

-- CreateEnum
CREATE TYPE "DataQuality" AS ENUM ('SIAP_DILATIH', 'TOTAL_SAJA', 'BELUM_LENGKAP', 'CONTOH');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT,
    "email" TEXT,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL DEFAULT 'PETANI',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "farms" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL DEFAULT 'Lahan utama',
    "village" TEXT,
    "subdistrict" TEXT,
    "farmerGroup" TEXT,
    "province" TEXT,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "boundary" JSONB,
    "areaHa" DECIMAL(4,2) NOT NULL,
    "soilType" TEXT,
    "waterSource" TEXT,
    "ph" DECIMAL(3,1),
    "phMeasuredOn" DATE,
    "nitrogen" "Level",
    "phosphorus" "Level",
    "potassium" "Level",
    "note" TEXT,

    CONSTRAINT "farms_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seasons" (
    "id" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "crop" "Crop" NOT NULL,
    "areaHa" DECIMAL(4,2) NOT NULL,
    "status" "SeasonStatus" NOT NULL DEFAULT 'DRAFT',
    "capitalJt" DECIMAL(10,2),
    "sellPricePerKg" DECIMAL(12,2),
    "profitTargetJt" DECIMAL(10,2),
    "financingStartedAt" TIMESTAMP(3),
    "plantedOn" DATE,
    "closedAt" TIMESTAMP(3),
    "totalCostJt" DECIMAL(10,2),
    "closingNote" TEXT,

    CONSTRAINT "seasons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_plans" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'AWAL',
    "totalJt" DECIMAL(10,2) NOT NULL,
    "p10Jt" DECIMAL(10,2) NOT NULL,
    "p50Jt" DECIMAL(10,2) NOT NULL,
    "p90Jt" DECIMAL(10,2) NOT NULL,
    "capitalJt" DECIMAL(10,2),
    "shortfallJt" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "breakEvenPerKg" DECIMAL(12,2),
    "weeklyJt" JSONB NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "spentOn" DATE NOT NULL,
    "category" "ExpenseCategory" NOT NULL,
    "amountJt" DECIMAL(10,3) NOT NULL,
    "note" TEXT,
    "simulated" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "harvests" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "harvestedOn" DATE NOT NULL,
    "grade" "HarvestGrade" NOT NULL,
    "weightKg" DECIMAL(10,2) NOT NULL,
    "pricePerKg" DECIMAL(12,2) NOT NULL,
    "buyer" TEXT,

    CONSTRAINT "harvests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "harvest_samples" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "sampleKg" DECIMAL(10,2) NOT NULL,
    "sampleM2" DECIMAL(10,2) NOT NULL,
    "mismatchOver30" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "harvest_samples_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "photos" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "kind" "PhotoKind" NOT NULL,
    "objectKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "latitude" DECIMAL(9,6),
    "longitude" DECIMAL(9,6),
    "takenAt" TIMESTAMP(3) NOT NULL,
    "seasonWeek" INTEGER,
    "insideBoundary" BOOLEAN,

    CONSTRAINT "photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "season_records" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "anonId" TEXT NOT NULL,
    "label" TEXT,
    "crop" "Crop" NOT NULL,
    "areaHa" DECIMAL(5,2) NOT NULL,
    "soilType" TEXT,
    "waterSource" TEXT,
    "province" TEXT,
    "startMonth" INTEGER,
    "rainAvgMm" DECIMAL(6,1),
    "heavyRainWks" INTEGER,
    "tempMaxAvg" DECIMAL(4,1),
    "ph" DECIMAL(3,1),
    "nitrogen" "Level",
    "phosphorus" "Level",
    "potassium" "Level",
    "fertIndex" DECIMAL(5,1),
    "wageIndex" DECIMAL(5,1),
    "pestIndex" DECIMAL(5,1),
    "durationWks" INTEGER NOT NULL,
    "totalCostJt" DECIMAL(10,2),
    "yieldKg" DECIMAL(10,2),
    "pricePerKg" DECIMAL(12,2),
    "note" TEXT,
    "quality" "DataQuality" NOT NULL DEFAULT 'BELUM_LENGKAP',
    "consentTraining" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "season_records_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "weekly_costs" (
    "recordId" TEXT NOT NULL,
    "week" INTEGER NOT NULL,
    "costJt" DECIMAL(10,3),

    CONSTRAINT "weekly_costs_pkey" PRIMARY KEY ("recordId","week")
);

-- CreateTable
CREATE TABLE "reminders" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "weekday" INTEGER NOT NULL DEFAULT 1,
    "timeOfDay" TEXT NOT NULL DEFAULT '06:00',
    "streak" INTEGER NOT NULL DEFAULT 0,
    "lastNotifiedOn" DATE,

    CONSTRAINT "reminders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reminder_checks" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "weekNo" INTEGER NOT NULL,
    "itemKey" TEXT NOT NULL,
    "doneAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reminder_checks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "loan_applications" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT NOT NULL,
    "amountJt" DECIMAL(10,2) NOT NULL,
    "tenorWeeks" INTEGER NOT NULL,
    "purpose" TEXT,
    "neededFromWeek" INTEGER,
    "scoreSnapshot" INTEGER,
    "status" "LoanStatus" NOT NULL DEFAULT 'DIAJUKAN',
    "referralCode" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consentShare" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "decidedAt" TIMESTAMP(3),

    CONSTRAINT "loan_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "prediction_logs" (
    "id" TEXT NOT NULL,
    "seasonId" TEXT,
    "input" JSONB NOT NULL,
    "output" JSONB NOT NULL,
    "modelVersion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "prediction_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crop_phases" (
    "crop" "Crop" NOT NULL,
    "phase" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "lengthWks" INTEGER NOT NULL,
    "startWeek" INTEGER NOT NULL,
    "endWeek" INTEGER NOT NULL,
    "costShare" DECIMAL(3,2) NOT NULL,

    CONSTRAINT "crop_phases_pkey" PRIMARY KEY ("crop","phase")
);

-- CreateTable
CREATE TABLE "climate_rain" (
    "province" TEXT NOT NULL,
    "month" INTEGER NOT NULL,
    "avgRainMm" DECIMAL(5,1) NOT NULL,

    CONSTRAINT "climate_rain_pkey" PRIMARY KEY ("province","month")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_phone_key" ON "users"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "farms_userId_idx" ON "farms"("userId");

-- CreateIndex
CREATE INDEX "seasons_farmId_status_idx" ON "seasons"("farmId", "status");

-- CreateIndex
CREATE INDEX "cost_plans_seasonId_createdAt_idx" ON "cost_plans"("seasonId", "createdAt");

-- CreateIndex
CREATE INDEX "expenses_seasonId_spentOn_idx" ON "expenses"("seasonId", "spentOn");

-- CreateIndex
CREATE INDEX "harvests_seasonId_idx" ON "harvests"("seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "harvest_samples_seasonId_key" ON "harvest_samples"("seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "photos_sha256_key" ON "photos"("sha256");

-- CreateIndex
CREATE INDEX "photos_seasonId_kind_idx" ON "photos"("seasonId", "kind");

-- CreateIndex
CREATE UNIQUE INDEX "season_records_seasonId_key" ON "season_records"("seasonId");

-- CreateIndex
CREATE UNIQUE INDEX "season_records_anonId_key" ON "season_records"("anonId");

-- CreateIndex
CREATE UNIQUE INDEX "reminders_userId_key" ON "reminders"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "reminder_checks_seasonId_weekNo_itemKey_key" ON "reminder_checks"("seasonId", "weekNo", "itemKey");

-- CreateIndex
CREATE UNIQUE INDEX "loan_applications_referralCode_key" ON "loan_applications"("referralCode");

-- CreateIndex
CREATE INDEX "loan_applications_seasonId_idx" ON "loan_applications"("seasonId");

-- CreateIndex
CREATE INDEX "prediction_logs_seasonId_createdAt_idx" ON "prediction_logs"("seasonId", "createdAt");

-- AddForeignKey
ALTER TABLE "farms" ADD CONSTRAINT "farms_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seasons" ADD CONSTRAINT "seasons_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_plans" ADD CONSTRAINT "cost_plans_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "harvests" ADD CONSTRAINT "harvests_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "harvest_samples" ADD CONSTRAINT "harvest_samples_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "photos" ADD CONSTRAINT "photos_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "season_records" ADD CONSTRAINT "season_records_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "weekly_costs" ADD CONSTRAINT "weekly_costs_recordId_fkey" FOREIGN KEY ("recordId") REFERENCES "season_records"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminders" ADD CONSTRAINT "reminders_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reminder_checks" ADD CONSTRAINT "reminder_checks_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "loan_applications" ADD CONSTRAINT "loan_applications_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "prediction_logs" ADD CONSTRAINT "prediction_logs_seasonId_fkey" FOREIGN KEY ("seasonId") REFERENCES "seasons"("id") ON DELETE SET NULL ON UPDATE CASCADE;
