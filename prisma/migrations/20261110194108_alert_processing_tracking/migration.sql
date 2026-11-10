-- AlterTable
ALTER TABLE "DeviceTelemetry" ADD COLUMN     "alertProcessedAt" TIMESTAMP(3),
ADD COLUMN     "alertProcessingAttempts" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "alertProcessingError" TEXT,
ADD COLUMN     "alertProcessingLockToken" TEXT,
ADD COLUMN     "alertProcessingLockedUntil" TIMESTAMP(3),
ADD COLUMN     "alertProcessingStatus" TEXT;

-- CreateIndex
CREATE INDEX "DeviceTelemetry_alertProcessingStatus_alertProcessingLocked_idx" ON "DeviceTelemetry"("alertProcessingStatus", "alertProcessingLockedUntil");
