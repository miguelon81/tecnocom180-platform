import { app } from "./app";
import "./services/mqtt";
import { prisma } from "./lib/prisma";
import {
  startNotificationWorker,
  stopNotificationWorker,
} from "./services/notificationWorkerRunner";

const PORT = 3000;
const HOST = process.env.API_HOST || "127.0.0.1";

const server = app.listen(PORT, HOST, () => {
  console.log(
    `TECNOCOM180 API running on http://${HOST}:${PORT}`,
  );

  startNotificationWorker();
});

let shuttingDown = false;

async function shutdown(signal: string): Promise<void> {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`[API] Señal recibida: ${signal}`);

  // Dejar de aceptar nuevas conexiones HTTP.
  const httpClosed = new Promise<void>((resolve) => {
    server.close((error) => {
      if (error) {
        console.error("[API] Error al cerrar servidor:", error);
        process.exitCode = 1;
      }

      console.log("[API] Servidor HTTP cerrado");
      resolve();
    });
  });

  // Detener nuevos ciclos y esperar el procesamiento activo.
const WORKER_SHUTDOWN_TIMEOUT_MS = 30_000;

let shutdownTimeout: ReturnType<typeof setTimeout> | undefined;
let workerStopped = false;


try {
  const result = await Promise.race([
    stopNotificationWorker().then(() => "stopped" as const),
    new Promise<"timeout">((resolve) => {
      shutdownTimeout = setTimeout(
        () => resolve("timeout"),
        WORKER_SHUTDOWN_TIMEOUT_MS,
      );
    }),
  ]);

  workerStopped = result === "stopped";

  if (result === "timeout") {
    console.warn(
      "[API] Worker excedió los 30 segundos de espera durante el apagado",
    );
    process.exitCode = 1;
  }
} catch (error) {
  console.error(
    "[API] Error al detener NotificationWorker:",
    error,
  );
  process.exitCode = 1;
} finally {
  if (shutdownTimeout !== undefined) {
    clearTimeout(shutdownTimeout);
  }
}

await httpClosed;

if (workerStopped) {
  try {
    await prisma.$disconnect();
    console.log("[API] PostgreSQL desconectado");
  } catch (error) {
    console.error(
      "[API] Error al desconectar PostgreSQL:",
      error,
    );
    process.exitCode = 1;
  }
} else {
  console.warn(
    "[API] Se omite desconexión de Prisma: worker aún activo",
  );
}

if (workerStopped) {
  console.log("[API] Apagado ordenado completado");
} else {
  console.warn(
    "[API] Apagado incompleto: el worker no confirmó su detención",
  );
}

}

process.once("SIGINT", () => {
  void shutdown("SIGINT");
});

process.once("SIGTERM", () => {
  void shutdown("SIGTERM");
});
