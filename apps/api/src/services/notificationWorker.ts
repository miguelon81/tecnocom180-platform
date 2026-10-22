import { prisma } from "../lib/prisma";
import { sendTelegramMessage } from "./telegram";
import { randomUUID } from "node:crypto";

type ClaimedNotification = {
  id: string;
  recipient: string;
  message: string;
  attempts: number;
  lockToken: string;
};

const LOCK_SECONDS = 60;
const MAX_ATTEMPTS = 5;

function validateManualTelegramTest(
  notificationId?: string,
): void {
  if (!notificationId) return;

  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) {
    throw new Error("DATABASE_URL no configurada");
  }

  const connection = new URL(databaseUrl);
  const database = connection.pathname.slice(1);

  if (
    database !== "tecnocom180_test" ||
    connection.hostname !== "127.0.0.1" ||
    connection.port !== "5434" ||
    process.env.TELEGRAM_NOTIFICATIONS_ENABLED !== "false" ||
    process.env.MQTT_ENABLED !== "false"
  ) {
    throw new Error(
      "Envío manual permitido únicamente en tecnocom180_test " +
      "con Telegram automático y MQTT deshabilitados",
    );
  }
}

export async function claimNextNotification(
  testMode = false,
  testNotificationId?: string,
  manualNotificationId?: string,
): Promise<ClaimedNotification | null> {
  if (testMode && manualNotificationId) {
    throw new Error(
      "No se puede combinar modo simulado con envío manual real",
    );
  }

  validateManualTelegramTest(manualNotificationId);

  // Protección: nunca procesar si el envío está deshabilitado.
  if (testMode) {
  const databaseName = new URL(
    process.env.DATABASE_URL ?? "",
  ).pathname.slice(1);

  if (
    databaseName !== "tecnocom180_test" ||
    process.env.TELEGRAM_NOTIFICATIONS_ENABLED !== "false"
  ) {
    throw new Error(
      "Reserva de prueba permitida únicamente en tecnocom180_test con Telegram deshabilitado",
    );
  }
  } else if (
    !manualNotificationId &&
    process.env.TELEGRAM_NOTIFICATIONS_ENABLED !== "true"
  ) {
    return null;
  }

  if (testMode && !testNotificationId) {
    throw new Error(
      "El modo de prueba requiere un ID de notificación específico",
    );
  }
  // Recuperar notificaciones cuyo último intento quedó interrumpido.
  const recovered = await prisma.alertNotification.updateMany({
    where: {
      ...(testMode ? { id: testNotificationId } : {}),
      status: "PROCESSING",
      attempts: {
        gte: MAX_ATTEMPTS,
      },
      lockedUntil: {
        lt: new Date(),
      },
    },
  data: {
    status: "FAILED",
    lockedUntil: null,
    lockToken: null,
    nextAttemptAt: null,
    lastError: "Último intento interrumpido: bloqueo vencido",
  },
});

if (recovered.count > 0) {
  console.warn(
    `Notificaciones agotadas recuperadas: ${recovered.count}`,
  );
}


  const lockToken = randomUUID();

  const rows = await prisma.$queryRaw<ClaimedNotification[]>`
    UPDATE "AlertNotification"
    SET
      "status" = 'PROCESSING',
      "lockToken" = ${lockToken},
      "lockedUntil" = NOW() + (${LOCK_SECONDS} * INTERVAL '1 second'),
      "lastAttemptAt" = NOW(),
      "attempts" = "attempts" + 1,
      "updatedAt" = NOW()
    WHERE "id" = (
      SELECT "id"
      FROM "AlertNotification"
      WHERE
        (
          (${testMode} AND "id" = ${testNotificationId ?? ""})
          OR
          (${Boolean(manualNotificationId)} AND "id" = ${manualNotificationId ?? ""})
          OR
          (${!testMode && !Boolean(manualNotificationId)})
        )
        AND (
          NOT ${Boolean(manualNotificationId)}
          OR "channel" = 'TELEGRAM'
        )
        AND "attempts" < ${MAX_ATTEMPTS}
         AND (
         (
           "status" = 'PENDING'
           AND (
             "nextAttemptAt" IS NULL
             OR "nextAttemptAt" <= NOW()
           )
         )
         OR (
           "status" = 'FAILED'
           AND "nextAttemptAt" IS NOT NULL
           AND "nextAttemptAt" <= NOW()
         )
           OR (
            "status" = 'PROCESSING'
            AND "lockedUntil" < NOW()
          )
        )
      ORDER BY "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    RETURNING
      "id",
      "recipient",
      "message",
      "attempts",
      "lockToken";
  `;

  return rows[0] ?? null;
}


export function getRetryDelay(attempts: number): number {
  return Math.min(60 * 2 ** Math.max(0, attempts - 1), 480);
}

export async function processNextNotification(
  sendMessage: typeof sendTelegramMessage = sendTelegramMessage,
  testMode = false,
  testNotificationId?: string,
  manualNotificationId?: string,
): Promise<boolean> {
  if (testMode && manualNotificationId) {
    throw new Error(
      "No se puede combinar modo simulado con envío manual real",
    );
  }

  validateManualTelegramTest(manualNotificationId);
  if (testMode) {
  const databaseName = new URL(
    process.env.DATABASE_URL ?? "",
  ).pathname.slice(1);

  if (
    databaseName !== "tecnocom180_test" ||
    process.env.TELEGRAM_NOTIFICATIONS_ENABLED !== "false" ||
    sendMessage === sendTelegramMessage
  ) {
    throw new Error(
      "Modo de prueba requiere tecnocom180_test, Telegram deshabilitado y un simulador de envío",
    );
  }
    } else if (
      !manualNotificationId &&
      process.env.TELEGRAM_NOTIFICATIONS_ENABLED !== "true"
    ) {
      return false;
  }

  const notification = await claimNextNotification(
  testMode,
  testNotificationId,
  manualNotificationId,
);

  if (!notification) {
    return false;
  }

  try {
    await sendMessage(
    notification.message,
    notification.recipient,
  );
    const result = await prisma.alertNotification.updateMany({
    where: {
      id: notification.id,
      status: "PROCESSING",
      lockToken: notification.lockToken,
      lockedUntil: {
        gt: new Date(),
      },
    },
      data: {
        status: "SENT",
        sentAt: new Date(),
        lockedUntil: null,
        lockToken: null,
        nextAttemptAt: null,
        lastError: null,
      },
    });

    if (result.count === 1) {
      console.log(`Telegram confirmado: ${notification.id}`);
    } else {
      console.warn(
        `Confirmación omitida: reserva vencida o reemplazada (${notification.id})`,
      );
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    const retry =
      notification.attempts < MAX_ATTEMPTS;

    const nextAttemptAt = retry
      ? new Date(
          Date.now() +
            getRetryDelay(notification.attempts) * 1000,
        )
      : null;

    const result = await prisma.alertNotification.updateMany({
      where: {
        id: notification.id,
        status: "PROCESSING",
        lockToken: notification.lockToken,
        lockedUntil: {
          gt: new Date(),
        },
      },
      data: {
        status: "FAILED",
        lastError: message.slice(0, 1000),
        lockedUntil: null,
        lockToken: null,
        nextAttemptAt,
      },
    });

    if (result.count === 1) {
      console.error(
        `Error Telegram ${notification.id}: ${message}`,
      );
    } else {
      console.warn(
        `Error no registrado: reserva vencida o reemplazada (${notification.id})`,
      );
    }
  }

  return true;
}
