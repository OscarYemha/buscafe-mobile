/*
  Warnings:

  - A unique constraint covering the columns `[idempotencyKey]` on the table `Review` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "idempotencyKey" UUID;

-- CreateIndex
CREATE UNIQUE INDEX "Review_idempotencyKey_key" ON "Review"("idempotencyKey");
