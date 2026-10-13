-- CreateEnum
CREATE TYPE "DetectionStatus" AS ENUM ('SELESAI', 'TIDAK_YAKIN');

-- CreateTable
CREATE TABLE "deteksi_tanaman" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "farmId" TEXT NOT NULL,
    "status" "DetectionStatus" NOT NULL,
    "photoKey" TEXT NOT NULL,
    "photoMime" TEXT NOT NULL,
    "note" TEXT,
    "detection" JSONB NOT NULL,
    "solution" JSONB,
    "costMinJt" DECIMAL(10,3),
    "costMaxJt" DECIMAL(10,3),
    "provider" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "deteksi_tanaman_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "deteksi_tanaman_farmId_createdAt_idx" ON "deteksi_tanaman"("farmId", "createdAt");

-- CreateIndex
CREATE INDEX "deteksi_tanaman_userId_createdAt_idx" ON "deteksi_tanaman"("userId", "createdAt");

-- AddForeignKey
ALTER TABLE "deteksi_tanaman" ADD CONSTRAINT "deteksi_tanaman_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "deteksi_tanaman" ADD CONSTRAINT "deteksi_tanaman_farmId_fkey" FOREIGN KEY ("farmId") REFERENCES "farms"("id") ON DELETE CASCADE ON UPDATE CASCADE;
