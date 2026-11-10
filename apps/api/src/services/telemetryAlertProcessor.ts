
import { prisma } from "../lib/prisma";
import {
  applyLevelAlertInTransaction,
  type LevelAlertResult,
} from "./levelAlerts";
import { getDeviceLevelThresholds } from "./deviceAlertConfig";
import { getTelegramPilotRecipient } from "./telegramPilot";

export type TelemetryAlertResult =
  | "PROCESSED"
  | "SKIPPED"
  | "PENDING";

export async function processTelemetryAlert(
  telemetryId: string,
  deviceCode: string,
): Promise<TelemetryAlertResult> {
  const initial = await prisma.deviceTelemetry.findUnique({
    where: { id: telemetryId },
    select: { deviceId: true },
  });

  if (!initial) {
    throw new Error(`Telemetria no encontrada: ${telemetryId}`);
  }

  const deviceId = initial.deviceId;

  const config = await getDeviceLevelThresholds(deviceId);
  const recipient = await getTelegramPilotRecipient(deviceId);

  try {
    return await prisma.$transaction(
      async (tx) => {
        // Compartir el mismo bloqueo por dispositivo
        // utilizado por el validador y las alertas.
        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(
            hashtextextended(${deviceId}, 0)
          )
        `;

        // Releer después de obtener el bloqueo.
        const telemetry = await tx.deviceTelemetry.findUnique({
          where: { id: telemetryId },
          select: {
            deviceId: true,
            createdAt: true,
            validationStatus: true,
            validatedLevel: true,
            alertProcessingStatus: true,
          },
        });

        if (!telemetry || telemetry.deviceId !== deviceId) {
          throw new Error("Telemetria inexistente o incorrecta");
        }

        // Procesamiento idempotente.
        if (
          telemetry.alertProcessingStatus === "PROCESSED" ||
          telemetry.alertProcessingStatus === "SKIPPED"
        ) {
          return telemetry.alertProcessingStatus;
        }

        // Una validación todavía sin resolver no se consume.
        if (
          telemetry.validationStatus === null ||
          telemetry.validationStatus === "PENDING"
        ) {
          return "PENDING";
        }

        async function complete(
          status: "PROCESSED" | "SKIPPED",
        ): Promise<TelemetryAlertResult> {
          await tx.deviceTelemetry.update({
            where: { id: telemetryId },
            data: {
              alertProcessingStatus: status,
              alertProcessedAt: new Date(),
              alertProcessingError: null,
              alertProcessingLockToken: null,
              alertProcessingLockedUntil: null,
              alertProcessingAttempts: { increment: 1 },
            },
          });

          return status;
        }

        // Las lecturas rechazadas no generan alertas.
        if (
          telemetry.validationStatus !== "VALID" ||
          telemetry.validatedLevel === null ||
          !Number.isFinite(telemetry.validatedLevel) ||
          telemetry.validatedLevel < 0 ||
          telemetry.validatedLevel > 100 ||
          !config.enabled
        ) {
          return complete("SKIPPED");
        }

        const state = await tx.deviceTelemetryState.findUnique({
          where: { deviceId },
          select: { lastValidAt: true },
        });

        if (!state?.lastValidAt) {
          throw new Error(
            "No existe referencia validada del dispositivo",
          );
        }

        // Solo aplicar la referencia VALID más reciente
        // que conoce el validador del backend.
        if (
          telemetry.createdAt.getTime() !==
          state.lastValidAt.getTime()
        ) {
          if (telemetry.createdAt < state.lastValidAt) {
            return complete("SKIPPED");
          }

          throw new Error(
            "La telemetria es posterior a la referencia validada",
          );
        }

        // No utilizar UUID como desempate cronológico.
        const sameTimestamp = await tx.deviceTelemetry.count({
          where: {
            deviceId,
            createdAt: telemetry.createdAt,
            validationStatus: "VALID",
          },
        });

        if (sameTimestamp !== 1) {
          return complete("SKIPPED");
        }

        // Misma transacción: alerta + estado de procesamiento.
        const result: LevelAlertResult =
          await applyLevelAlertInTransaction(
            tx,
            deviceId,
            deviceCode,
            telemetry.validatedLevel,
            config,
            recipient,
          );

        if (result === "SKIPPED") {
          return complete("SKIPPED");
        }

        return complete("PROCESSED");
      },
      {
        maxWait: 5000,
        timeout: 10000,
      },
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : String(error);

    // Registrar el fallo sin sobrescribir un resultado
    // terminal confirmado por otra ejecución.
    try {
      await prisma.deviceTelemetry.updateMany({
        where: {
          id: telemetryId,
          alertProcessingStatus: {
            notIn: ["PROCESSED", "SKIPPED", "PROCESSING"],
          },
        },
        data: {
          alertProcessingStatus: "FAILED",
          alertProcessingError: message.slice(0, 1000),
          alertProcessingAttempts: { increment: 1 },
        },
      });
    } catch (saveError) {
      console.error(
        "[TelemetryAlertProcessor] No se pudo registrar el fallo:",
        saveError,
      );
    }

    throw error;
  }
}
