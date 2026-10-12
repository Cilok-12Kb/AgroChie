-- AlterTable
ALTER TABLE "seasons" ADD COLUMN     "financingStoppedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "cost_plans" ADD COLUMN     "input" JSONB;
