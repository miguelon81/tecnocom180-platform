
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import { validateDeviceTelemetry } from "./telemetryValidator";

const DEFAULT_BATCH_SIZE = 25;
const MAX_BATCH_SIZE = 100;
const MAX_ATTEMPTS = 5;
const LOCK_SECONDS = 60;

type ClaimedValidation = {
  id: string;
  deviceId: string;
  nivel: number | null;
  falla: boolean | null;
  lockToken: string;
  attempts: number;
};

export type ValidationRecoveryResult = {
  found: number;
  validated: number;
  failed: number;
  pending: number;
  errors: number;
};

function checkEnvironment(
  testMode: boolean,
  telemetryId?: string,
): void {
  if (testMode) {
    const url = new URL(process.env.DATABASE_URL ?? "");

    if (
      url.hostname !== "127.0.0.1" ||
      url.port !== "5433" ||
      url.pathname !== "/tecnocom180_test" ||
      process.env.TELEGRAM_NOTIFICATIONS_ENABLED !== "false" ||
      !telemetryId
    ) {
      throw new Error(
        "Recuperacion de prueba no autorizada",
      );
    }

    return;
  }

  if (
    process.env.TELEMETRY_VALIDATION_RECOVERY_ENABLED !== "true"
  ) {
    throw new Error(
      "Recuperador de validaciones deshabilitado",
    );
  }
}

export function getValidationRetryDelay(
  attempts: number,
): number {
  return Math.min(
    60 * 2 ** Math.max(0, attempts - 1),
    480,
  );
}

/**
 * Libera las reservas vencidas cuyos cinco
 * intentos ya fueron consumidos.
 *
 * No reinicia el contador ni borra el error.
 */
async function closeExhaustedValidations(
  testMode: boolean,
  telemetryId?: string,
): Promise<void> {
  const result = await prisma.deviceTelemetry.updateMany({
    where: {
      ...(testMode ? { id: telemetryId } : {}),
      validationStatus: null,
      alertProcessingStatus: "PENDING",
      validationRecoveryAttempts: {
        gte: MAX_ATTEMPTS,
      },
      validationRecoveryLockToken: {
        not: null,
      },
      validationRecoveryLockedUntil: {
        lte: new Date(),
      },
    },
    data: {
      validationRecoveryLockToken: null,
      validationRecoveryLockedUntil: null,
      validationRecoveryNextAttemptAt: null,
      validationRecoveryError:
        "Intentos agotados tras interrupcion",
    },
  });

  if (result.count > 0) {
    console.warn(
      `[ValidationRecovery] Reservas agotadas: ${result.count}`,
    );
  }
}

/**
 * Reclama atomicamente una sola medicion.
 *
 * El filtro NOT EXISTS impide adelantar
 * lecturas cuando una medicion anterior
 * del mismo dispositivo sigue sin validar.
 *
 * SKIP LOCKED impide reclamar dos veces
 * la misma fila durante la seleccion.
 *
 * El token persistente protege la reserva
 * una vez terminado el UPDATE.
 */
export async function claimNextValidation(
  testMode = false,
  telemetryId?: string,
): Promise<ClaimedValidation | null> {
  checkEnvironment(testMode, telemetryId);

  await closeExhaustedValidations(
    testMode,
    telemetryId,
  );

  const lockToken = randomUUID();

  const rows = await prisma.$queryRaw<ClaimedValidation[]>`
    WITH candidate AS (
      SELECT t."id"
      FROM "DeviceTelemetry" AS t
      WHERE
        (
          ${!testMode}
          OR t."id" = ${telemetryId ?? ""}
        )

        AND t."validationStatus" IS NULL
        AND t."alertProcessingStatus" = 'PENDING'
        AND t."validationRecoveryAttempts" < ${MAX_ATTEMPTS}

        AND (
          t."validationRecoveryNextAttemptAt" IS NULL
          OR t."validationRecoveryNextAttemptAt" <= NOW()
        )

        AND (
          t."validationRecoveryLockToken" IS NULL
          OR (
            t."validationRecoveryLockedUntil" IS NOT NULL
            AND t."validationRecoveryLockedUntil" < NOW()
          )
        )

        AND NOT EXISTS (
          SELECT 1
          FROM "DeviceTelemetry" AS older
          WHERE
            older."deviceId" = t."deviceId"
            AND older."validationStatus" IS NULL
            AND older."alertProcessingStatus" = 'PENDING'
            AND (
              older."createdAt" < t."createdAt"
              OR (
                older."createdAt" = t."createdAt"
                AND older."id" < t."id"
              )
            )
        )

      ORDER BY t."createdAt" ASC, t."id" ASC
      FOR UPDATE OF t SKIP LOCKED
      LIMIT 1
    )

    UPDATE "DeviceTelemetry" AS t
    SET
      "validationRecoveryLockToken" = ${lockToken},
      "validationRecoveryLockedUntil" =
        NOW() + (${LOCK_SECONDS} * INTERVAL '1 second'),
      "validationRecoveryAttempts" =
        t."validationRecoveryAttempts" + 1,
      "validationRecoveryNextAttemptAt" = NULL,
      "validationRecoveryError" = NULL

    FROM candidate
    WHERE t."id" = candidate."id"

    RETURNING
      t."id",
      t."deviceId",
      t."nivel",
      t."falla",
      t."validationRecoveryLockToken" AS "lockToken",
      t."validationRecoveryAttempts" AS "attempts";
  `;

  return rows[0] ?? null;
}

