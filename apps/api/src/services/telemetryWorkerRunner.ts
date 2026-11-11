
import {
  recoverPendingValidations,
} from "./telemetryValidationRecoveryWorker";

import {
  processNextAlertJob,
} from "./alertProcessingWorker";

const INTERVAL_MS = 10_000;
const VALIDATION_BATCH_SIZE = 25;
const ALERT_BATCH_SIZE = 10;

let timer: ReturnType<typeof setTimeout> | null = null;

let running = false;
let stopping = false;
let started = false;

let activeCycle: Promise<void> | null = null;

/**
 * El runner permanece deshabilitado salvo
 * que ambos recuperadores estén habilitados.
 *
 * El modo de laboratorio requiere la base
 * de pruebas y Telegram deshabilitado.
 */
function checkEnvironment(): boolean {
  if (
    process.env.TELEMETRY_VALIDATION_RECOVERY_ENABLED !== "true" ||
    process.env.ALERT_PROCESSING_WORKER_ENABLED !== "true"
  ) {
    console.log(
      "[TelemetryRunner] Deshabilitado por configuración",
    );
    return false;
  }

  if (process.env.MQTT_LAB_MODE === "true") {
    const url = new URL(process.env.DATABASE_URL ?? "");

    if (
      url.hostname !== "127.0.0.1" ||
      url.port !== "5433" ||
      url.pathname !== "/tecnocom180_test" ||
      process.env.TELEGRAM_NOTIFICATIONS_ENABLED !== "false"
    ) {
      throw new Error(
        "[TelemetryRunner] Entorno LAB no autorizado",
      );
    }
  }

  return true;
}

/**
 * Un ciclo completo:
 *
 * 1. Recuperar las validaciones incompletas.
 * 2. Procesar los trabajos de alertas disponibles.
 *
 * Nunca ejecuta ciclos simultáneos dentro
 * de esta instancia de la API.
 */
async function runCycle(): Promise<void> {
  if (!started || running || stopping) {
    return;
  }

  running = true;

  const cycle = (async () => {
    try {
        const validations = await recoverPendingValidations({
        batchSize: VALIDATION_BATCH_SIZE,
        shouldStop: () => stopping,
      });
      if (
        validations.found > 0 ||
        validations.errors > 0
      ) {
        console.log(
          "[TelemetryRunner] Validaciones:",
          validations,
        );
      }

      let alertsProcessed = 0;

      for (let i = 0; i < ALERT_BATCH_SIZE; i++) {
        if (stopping) {
          break;
        }

        const found = await processNextAlertJob();

        if (!found) {
          break;
        }

        alertsProcessed++;
      }

      if (alertsProcessed > 0) {
        console.log(
          `[TelemetryRunner] Trabajos de alerta: ${alertsProcessed}`,
        );
      }
    } catch (error) {
      console.error(
        "[TelemetryRunner] Error en ciclo:",
        error,
      );
    } finally {
      running = false;

      if (!stopping && started) {
        timer = setTimeout(() => {
          timer = null;
          void runCycle();
        }, INTERVAL_MS);
      }
    }
  })();

  activeCycle = cycle;

  try {
    await cycle;
  } finally {
    if (activeCycle === cycle) {
      activeCycle = null;
    }
  }
}

/**
 * Arranque idempotente.
 *
 * No activa MQTT ni Telegram.
 * Únicamente inicia los recuperadores.
 */
export function startTelemetryWorker(): void {
  if (started || running || activeCycle !== null) {
    return;
  }

  if (!checkEnvironment()) {
    return;
  }

  stopping = false;
  started = true;

  console.log(
    "[TelemetryRunner] Iniciado",
  );

  void runCycle();
}

/**
 * Detiene nuevos ciclos y espera
 * a que termine el ciclo en ejecución.
 *
 * No desconecta Prisma: eso corresponde
 * al cierre general de la API.
 */
export async function stopTelemetryWorker(): Promise<void> {
  stopping = true;
  started = false;

  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }

  console.log(
    "[TelemetryRunner] Detención solicitada",
  );

  if (activeCycle !== null) {
    console.log(
      "[TelemetryRunner] Esperando ciclo activo...",
    );

    await activeCycle;
  }

  console.log(
    "[TelemetryRunner] Detenido",
  );
}
