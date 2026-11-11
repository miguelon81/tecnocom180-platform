-- AlterTable
ALTER TABLE "DeviceTelemetry" ADD COLUMN     "validationRecoveryAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "validationRecoveryError" TEXT,
ADD COLUMN     "validationRecoveryLockToken" TEXT,
ADD COLUMN     "validationRecoveryLockedUntil" TIMESTAMP(3),
ADD COLUMN     "validationRecoveryNextAttemptAt" TIMESTAMP(3);
