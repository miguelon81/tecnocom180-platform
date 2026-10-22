-- CreateTable
CREATE TABLE "AlertNotification" (
    "id" TEXT NOT NULL,
    "alertId" TEXT NOT NULL,
    "channel" TEXT NOT NULL DEFAULT 'TELEGRAM',
    "eventType" TEXT NOT NULL,
    "recipient" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastError" TEXT,
    "lastAttemptAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AlertNotification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AlertNotification_status_nextAttemptAt_idx" ON "AlertNotification"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX "AlertNotification_alertId_channel_eventType_recipient_key" ON "AlertNotification"("alertId", "channel", "eventType", "recipient");

-- AddForeignKey
ALTER TABLE "AlertNotification" ADD CONSTRAINT "AlertNotification_alertId_fkey" FOREIGN KEY ("alertId") REFERENCES "DeviceAlert"("id") ON DELETE CASCADE ON UPDATE CASCADE;
