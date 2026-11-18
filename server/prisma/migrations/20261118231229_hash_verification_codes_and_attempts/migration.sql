-- AlterTable
ALTER TABLE "User" DROP COLUMN "emailChangeCode",
DROP COLUMN "emailVerificationCode",
DROP COLUMN "passwordResetCode",
ADD COLUMN     "emailChangeAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "emailChangeCodeHash" TEXT,
ADD COLUMN     "emailVerificationAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "emailVerificationCodeHash" TEXT,
ADD COLUMN     "passwordResetAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "passwordResetCodeHash" TEXT;
