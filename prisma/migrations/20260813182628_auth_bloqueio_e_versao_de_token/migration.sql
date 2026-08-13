-- AlterTable
ALTER TABLE "users" ADD COLUMN     "failedLoginAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "lockedUntil" TIMESTAMPTZ(3),
ADD COLUMN     "tokenVersion" INTEGER NOT NULL DEFAULT 0;
