-- AlterTable
ALTER TABLE "users" ADD COLUMN     "isGuest" BOOLEAN NOT NULL DEFAULT false;

-- AlterTable
ALTER TABLE "farms" ADD COLUMN     "capitalJt" DECIMAL(10,2),
ADD COLUMN     "profitTargetJt" DECIMAL(10,2),
ADD COLUMN     "sellPricePerKg" DECIMAL(12,2);

-- AlterTable
ALTER TABLE "cost_plans" ADD COLUMN     "needsRecalc" BOOLEAN NOT NULL DEFAULT false;
