-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GuestWifiAccess" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stayId" TEXT NOT NULL,
    "username" TEXT,
    "password" TEXT,
    "accessUrl" TEXT,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "maxDevices" INTEGER NOT NULL DEFAULT 2,
    "activatedAt" DATETIME,
    "expiresAt" DATETIME NOT NULL,
    "deactivatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GuestWifiAccess_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "GuestStay" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_GuestWifiAccess" ("accessUrl", "activatedAt", "createdAt", "deactivatedAt", "expiresAt", "id", "password", "status", "stayId", "token", "updatedAt", "username") SELECT "accessUrl", "activatedAt", "createdAt", "deactivatedAt", "expiresAt", "id", "password", "status", "stayId", "token", "updatedAt", "username" FROM "GuestWifiAccess";
DROP TABLE "GuestWifiAccess";
ALTER TABLE "new_GuestWifiAccess" RENAME TO "GuestWifiAccess";
CREATE UNIQUE INDEX "GuestWifiAccess_stayId_key" ON "GuestWifiAccess"("stayId");
CREATE UNIQUE INDEX "GuestWifiAccess_token_key" ON "GuestWifiAccess"("token");
CREATE INDEX "GuestWifiAccess_status_idx" ON "GuestWifiAccess"("status");
CREATE INDEX "GuestWifiAccess_expiresAt_idx" ON "GuestWifiAccess"("expiresAt");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
