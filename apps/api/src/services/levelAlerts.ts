import { prisma } from "../lib/prisma";
import { getDeviceLevelThresholds } from "./deviceAlertConfig";
import { toNullableNumber } from "./telemetryValidation";

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
    await prisma.deviceAlert.create({
      data: {
        deviceId,
        code: "LOW_LEVEL",
        status: "ACTIVE",
        message:
          `Nivel bajo en ${deviceCode}: ${nivel}% ` +
          `(umbral ${config.lowLevelThreshold}%)`,
        triggeredValue: nivel,
        thresholdValue: config.lowLevelThreshold,
      },
    });

    console.log(
      `ALERTA registrada: ${deviceCode}, nivel ${nivel}%`,
    );

    return;
  }

  // Resolver alerta cuando el nivel se recupera.
  if (
    nivel >= config.recoveryLevelThreshold &&
    activeAlert
  ) {
    await prisma.deviceAlert.update({
      where: {
        id: activeAlert.id,
      },
      data: {
        status: "RESOLVED",
        resolvedAt: new Date(),
      },
    });

    console.log(
      `ALERTA resuelta: ${deviceCode}, nivel ${nivel}%`,
    );
  }
}