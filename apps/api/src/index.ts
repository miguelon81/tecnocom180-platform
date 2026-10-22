
import { app } from "./app";
import "./services/mqtt";
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

function shutdown(signal: string): void {
  console.log(`[API] Señal recibida: ${signal}`);

  stopNotificationWorker();

  server.close((error) => {
    if (error) {
      console.error("[API] Error al cerrar servidor:", error);
      process.exitCode = 1;
    }

    console.log("[API] Servidor HTTP cerrado");
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
