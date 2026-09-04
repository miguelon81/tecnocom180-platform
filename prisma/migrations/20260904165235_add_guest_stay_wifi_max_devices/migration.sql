-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_GuestStay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guestId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "checkIn" DATETIME NOT NULL,
    "checkOut" DATETIME NOT NULL,
    "actualCheckIn" DATETIME,
    "actualCheckOut" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'RESERVED',
    "notes" TEXT,
    "wifiMaxDevices" INTEGER NOT NULL DEFAULT 2,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GuestStay_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GuestStay_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
INSERT INTO "new_GuestStay" ("actualCheckIn", "actualCheckOut", "checkIn", "checkOut", "createdAt", "guestId", "id", "notes", "roomId", "status", "updatedAt") SELECT "actualCheckIn", "actualCheckOut", "checkIn", "checkOut", "createdAt", "guestId", "id", "notes", "roomId", "status", "updatedAt" FROM "GuestStay";
DROP TABLE "GuestStay";
ALTER TABLE "new_GuestStay" RENAME TO "GuestStay";
CREATE INDEX "GuestStay_guestId_idx" ON "GuestStay"("guestId");
CREATE INDEX "GuestStay_roomId_idx" ON "GuestStay"("roomId");
CREATE INDEX "GuestStay_checkIn_idx" ON "GuestStay"("checkIn");
CREATE INDEX "GuestStay_checkOut_idx" ON "GuestStay"("checkOut");
CREATE INDEX "GuestStay_status_idx" ON "GuestStay"("status");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
