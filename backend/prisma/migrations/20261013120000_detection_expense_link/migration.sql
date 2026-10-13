-- AlterTable
ALTER TABLE "deteksi_tanaman" ADD COLUMN     "expenseId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "deteksi_tanaman_expenseId_key" ON "deteksi_tanaman"("expenseId");

-- AddForeignKey
ALTER TABLE "deteksi_tanaman" ADD CONSTRAINT "deteksi_tanaman_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
