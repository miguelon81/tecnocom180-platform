
import { prisma } from "../lib/prisma";
import { Prisma } from "../../../../generated/prisma/client";

import { getDeviceLevelThresholds } from "./deviceAlertConfig";
import { toNullableNumber } from "./telemetryValidation";
import { queueAlertNotification } from "./alertNotifications";
import { getTelegramPilotRecipient } from "./telegramPilot";

type Telemetry = {
  nivel?: unknown;
  falla?: unknown;
};

export async function processLevelAlert(
  deviceId: string,
  deviceCode: string,
  telemetry: Telemetry,
): Promise<void> {
  // Una medición marcada como fallida no debe
  // activar ni resolver alertas de nivel.
  if (telemetry.falla === true) {
    return;
  }
  const nivel = toNullableNumber(telemetry.nivel);

  // Una lectura inválida nunca genera alertas.
  if (nivel === null || nivel < 0 || nivel > 100) {
    return;
  }

  const config = await getDeviceLevelThresholds(deviceId);

  if (!config.enabled) {
    return;
  }

  const activeAlert = await prisma.deviceAlert.findFirst({
    where: {
      deviceId,
      code: "LOW_LEVEL",
      status: "ACTIVE",
    },
    orderBy: {
      triggeredAt: "desc",
    },
  });

  // --------------------------------------------------
  // ALERTA: NIVEL BAJO
  // --------------------------------------------------
  if (nivel <= config.lowLevelThreshold && !activeAlert) {
    // La autorización se consulta antes de la transacción.
    // Si no pertenece al piloto, recipient será null.
    const recipient = await getTelegramPilotRecipient(deviceId);

    try {
      await prisma.$transaction(async (tx) => {
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
              message: `⚠️ ALERTA TECNOCOM180\n${message}`,
            },
            tx,
          );
        }
      });

      console.log(
        `ALERTA registrada: ${deviceCode}, nivel ${nivel}%`,
      );
    } catch (error) {
      // Evita errores cuando llegan lecturas simultáneas
      // para el mismo dispositivo.
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

    return;
  }

  // --------------------------------------------------
  // RESTABLECIMIENTO: NIVEL RECUPERADO
  // --------------------------------------------------
  if (
    nivel >= config.recoveryLevelThreshold &&
    activeAlert
  ) {
    const recipient = await getTelegramPilotRecipient(deviceId);

    const wasResolved = await prisma.$transaction(async (tx) => {
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

      // Si otra ejecución ya resolvió la alerta,
      // evitamos generar una segunda notificación.
      if (result.count === 0) {
        return false;
      }

      if (recipient) {
        await queueAlertNotification(
          {
            alertId: activeAlert.id,
            eventType: "RESOLVED",
            recipient,
            message:
              `✅ RESTABLECIMIENTO TECNOCOM180\n` +
              `Dispositivo: ${deviceCode}\n` +
              `Nivel actual: ${nivel}%\n` +
              `Umbral de recuperación: ${config.recoveryLevelThreshold}%`,
          },
          tx,
        );
      }

      return true;
    });

    if (wasResolved) {
      console.log(
        `ALERTA resuelta: ${deviceCode}, nivel ${nivel}%`,
      );
    }
  }
}
