/*
  Warnings:

  - A unique constraint covering the columns `[brandId,name]` on the table `DeviceModel` will be added. If there are existing duplicate values, this will fail.

*/
-- AlterTable
ALTER TABLE "Device" ADD COLUMN "lastSeenAt" DATETIME;
ALTER TABLE "Device" ADD COLUMN "name" TEXT;
ALTER TABLE "Device" ADD COLUMN "notes" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX "DeviceModel_brandId_name_key" ON "DeviceModel"("brandId", "name");
