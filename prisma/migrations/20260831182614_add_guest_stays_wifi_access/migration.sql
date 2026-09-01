-- CreateTable
CREATE TABLE "Guest" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siteId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Guest_siteId_fkey" FOREIGN KEY ("siteId") REFERENCES "Site" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GuestStay" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "guestId" TEXT NOT NULL,
    "roomId" TEXT NOT NULL,
    "checkIn" DATETIME NOT NULL,
    "checkOut" DATETIME NOT NULL,
    "actualCheckIn" DATETIME,
    "actualCheckOut" DATETIME,
    "status" TEXT NOT NULL DEFAULT 'RESERVED',
    "notes" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GuestStay_guestId_fkey" FOREIGN KEY ("guestId") REFERENCES "Guest" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "GuestStay_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "GuestWifiAccess" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "stayId" TEXT NOT NULL,
    "username" TEXT,
    "password" TEXT,
    "accessUrl" TEXT,
    "token" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "activatedAt" DATETIME,
    "expiresAt" DATETIME NOT NULL,
    "deactivatedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "GuestWifiAccess_stayId_fkey" FOREIGN KEY ("stayId") REFERENCES "GuestStay" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Guest_siteId_idx" ON "Guest"("siteId");

-- CreateIndex
CREATE INDEX "GuestStay_guestId_idx" ON "GuestStay"("guestId");

-- CreateIndex
CREATE INDEX "GuestStay_roomId_idx" ON "GuestStay"("roomId");

-- CreateIndex
CREATE INDEX "GuestStay_checkIn_idx" ON "GuestStay"("checkIn");

-- CreateIndex
CREATE INDEX "GuestStay_checkOut_idx" ON "GuestStay"("checkOut");

-- CreateIndex
CREATE INDEX "GuestStay_status_idx" ON "GuestStay"("status");

-- CreateIndex
CREATE UNIQUE INDEX "GuestWifiAccess_stayId_key" ON "GuestWifiAccess"("stayId");

-- CreateIndex
CREATE UNIQUE INDEX "GuestWifiAccess_token_key" ON "GuestWifiAccess"("token");

-- CreateIndex
CREATE INDEX "GuestWifiAccess_status_idx" ON "GuestWifiAccess"("status");

-- CreateIndex
CREATE INDEX "GuestWifiAccess_expiresAt_idx" ON "GuestWifiAccess"("expiresAt");
