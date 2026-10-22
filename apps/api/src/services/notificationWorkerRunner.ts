
import { processNextNotification } from "./notificationWorker";

const INTERVAL_MS = 10_000;

let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let stopping = false;

async function runCycle(): Promise<void> {
  if (running || stopping) {
    return;
  }

  running = true;

  try {
    await processNextNotification();
  } catch (error) {
    console.error(
      "[NotificationWorker] Error de procesamiento:",
      error,
    );
  } finally {
    running = false;

    if (!stopping) {
      timer = setTimeout(() => {
        void runCycle();
      }, INTERVAL_MS);
    }
  }
}

export function startNotificationWorker(): void {
  if (timer !== null || running) {
    return;
  }

  if (process.env.TELEGRAM_NOTIFICATIONS_ENABLED !== "true") {
    console.log(
      "[NotificationWorker] Deshabilitado por configuración",
    );
    return;
  }

  stopping = false;

  console.log("[NotificationWorker] Iniciado");

  void runCycle();
}

export function stopNotificationWorker(): void {
  stopping = true;

  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }

  console.log("[NotificationWorker] Detención solicitada");
}
