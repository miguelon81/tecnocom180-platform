-- CreateTable
CREATE TABLE "DeviceTelemetry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "deviceId" TEXT NOT NULL,
    "nivel" REAL,
    "bateria" REAL,
    "senal" REAL,
    "recarga" REAL,
    "consumo" REAL,
    "relay1" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "DeviceTelemetry_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES "Device" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "DeviceTelemetry_deviceId_idx" ON "DeviceTelemetry"("deviceId");

-- CreateIndex
CREATE INDEX "DeviceTelemetry_createdAt_idx" ON "DeviceTelemetry"("createdAt");
