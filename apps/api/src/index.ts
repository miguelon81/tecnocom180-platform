import { app } from "./app";
import { stopMqtt } from "./services/mqtt";
import { prisma } from "./lib/prisma";
import {
  startNotificationWorker,
  stopNotificationWorker,
} from "./services/notificationWorkerRunner";
import {
  startTelemetryWorker,
  stopTelemetryWorker,
} from "./services/telemetryWorkerRunner";

const PORT = 3000;
const HOST = process.env.API_HOST || "127.0.0.1";

const server = app.listen(PORT, HOST, () => {
  console.log(
    `TECNOCOM180 API running on http://${HOST}:${PORT}`,
  );

  startNotificationWorker();
  startTelemetryWorker();
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`[API] Señal recibida: ${signal}`);
  const SHUTDOWN_TIMEOUT_MS = 30_000;

  // Último recurso: evita que la API quede
  // indefinidamente en estado de apagado.
  const emergencyTimeout = setTimeout(() => {
    console.error(
      "[API] ERROR: apagado excedió 30 segundos",
    );

    console.error(
      "[API] Finalización forzada. " +
      "Los trabajos incompletos deberán recuperarse.",
    );

    // No desconectar Prisma mientras pueda haber
    // operaciones activas. El sistema operativo
    // cerrará las conexiones del proceso.
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);

  try {
    // Detener la recepción de conexiones nuevas.
    const httpClosed = new Promise<void>((resolve, reject) => {
      server.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        console.log("[API] Servidor HTTP cerrado");
        resolve();
      });
    });

    // Todos los servicios reciben la orden de
    // detención y deben terminar su trabajo activo.
    const results = await Promise.allSettled([
      httpClosed,
      Promise.resolve().then(() => stopMqtt()),
      Promise.resolve().then(() => stopNotificationWorker()),
      Promise.resolve().then(() => stopTelemetryWorker()),
    ]);

    const failures = results.filter(
      (result) => result.status === "rejected",
    );

    if (failures.length > 0) {
      for (const failure of failures) {
        if (failure.status === "rejected") {
          console.error(
            "[API] Error durante apagado:",
            failure.reason,
          );
        }
      }

      throw new Error(
        "Uno o más servicios no pudieron detenerse correctamente",
      );
    }

    console.log(
      "[API] Todos los servicios confirmaron su detención",
    );

    // PostgreSQL se desconecta únicamente
    // después de terminar todos los servicios.
    await prisma.$disconnect();

    console.log("[API] PostgreSQL desconectado");
    console.log("[API] Apagado ordenado completado");

  } catch (error) {
    console.error(
      "[API] Apagado incompleto:",
      error,
    );

    // No dejar el proceso ejecutándose
    // en un estado parcialmente detenido.
    process.exitCode = 1;

    // Evitamos desconectar Prisma si alguno
    // de los servicios falló durante su cierre.
    process.exit(1);

  } finally {
    clearTimeout(emergencyTimeout);
  }
}

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});
