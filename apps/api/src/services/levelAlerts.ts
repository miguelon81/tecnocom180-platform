import { prisma } from "../lib/prisma";
import { getDeviceLevelThresholds } from "./deviceAlertConfig";
import { toNullableNumber } from "./telemetryValidation";

import { Prisma } from "../../../../generated/prisma/client";
import { queueAlertNotification } from "./alertNotifications";

type Telemetry = {
  nivel?: unknown;
};

export async function processLevelAlert(
  deviceId: string,
  deviceCode: string,
  telemetry: Telemetry,
): Promise<void> {
  const nivel = toNullableNumber(telemetry.nivel);

  // Una lectura inválida nunca genera alertas de nivel.
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

  // Crear alerta cuando el nivel baja del umbral.
  if (
    nivel <= config.lowLevelThreshold &&
    !activeAlert
  ) {
    try {
  const wasResolved = await prisma.$transaction(async (tx) => {
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

  const recipient = process.env.TELEGRAM_CHAT_ID?.trim();

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

  // Resolver alerta cuando el nivel se recupera.
  if (
    nivel >= config.recoveryLevelThreshold &&
    activeAlert
  ) {
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

  if (result.count === 0) {
  return false;
}

  const recipient = process.env.TELEGRAM_CHAT_ID?.trim();

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
