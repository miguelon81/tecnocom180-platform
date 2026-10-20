-- CreateTable
CREATE TABLE "DeviceAlertConfig" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "lowLevelThreshold" DOUBLE PRECISION,
    "recoveryLevelThreshold" DOUBLE PRECISION,
    "lowBatteryThreshold" DOUBLE PRECISION,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DeviceAlertConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceDiagnosticEvent" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "component" TEXT,
    "severity" TEXT NOT NULL DEFAULT 'WARNING',
    "detail" TEXT,
    "attempts" INTEGER,
    "occurredAt" TIMESTAMP(3),
    "receivedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "DeviceDiagnosticEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "DeviceAlert" (
    "id" TEXT NOT NULL,
    "deviceId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "message" TEXT,
    "triggeredValue" DOUBLE PRECISION,
    "thresholdValue" DOUBLE PRECISION,
    "triggeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "acknowledgedById" TEXT,

    CONSTRAINT "DeviceAlert_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DeviceAlertConfig_deviceId_key" ON "DeviceAlertConfig"("deviceId");

-- CreateIndex
CREATE INDEX "DeviceDiagnosticEvent_deviceId_receivedAt_idx" ON "DeviceDiagnosticEvent"("deviceId", "receivedAt");

-- CreateIndex
CREATE INDEX "DeviceAlert_deviceId_status_idx" ON "DeviceAlert"("deviceId", "status");

-- CreateIndex
CREATE INDEX "DeviceAlert_triggeredAt_idx" ON "DeviceAlert"("triggeredAt");

-- AddForeignKey
ALTER TABLE "DeviceAlertConfig" ADD CONSTRAINT "DeviceAlertConfig_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceDiagnosticEvent" ADD CONSTRAINT "DeviceDiagnosticEvent_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "DeviceAlert" ADD CONSTRAINT "DeviceAlert_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device"("id") ON DELETE CASCADE ON UPDATE CASCADE;