/**
 * Procesa un lote de validaciones pendientes.
 *
 * Cada trabajo se reclama individualmente.
 * No genera alertas: deja el registro listo
 * para el AlertProcessingWorker.
 */
export async function recoverPendingValidations(
  options: {
    testMode?: boolean;
    telemetryId?: string;
    batchSize?: number;
  } = {},
): Promise<ValidationRecoveryResult> {
  const {
    testMode = false,
    telemetryId,
    batchSize = DEFAULT_BATCH_SIZE,
  } = options;

  checkEnvironment(testMode, telemetryId);

  if (
    !Number.isInteger(batchSize) ||
    batchSize < 1 ||
    batchSize > MAX_BATCH_SIZE
  ) {
    throw new Error("batchSize fuera de rango");
  }

  const result: ValidationRecoveryResult = {
    found: 0,
    validated: 0,
    failed: 0,
    pending: 0,
    errors: 0,
  };

  for (let i = 0; i < batchSize; i++) {
    const job = await claimNextValidation(
      testMode,
      telemetryId,
    );

    if (!job) {
      break;
    }

    result.found++;

    console.log(
      `[ValidationRecovery] Reservado ${job.id}, ` +
      `intento ${job.attempts}/${MAX_ATTEMPTS}`,
    );

    try {
      const validation = await validateDeviceTelemetry(
        job.deviceId,
        job.id,
        {
          nivel: job.nivel,
          falla: job.falla,
        },
        job.lockToken,
      );

      switch (validation.status) {
        case "VALID":
          result.validated++;
          break;

        case "PENDING":
          result.pending++;
          break;

        case "REJECTED":
        case "SENSOR_ERROR":
          result.failed++;
          break;
      }

      console.log(
        `[ValidationRecovery] ${job.id}: ` +
        `${validation.status} ` +
        `(${validation.reason ?? "OK"})`,
      );
    } catch (error) {
      result.errors++;

      const message =
        error instanceof Error
          ? error.message
          : String(error);

      const exhausted =
        job.attempts >= MAX_ATTEMPTS;

      const retrySeconds = exhausted
        ? null
        : getValidationRetryDelay(job.attempts);

      const nextAttemptAt =
        retrySeconds === null
          ? null
          : new Date(
              Date.now() + retrySeconds * 1000,
            );

      // Nunca sobrescribir una reserva reemplazada
      // ni una validacion ya completada.
      const updated =
        await prisma.deviceTelemetry.updateMany({
          where: {
            id: job.id,
            validationStatus: null,
            alertProcessingStatus: "PENDING",
            validationRecoveryLockToken: job.lockToken,
            validationRecoveryLockedUntil: {
              gt: new Date(),
            },
          },
          data: {
            validationRecoveryLockToken: null,
            validationRecoveryLockedUntil: null,
            validationRecoveryNextAttemptAt: nextAttemptAt,
            validationRecoveryError: message.slice(0, 1000),
          },
        });

      if (updated.count === 1) {
        if (exhausted) {
          console.error(
            `[ValidationRecovery] Intentos agotados: ${job.id}`,
          );
        } else {
          console.warn(
            `[ValidationRecovery] Reintento en ` +
            `${retrySeconds}s: ${job.id}`,
          );
        }
      } else {
        console.warn(
          `[ValidationRecovery] Reserva perdida o ` +
          `validacion completada: ${job.id}`,
        );
      }

      console.error(
        `[ValidationRecovery] Error ${job.id}: ${message}`,
      );
    }
  }

  return result;
}
