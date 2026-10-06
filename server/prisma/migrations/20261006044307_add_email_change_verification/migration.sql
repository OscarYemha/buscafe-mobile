-- AlterTable
ALTER TABLE "User" ADD COLUMN     "emailChangeCode" TEXT,
ADD COLUMN     "emailChangeCodeExpires" TIMESTAMP(3),
ADD COLUMN     "pendingEmail" TEXT;
