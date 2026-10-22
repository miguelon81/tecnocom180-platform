import { prisma } from "../lib/prisma";
import { Prisma } from "../../../../generated/prisma/client";

type NotificationEvent = "TRIGGERED" | "RESOLVED";

type QueueAlertNotificationInput = {
  alertId: string;
  eventType: NotificationEvent;
  recipient: string;
  message: string;
};

export async function queueAlertNotification(
  input: QueueAlertNotificationInput,
  db: Prisma.TransactionClient = prisma,
): Promise<void> {
  const recipient = input.recipient.trim();

  if (!recipient) {
    throw new Error(
      "No se puede registrar una notificación sin destinatario",
    );
  }

  await db.alertNotification.upsert({
    where: {
      alertId_channel_eventType_recipient: {
        alertId: input.alertId,
        channel: "TELEGRAM",
        eventType: input.eventType,
        recipient,
      },
    },
    create: {
      alertId: input.alertId,
      channel: "TELEGRAM",
      eventType: input.eventType,
      recipient,
      message: input.message,
      status: "PENDING",
      attempts: 0,
    },
    update: {},
  });
}