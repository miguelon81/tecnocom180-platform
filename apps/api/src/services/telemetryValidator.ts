
import { prisma } from "../lib/prisma";
import { toNullableNumber } from "./telemetryValidation";

const BIG_CHANGE_PP = 15;
const CONFIRM_TOLERANCE_PP = 6;
const MIN_CONFIRM_INTERVAL_MS = 60_000;

type ValidationInput = {
  nivel?: unknown;
  falla?: unknown;
};

type ValidationResult = {
  valid: boolean;
  nivel: number | null;
  status: "VALID" | "PENDING" | "REJECTED" | "SENSOR_ERROR";
  reason: string | null;
};

export async function validateDeviceTelemetry(
  deviceId: string,
  telemetryId: string,
  telemetry: ValidationInput,
  recoveryLockToken?: string,
): Promise<ValidationResult> {
  const nivel = toNullableNumber(telemetry.nivel);

  return prisma.$transaction(
    async (tx) => {
      // Serializa las validaciones del mismo dispositivo.
      // Se libera automáticamente al terminar la transacción.
      await tx.$executeRaw`
        SELECT pg_advisory_xact_lock(
          hashtextextended(${deviceId}, 0)
        )
      `;

      const record = await tx.deviceTelemetry.findUnique({
        where: { id: telemetryId },
        select: {
          id: true,
          deviceId: true,
          createdAt: true,
          validationStatus: true,
          validatedLevel: true,
          validationReason: true,
          validationRecoveryLockToken: true,
          validationRecoveryLockedUntil: true,
        },
      });

      if (!record || record.deviceId !== deviceId) {
        throw new Error("Telemetría no encontrada o dispositivo incorrecto");
      }
     // Comprobar si existe una reserva de recuperación vigente.
     const activeRecoveryLock =
       record.validationRecoveryLockToken !== null &&
       record.validationRecoveryLockedUntil !== null &&
       record.validationRecoveryLockedUntil > new Date();

     if (recoveryLockToken !== undefined) {
       // El recuperador debe conservar su llave vigente.
       if (
         record.validationRecoveryLockToken !== recoveryLockToken ||
         !activeRecoveryLock
       ) {
         throw new Error("VALIDATION_RECOVERY_LOCK_LOST");
       }
     } else if (activeRecoveryLock) {
       // MQTT no puede validar una medición que
       // otro recuperador tiene reservada.
       throw new Error("VALIDATION_RECOVERY_IN_PROGRESS");
     }

      // Evita procesar dos veces el mismo registro.
      if (record.validationStatus !== null) {
        return {
          valid: record.validationStatus === "VALID",
          nivel: record.validatedLevel,
          status: record.validationStatus as ValidationResult["status"],
          reason: record.validationReason,
        };
      }

      // No validar una medición si existe otra anterior
      // del mismo dispositivo que todavía no fue validada.
      //
      // Se ejecuta dentro del bloqueo transaccional
      // por dispositivo.
      //
      // Excluye los registros históricos anteriores
      // al sistema de trabajos persistentes.
      const olderUnvalidated = await tx.deviceTelemetry.findFirst({
        where: {
          deviceId,
          validationStatus: null,
          alertProcessingStatus: "PENDING",
          OR: [
            {
              createdAt: {
                lt: record.createdAt,
              },
            },
            {
              createdAt: record.createdAt,
              id: {
                lt: telemetryId,
              },
            },
          ],
        },
        select: {
          id: true,
        },
      });

      if (olderUnvalidated) {
        throw new Error("OLDER_TELEMETRY_NOT_VALIDATED");
      }
      const state = await tx.deviceTelemetryState.upsert({
        where: { deviceId },
        create: { deviceId },
        update: {},
      });

      const fecha = record.createdAt;

      async function actualizar(
        status: ValidationResult["status"],
        reason: string | null,
        validatedLevel: number | null,
      ): Promise<ValidationResult> {
       await tx.deviceTelemetry.update({
        where: { id: telemetryId },
        data: {
          validationStatus: status,
          validationReason: reason,
          validatedLevel,

          // La validación terminó correctamente.
          // Ya no necesita una reserva de recuperación.
          validationRecoveryLockToken: null,
          validationRecoveryLockedUntil: null,
          validationRecoveryNextAttemptAt: null,
          validationRecoveryError: null,
        },
      });

        return {
          valid: status === "VALID",
          nivel: validatedLevel,
          status,
          reason,
        };
      }

      async function cerrarPendiente(
        reason: string,
        confirmado: boolean,
      ) {
        if (!state.pendingAt) return;

        await tx.deviceTelemetry.updateMany({
          where: {
            deviceId,
            validationStatus: "PENDING",
            createdAt: state.pendingAt,
          },
          data: {
            validationStatus: confirmado ? "VALID" : "REJECTED",
            validationReason: reason,
            // Solo se acepta como referencia si fue confirmado.
            ...(confirmado && state.pendingLevel !== null
              ? { validatedLevel: state.pendingLevel }
              : { validatedLevel: null }),
          },
        });
      }

      // Una falla del firmware no modifica la referencia confiable.
      if (telemetry.falla === true) {
        return actualizar(
          "SENSOR_ERROR",
          "FIRMWARE_ERROR",
          null,
        );
      }

      if (nivel === null || nivel < 0 || nivel > 100) {
        return actualizar(
          "REJECTED",
          "INVALID_LEVEL",
          null,
        );
      }

      // No permitir que una lectura antigua sobrescriba
      // una referencia validada más reciente.
      if (
        state.lastValidAt !== null &&
        fecha < state.lastValidAt
      ) {
        return actualizar(
          "REJECTED",
          "OUT_OF_ORDER",
          null,
        );
      }
      // No permitir que una lectura anterior al candidato
      // pendiente modifique su estado o lo sustituya.
      if (
        state.pendingAt !== null &&
        fecha.getTime() < state.pendingAt.getTime()
      ) {
        return actualizar(
          "REJECTED",
          "OUT_OF_ORDER_PENDING",
          null,
        );
      }
      // Primera referencia confiable.
      if (state.lastValidLevel === null) {
        await tx.deviceTelemetryState.update({
          where: { deviceId },
          data: {
            lastValidLevel: nivel,
            lastValidAt: fecha,
            pendingLevel: null,
            pendingAt: null,
          },
        });

        return actualizar("VALID", "INITIAL_REFERENCE", nivel);
      }

      const diferencia = Math.abs(
        nivel - state.lastValidLevel,
      );

      // Segunda lectura consistente con un salto pendiente.
      if (
        state.pendingLevel !== null &&
        state.pendingAt !== null &&
        fecha.getTime() - state.pendingAt.getTime() >=
          MIN_CONFIRM_INTERVAL_MS &&
        Math.abs(nivel - state.pendingLevel) <= CONFIRM_TOLERANCE_PP
      ) {
        await cerrarPendiente("CHANGE_CONFIRMED", true);

        await tx.deviceTelemetryState.update({
          where: { deviceId },
          data: {
            lastValidLevel: nivel,
            lastValidAt: fecha,
            pendingLevel: null,
            pendingAt: null,
          },
        });

        return actualizar("VALID", "CHANGE_CONFIRMED", nivel);
      }
      // Lectura consistente con el candidato pendiente,
      // pero recibida antes de los 60 segundos.
      // No confirma ni reinicia el temporizador.
      if (
        state.pendingLevel !== null &&
        state.pendingAt !== null &&
        fecha.getTime() >= state.pendingAt.getTime() &&
        fecha.getTime() - state.pendingAt.getTime() <
          MIN_CONFIRM_INTERVAL_MS &&
        Math.abs(nivel - state.pendingLevel) <= CONFIRM_TOLERANCE_PP
      ) {
        return actualizar(
          "REJECTED",
          "CONFIRMATION_TOO_EARLY",
          null,
        );
      }
      // Regresó cerca de la referencia anterior:
      // la sospecha queda descartada.
      if (diferencia < BIG_CHANGE_PP) {
        await cerrarPendiente("CHANGE_NOT_CONFIRMED", false);

        await tx.deviceTelemetryState.update({
          where: { deviceId },
          data: {
            lastValidLevel: nivel,
            lastValidAt: fecha,
            pendingLevel: null,
            pendingAt: null,
          },
        });

        return actualizar("VALID", null, nivel);
      }

      // Dos lecturas con la misma fecha no constituyen
      // ciclos independientes de confirmación.
      // Conservamos el primer candidato pendiente.
      if (
        state.pendingLevel !== null &&
        state.pendingAt !== null &&
        fecha.getTime() === state.pendingAt.getTime()
      ) {
        return actualizar(
          "REJECTED",
          "SAME_TIMESTAMP_AS_PENDING",
          null,
        );
      }

      // Salto grande: conservarlo pendiente.
      // Si había otro candidato, lo sustituimos.
      await cerrarPendiente("SUPERSEDED", false);

      await tx.deviceTelemetryState.update({
        where: { deviceId },
        data: {
          pendingLevel: nivel,
          pendingAt: fecha,
        },
      });

      return actualizar("PENDING", "BIG_LEVEL_CHANGE", null);
    },
    {
      maxWait: 5000,
      timeout: 10000,
    },
  );
}
