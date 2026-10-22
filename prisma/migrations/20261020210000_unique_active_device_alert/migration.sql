CREATE UNIQUE INDEX "DeviceAlert_one_active_per_code"
ON "DeviceAlert" ("deviceId", "code")
WHERE "status" = 'ACTIVE';
