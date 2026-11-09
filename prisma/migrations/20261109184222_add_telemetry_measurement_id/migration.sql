/*
  Warnings:

  - A unique constraint covering the columns `[deviceId,measurementId]` on the table `DeviceTelemetry` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "DeviceTelemetry" ADD COLUMN     "measurementId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "DeviceTelemetry_deviceId_measurementId_key" ON "DeviceTelemetry"("deviceId", "measurementId");
