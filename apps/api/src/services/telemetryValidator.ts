
import { prisma } from "../lib/prisma";
import { toNullableNumber } from "./telemetryValidation";

const BIG_CHANGE_PP = 15;
const CONFIRM_TOLERANCE_PP = 6;

type ValidationInput = {
  nivel?: unknown;
  falla?: unknown;
};

export async function validateDeviceTelemetry(
  deviceId: string,
  telemetryId: string,
  telemetry: ValidationInput,
) {
  const nivel = toNullableNumber(telemetry.nivel);

  return prisma.$transaction(async (tx) => {
    const state = await tx.deviceTelemetryState.upsert({
      where: { deviceId },
      create: { deviceId },
      update: {},
    });

    const updateTelemetry = (
      status: string,
      reason: string | null,
      validatedLevel: number | null,
    ) =>
      tx.deviceTelemetry.update({
        where: { id: telemetryId },
        data: {
          validationStatus: status,
          validationReason: reason,
          validatedLevel,
        },
      });

    if (telemetry.falla === true) {
      await updateTelemetry("SENSOR_ERROR", "FIRMWARE_ERROR", null);
      return { valid: false, nivel: null };
    }

    if (nivel === null || nivel < 0 || nivel > 100) {
      await updateTelemetry("REJECTED", "INVALID_LEVEL", null);
      return { valid: false, nivel: null };
    }

    // Primera lectura confiable.
    if (state.lastValidLevel === null) {
      await tx.deviceTelemetryState.update({
        where: { deviceId },
        data: {
          lastValidLevel: nivel,
          lastValidAt: new Date(),
        },
      });

      await updateTelemetry("VALID", null, nivel);
      return { valid: true, nivel };
    }

    const diferencia = Math.abs(nivel - state.lastValidLevel);

    // Confirmación de un cambio sospechoso anterior.
    if (
      state.pendingLevel !== null &&
      Math.abs(nivel - state.pendingLevel) <= CONFIRM_TOLERANCE_PP
    ) {
      await tx.deviceTelemetryState.update({
        where: { deviceId },
        data: {
          lastValidLevel: nivel,
          lastValidAt: new Date(),
          pendingLevel: null,
          pendingAt: null,
        },
      });

      await updateTelemetry("VALID", "CHANGE_CONFIRMED", nivel);
      return { valid: true, nivel };
    }

    // Cambio demasiado grande: esperar otra medición.
    if (diferencia >= BIG_CHANGE_PP) {
      await tx.deviceTelemetryState.update({
        where: { deviceId },
        data: {
          pendingLevel: nivel,
          pendingAt: new Date(),
        },
      });

      await updateTelemetry("PENDING", "BIG_LEVEL_CHANGE", null);
      return { valid: false, nivel: null };
    }

    // Lectura normal.
    await tx.deviceTelemetryState.update({
      where: { deviceId },
      data: {
        lastValidLevel: nivel,
        lastValidAt: new Date(),
        pendingLevel: null,
        pendingAt: null,
      },
    });

    await updateTelemetry("VALID", null, nivel);

    return { valid: true, nivel };
  });
}
