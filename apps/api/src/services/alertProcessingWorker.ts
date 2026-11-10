
import { randomUUID } from "node:crypto";
import { prisma } from "../lib/prisma";
import { processTelemetryAlert } from "./telemetryAlertProcessor";

const LOCK_SECONDS = 60;
const MAX_ATTEMPTS = 5;

type ClaimedJob = {
  id: string;
  deviceId: string;
  lockToken: string;
  attempts: number;
};

function validateWorkerEnvironment(
  testMode: boolean,
  testTelemetryId?: string,
): void {
  if (testMode) {
    const url = new URL(process.env.DATABASE_URL ?? "");

    if (
      url.hostname !== "127.0.0.1" ||
      url.port !== "5433" ||
      url.pathname !== "/tecnocom180_test" ||
      process.env.TELEGRAM_NOTIFICATIONS_ENABLED !== "false" ||
      !testTelemetryId
    ) {
      throw new Error(
        "Prueba no autorizada fuera de laboratorio",
      );
    }

    return;
  }

  if (
    process.env.ALERT_PROCESSING_WORKER_ENABLED !== "true"
  ) {
    throw new Error(
      "AlertProcessingWorker deshabilitado",
    );
  }
}

// Espera exponencial, máximo 8 minutos.
export function getAlertRetryDelay(
  attempts: number,
): number {
  return Math.min(
    60 * 2 ** Math.max(0, attempts - 1),
    480,
  );
}

/**
 * Marcar trabajos agotados cuyo bloqueo venció.
 * No volverán a ser seleccionados.
 */
async function closeExhaustedJobs(
  testMode: boolean,
  testTelemetryId?: string,
): Promise<void> {
  const result = await prisma.deviceTelemetry.updateMany({
    where: {
      ...(testMode ? { id: testTelemetryId } : {}),
      alertProcessingAttempts: {
        gte: MAX_ATTEMPTS,
      },
      OR: [
        {
          alertProcessingStatus: "PROCESSING",
          alertProcessingLockedUntil: {
            lt: new Date(),
          },
        },
        {
          alertProcessingStatus: "FAILED",
          alertProcessingLockedUntil: {
            lte: new Date(),
          },
        },
      ],
    },
    data: {
      alertProcessingStatus: "FAILED",
      alertProcessingLockToken: null,
      alertProcessingLockedUntil: null,
      alertProcessingError:
        "Máximo de intentos agotado",
    },
  });

  if (result.count > 0) {
    console.warn(
      `[AlertWorker] Trabajos agotados: ${result.count}`,
    );
  }
}

/**
 * Reservar una medición de forma exclusiva.
 */
export async function claimNextAlertJob(
  testMode = false,
  testTelemetryId?: string,
): Promise<ClaimedJob | null> {
  validateWorkerEnvironment(
    testMode,
    testTelemetryId,
  );

  await closeExhaustedJobs(
    testMode,
    testTelemetryId,
  );

  const lockToken = randomUUID();

  const jobs = await prisma.$queryRaw<ClaimedJob[]>`
    WITH candidate AS (
      SELECT "id"
      FROM "DeviceTelemetry"
      WHERE
        (
          ${!testMode}
          OR "id" = ${testTelemetryId ?? ""}
        )
        AND "alertProcessingStatus" IS NOT NULL
        AND "validationStatus" IN (
          'VALID',
          'REJECTED',
          'SENSOR_ERROR'
        )
        AND "alertProcessingAttempts" < ${MAX_ATTEMPTS}
        AND (
          "alertProcessingStatus" = 'PENDING'

          OR (
            "alertProcessingStatus" = 'FAILED'
            AND (
              "alertProcessingLockedUntil" IS NULL
              OR "alertProcessingLockedUntil" <= NOW()
            )
          )

          OR (
            "alertProcessingStatus" = 'PROCESSING'
            AND "alertProcessingLockedUntil" < NOW()
          )
        )
      ORDER BY "createdAt" ASC, "id" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    )
    UPDATE "DeviceTelemetry" AS t
    SET
      "alertProcessingStatus" = 'PROCESSING',
      "alertProcessingLockToken" = ${lockToken},
      "alertProcessingLockedUntil" =
        NOW() + (${LOCK_SECONDS} * INTERVAL '1 second'),
      "alertProcessingAttempts" =
        t."alertProcessingAttempts" + 1,
      "alertProcessingError" = NULL
    FROM candidate
    WHERE t."id" = candidate."id"
    RETURNING
      t."id",
      t."deviceId",
      t."alertProcessingLockToken" AS "lockToken",
      t."alertProcessingAttempts" AS "attempts";
  `;

  return jobs[0] ?? null;
}

/**
 * Procesar un solo trabajo reservado.
 */
export async function processNextAlertJob(
  testMode = false,
  testTelemetryId?: string,
): Promise<boolean> {
  validateWorkerEnvironment(
    testMode,
    testTelemetryId,
  );

  const job = await claimNextAlertJob(
    testMode,
    testTelemetryId,
  );

  if (!job) {
    return false;
  }

  console.log(
    `[AlertWorker] Reservado: ${job.id}, ` +
    `intento ${job.attempts}/${MAX_ATTEMPTS}`,
  );

  try {
    const device = await prisma.device.findUnique({
      where: { id: job.deviceId },
      select: {
        deviceCode: true,
        name: true,
      },
    });

    if (!device) {
      throw new Error("Dispositivo no encontrado");
    }

    const deviceCode =
      device.deviceCode ?? device.name ?? job.deviceId;

    const result = await processTelemetryAlert(
      job.id,
      deviceCode,
      job.lockToken,
    );

    console.log(
      `[AlertWorker] ${job.id}: ${result}`,
    );

    if (result === "PENDING") {
      console.warn(
        `[AlertWorker] Reserva no completada: ${job.id}`,
      );
    }

    return true;
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : String(error);

    const exhausted =
      job.attempts >= MAX_ATTEMPTS;

    const retrySeconds = exhausted
      ? null
      : getAlertRetryDelay(job.attempts);

    const nextAttemptAt =
      retrySeconds === null
        ? null
        : new Date(
            Date.now() + retrySeconds * 1000,
          );

    // Solo el propietario vigente puede
    // registrar el fallo y reprogramar.
    const updated = await prisma.deviceTelemetry.updateMany({
      where: {
        id: job.id,
        alertProcessingStatus: "PROCESSING",
        alertProcessingLockToken: job.lockToken,
        alertProcessingLockedUntil: {
          gt: new Date(),
        },
      },
      data: {
        alertProcessingStatus: "FAILED",
        alertProcessingError: message.slice(0, 1000),
        alertProcessingLockToken: null,

        // En FAILED representa la próxima
        // fecha permitida para reintentar.
        alertProcessingLockedUntil: nextAttemptAt,
      },
    });

    if (updated.count === 1) {
      if (exhausted) {
        console.error(
          `[AlertWorker] Intentos agotados: ${job.id}`,
        );
      } else {
        console.warn(
          `[AlertWorker] Reintento en ${retrySeconds}s: ${job.id}`,
        );
      }
    } else {
      console.warn(
        `[AlertWorker] No se modificó la reserva ` +
        `vencida o reemplazada: ${job.id}`,
      );
    }

    console.error(
      `[AlertWorker] Error: ${message}`,
    );

    return true;
  }
}
