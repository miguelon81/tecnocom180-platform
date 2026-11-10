
import { prisma } from "../lib/prisma";
import { Prisma } from "../../../../generated/prisma/client";

import {
  getDeviceLevelThresholds,
  type LevelThresholds,
} from "./deviceAlertConfig";
import { toNullableNumber } from "./telemetryValidation";
import { queueAlertNotification } from "./alertNotifications";
import { getTelegramPilotRecipient } from "./telegramPilot";

type Telemetry = {
  nivel?: unknown;
  falla?: unknown;
};

export type LevelAlertResult =
  | "TRIGGERED"
  | "RESOLVED"
  | "UNCHANGED"
  | "SKIPPED";

/**
 * Aplica una transicion de alerta dentro de una
 * transaccion PostgreSQL existente.
 *
 * No abre una transaccion adicional.
 * El llamador controla COMMIT o ROLLBACK.
 */
export async function applyLevelAlertInTransaction(
  tx: Prisma.TransactionClient,
  deviceId: string,
  deviceCode: string,
  nivel: number,
  config: LevelThresholds,
  recipient: string | null,
): Promise<LevelAlertResult> {
  if (
    !config.enabled ||
    !Number.isFinite(nivel) ||
    nivel < 0 ||
    nivel > 100
  ) {
    return "SKIPPED";
  }

  // Serializar transiciones por dispositivo.
  // Usa la misma clave que telemetryValidator.
  await tx.$executeRaw`
    SELECT pg_advisory_xact_lock(
      hashtextextended(${deviceId}, 0)
    )
  `;

  // Consultar dentro del bloqueo, nunca antes.
  const activeAlert = await tx.deviceAlert.findFirst({
    where: {
      deviceId,
      code: "LOW_LEVEL",
      status: "ACTIVE",
    },
    orderBy: {
      triggeredAt: "desc",
    },
  });

  // ----------------------------------------------
  // ACTIVACION: NIVEL BAJO
  // ----------------------------------------------
  if (
    nivel <= config.lowLevelThreshold &&
    !activeAlert
  ) {
    const message =
      `Nivel bajo en ${deviceCode}: ${nivel}% ` +
      `(umbral ${config.lowLevelThreshold}%)`;

    const alert = await tx.deviceAlert.create({
      data: {
        deviceId,
        code: "LOW_LEVEL",
        status: "ACTIVE",
        message,
        triggeredValue: nivel,
        thresholdValue: config.lowLevelThreshold,
      },
    });

    if (recipient) {
      await queueAlertNotification(
        {
          alertId: alert.id,
          eventType: "TRIGGERED",
          recipient,
          message:
            `ALERTA TECNOCOM180\n${message}`,
        },
        tx,
      );
    }

    return "TRIGGERED";
  }

  // ----------------------------------------------
  // RECUPERACION: NIVEL RESTABLECIDO
  // ----------------------------------------------
  if (
    nivel >= config.recoveryLevelThreshold &&
    activeAlert
  ) {
    const result = await tx.deviceAlert.updateMany({
      where: {
        id: activeAlert.id,
        status: "ACTIVE",
      },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
      },
    });

    if (result.count === 0) {
      return "UNCHANGED";
    }

    if (recipient) {
      await queueAlertNotification(
        {
          alertId: activeAlert.id,
          eventType: "RESOLVED",
          recipient,
          message:
            `RESTABLECIMIENTO TECNOCOM180\n` +
            `Dispositivo: ${deviceCode}\n` +
            `Nivel actual: ${nivel}%\n` +
            `Umbral de recuperacion: ` +
            `${config.recoveryLevelThreshold}%`,
        },
        tx,
      );
    }

    return "RESOLVED";
  }

  return "UNCHANGED";
}

/**
 * Interfaz publica existente.
 *
 * Conserva compatibilidad con MQTT y
 * con las pruebas anteriores.
 */
export async function processLevelAlert(
  deviceId: string,
  deviceCode: string,
  telemetry: Telemetry,
): Promise<void> {
  if (telemetry.falla === true) {
    return;
  }

  const nivel = toNullableNumber(telemetry.nivel);

  if (
    nivel === null ||
    nivel < 0 ||
    nivel > 100
  ) {
    return;
  }

  const config = await getDeviceLevelThresholds(deviceId);

  if (!config.enabled) {
    return;
  }

  const recipient =
    await getTelegramPilotRecipient(deviceId);

  try {
    const result = await prisma.$transaction(
      async (tx) => {
        return applyLevelAlertInTransaction(
          tx,
          deviceId,
          deviceCode,
          nivel,
          config,
          recipient,
        );
      },
      {
        maxWait: 5000,
        timeout: 10000,
      },
    );

    if (result === "TRIGGERED") {
      console.log(
        `ALERTA registrada: ${deviceCode}, nivel ${nivel}%`,
      );
    }

    if (result === "RESOLVED") {
      console.log(
        `ALERTA resuelta: ${deviceCode}, nivel ${nivel}%`,
      );
    }
  } catch (error) {
    // Respaldo del indice UNIQUE de PostgreSQL.
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      console.log(
        `Alerta LOW_LEVEL ya registrada: ${deviceCode}`,
      );
      return;
    }

    throw error;
  }
}
