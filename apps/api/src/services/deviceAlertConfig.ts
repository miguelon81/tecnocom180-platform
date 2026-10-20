import { prisma } from "../lib/prisma";

const DEFAULT_LOW_LEVEL_THRESHOLD = 20;
const DEFAULT_RECOVERY_LEVEL_THRESHOLD = 25;

export type LevelThresholds = {
  enabled: boolean;
  lowLevelThreshold: number;
  recoveryLevelThreshold: number;
};

export async function getDeviceLevelThresholds(
  deviceId: string,
): Promise<LevelThresholds> {
  const config = await prisma.deviceAlertConfig.findUnique({
    where: { deviceId },
  });

  const lowLevelThreshold =
    config?.lowLevelThreshold ??
    DEFAULT_LOW_LEVEL_THRESHOLD;

  const recoveryLevelThreshold =
    config?.recoveryLevelThreshold ??
    DEFAULT_RECOVERY_LEVEL_THRESHOLD;

  if (recoveryLevelThreshold <= lowLevelThreshold) {
    throw new Error(
      `Configuración inválida de umbrales para dispositivo ${deviceId}`,
    );
  }

  return {
    enabled: config?.enabled ?? true,
    lowLevelThreshold,
    recoveryLevelThreshold,
  };
}