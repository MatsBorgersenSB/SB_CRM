-- AlterTable
ALTER TABLE "activities" ADD COLUMN "title" TEXT NOT NULL DEFAULT '';

-- AlterTable
ALTER TABLE "activities" ADD COLUMN "completedAt" TIMESTAMP(3);
