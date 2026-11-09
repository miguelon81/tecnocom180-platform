-- AlterTable
ALTER TABLE "DeviceTelemetry" ADD COLUMN     "consumptionRate" DOUBLE PRECISION,
ADD COLUMN     "validatedLevel" DOUBLE PRECISION,
ADD COLUMN     "validationReason" TEXT,
ADD COLUMN     "validationStatus" TEXT;

-- AlterTable
ALTER TABLE "DeviceAlertConfig" ADD COLUMN     "confirmationMaxMinutes" INTEGER NOT NULL DEFAULT 30,
ADD COLUMN     "confirmationMinMinutes" INTEGER NOT NULL DEFAULT 5,
ADD COLUMN     "highConsumptionEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "highConsumptionRate" DOUBLE PRECISION;

-- CreateTable
CREATE TABLE "DeviceTelemetryState" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "lastValidLevel" DOUBLE PRECISION,
    "lastValidAt" TIMESTAMP(3),
    "pendingLevel" DOUBLE PRECISION,
    "pendingAt" TIMESTAMP(3),
    "pendingConsumptionRate" DOUBLE PRECISION,
    "consumptionStartedAt" TIMESTAMP(3),
    "confirmationDueAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceTelemetryState_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceCommand" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "command" TEXT NOT NULL,
    "payload" JSONB,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "sentAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "attempts" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "DeviceCommand_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeviceTelemetryState_deviceId_key" ON "DeviceTelemetryState"("deviceId");

-- CreateIndex
CREATE INDEX "DeviceCommand_deviceId_status_idx" ON "DeviceCommand"("deviceId", "status");

-- CreateIndex
CREATE INDEX "DeviceCommand_expiresAt_idx" ON "DeviceCommand"("expiresAt");

-- AddForeignKey
ALTER TABLE "DeviceTelemetryState" ADD CONSTRAINT "DeviceTelemetryState_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceCommand" ADD CONSTRAINT "DeviceCommand_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
