import { processNextNotification } from "./notificationWorker";

const INTERVAL_MS = 10_000;


let timer: ReturnType<typeof setTimeout> | null = null;
let running = false;
let stopping = false;

let activeCycle: Promise<void> | null = null;

async function runCycle(): Promise<void> {
  if (running || stopping) {
    return;
  }

  running = true;

  const cycle = (async () => {
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

export function startNotificationWorker(): void {
  if (timer !== null || running || activeCycle !== null) {
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

export async function stopNotificationWorker(): Promise<void> {
  stopping = true;

  if (timer !== null) {
    clearTimeout(timer);
    timer = null;
  }

  console.log("[NotificationWorker] Detención solicitada");

  if (activeCycle !== null) {
    console.log(
      "[NotificationWorker] Esperando procesamiento en curso...",
    );

    await activeCycle;
  }

  console.log("[NotificationWorker] Detenido");
}