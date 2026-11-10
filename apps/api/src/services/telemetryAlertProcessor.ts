
import { prisma } from "../lib/prisma";
import {
  applyLevelAlertInTransaction,
} from "./levelAlerts";
import { getDeviceLevelThresholds } from "./deviceAlertConfig";
import { getTelegramPilotRecipient } from "./telegramPilot";

export type TelemetryAlertResult =
  | "PROCESSED"
  | "SKIPPED"
  | "PENDING";

type TerminalStatus = "PROCESSED" | "SKIPPED";

export async function processTelemetryAlert(
  telemetryId: string,
  deviceCode: string,
  lockToken?: string,
): Promise<TelemetryAlertResult> {
  const initial = await prisma.deviceTelemetry.findUnique({
    where: { id: telemetryId },
    select: { deviceId: true },
  });

  if (!initial) {
    throw new Error(
      `Telemetria no encontrada: ${telemetryId}`,
    );
  }

  const deviceId = initial.deviceId;

  try {
    const config = await getDeviceLevelThresholds(deviceId);
    const recipient = await getTelegramPilotRecipient(deviceId);

    return await prisma.$transaction(
      async (tx) => {
        // Un solo procesamiento por dispositivo.
        await tx.$executeRaw`
          SELECT pg_advisory_xact_lock(
            hashtextextended(${deviceId}, 0)
          )
        `;

        const telemetry = await tx.deviceTelemetry.findUnique({
          where: { id: telemetryId },
          select: {
            deviceId: true,
            createdAt: true,
            validationStatus: true,
            validatedLevel: true,
            alertProcessingStatus: true,
            alertProcessingLockToken: true,
            alertProcessingLockedUntil: true,
          },
        });

        if (!telemetry || telemetry.deviceId !== deviceId) {
          throw new Error(
            "Telemetria inexistente o dispositivo incorrecto",
          );
        }

        // Una medicion terminada nunca se repite.
        if (
          telemetry.alertProcessingStatus === "PROCESSED" ||
          telemetry.alertProcessingStatus === "SKIPPED"
        ) {
          return telemetry.alertProcessingStatus;
        }

        // Verificar propiedad de la reserva.
        if (lockToken !== undefined) {
          if (
            telemetry.alertProcessingStatus !== "PROCESSING" ||
            telemetry.alertProcessingLockToken !== lockToken ||
            telemetry.alertProcessingLockedUntil === null ||
            telemetry.alertProcessingLockedUntil <= new Date()
          ) {
            // No modificar trabajos de otro proceso.
            return "PENDING";
          }
        } else if (
          telemetry.alertProcessingStatus === "PROCESSING"
        ) {
          // Una llamada directa no puede tomar
          // una medicion reservada por un worker.
          return "PENDING";
        }

        // Las validaciones pendientes deben esperar.
        if (
          telemetry.validationStatus === null ||
          telemetry.validationStatus === "PENDING"
        ) {
          return "PENDING";
        }

        async function complete(
          status: TerminalStatus,
        ): Promise<TelemetryAlertResult> {
          const result = await tx.deviceTelemetry.updateMany({
            where: {
              id: telemetryId,
              ...(lockToken !== undefined
                ? {
                    alertProcessingStatus: "PROCESSING",
                    alertProcessingLockToken: lockToken,
                    alertProcessingLockedUntil: {
                      gt: new Date(),
                    },
                  }
                : {
                    OR: [
                      { alertProcessingStatus: null },
                      {
                        alertProcessingStatus: {
                          in: ["PENDING", "FAILED"],
                        },
                      },
                    ],
                  }),
            },
            data: {
              alertProcessingStatus: status,
              alertProcessedAt: new Date(),
              alertProcessingError: null,
              alertProcessingLockToken: null,
              alertProcessingLockedUntil: null,

              // El futuro worker incrementara
              // attempts al reservar el trabajo.
              ...(lockToken === undefined
                ? {
                    alertProcessingAttempts: {
                      increment: 1,
                    },
                  }
                : {}),
            },
          });

          if (result.count !== 1) {
            // Revertir tambien cualquier alerta creada
            // dentro de esta misma transaccion.
            throw new Error(
              "No se pudo confirmar la reserva del procesamiento",
            );
          }

          return status;
        }

        // Lecturas no validas no generan alertas.
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

        // Politica provisional:
        // procesar solo la ultima referencia
        // validada por el backend.
        const recordTime = telemetry.createdAt.getTime();
        const lastValidTime = state.lastValidAt.getTime();

        if (recordTime < lastValidTime) {
          return complete("SKIPPED");
        }

        if (recordTime > lastValidTime) {
          throw new Error(
            "Telemetria posterior a la referencia validada",
          );
        }

        // No ordenar UUID como si fueran secuenciales.
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

        // Alerta y estado de procesamiento
        // forman parte del mismo COMMIT.
        const alertResult = await applyLevelAlertInTransaction(
          tx,
          deviceId,
          deviceCode,
          telemetry.validatedLevel,
          config,
          recipient,
        );

        return complete(
          alertResult === "SKIPPED"
            ? "SKIPPED"
            : "PROCESSED",
        );
      },
      {
        maxWait: 5000,
        timeout: 10000,
      },
    );
  } catch (error) {
    // Si un worker reservó el trabajo, solamente ese
    // worker debe registrar el fallo y programar
    // el siguiente intento.
    //
    // Conservamos el lockToken para comprobar
    // que la reserva todavía le pertenece.
    if (lockToken !== undefined) {
      throw error;
    }
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    // No sobrescribir un resultado ya confirmado
    // ni modificar la reserva de otro proceso.
    try {
      await prisma.deviceTelemetry.updateMany({
        where: {
          id: telemetryId,
          ...(lockToken !== undefined
            ? {
                alertProcessingStatus: "PROCESSING",
                alertProcessingLockToken: lockToken,
                alertProcessingLockedUntil: {
                  gt: new Date(),
                },
              }
            : {
                OR: [
                  { alertProcessingStatus: null },
                  {
                    alertProcessingStatus: {
                      in: ["PENDING", "FAILED"],
                    },
                  },
                ],
              }),
        },
        data: {
          alertProcessingStatus: "FAILED",
          alertProcessingError: message.slice(0, 1000),
          alertProcessingLockToken: null,
          alertProcessingLockedUntil: null,
          alertProcessedAt: null,

          ...(lockToken === undefined
            ? {
                alertProcessingAttempts: {
                  increment: 1,
                },
              }
            : {}),
        },
      });
    } catch (saveError) {
      console.error(
        "[TelemetryAlertProcessor] Error registrando fallo:",
        saveError,
      );
    }

    throw error;
  }
}
