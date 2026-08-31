import { sendTelegramMessage } from "./telegram";

const LOW_LEVEL_THRESHOLD = 20;
const RECOVERY_LEVEL_THRESHOLD = 25;

type LevelAlertState = {
  lowAlertSent: boolean;
};

const states = new Map<string, LevelAlertState>();

type Telemetry = {
  nivel?: unknown;
  bateria?: unknown;
  senal?: unknown;
  recarga?: unknown;
  consumo?: unknown;
  relay1?: unknown;
};

function getState(deviceKey: string): LevelAlertState {
  let state = states.get(deviceKey);

  if (!state) {
    state = {
      lowAlertSent: false,
    };

    states.set(deviceKey, state);
  }

  return state;
}

async function processLevelAlert(
  deviceKey: string,
  telemetry: Telemetry,
): Promise<void> {
  const nivel = Number(telemetry.nivel);

  if (!Number.isFinite(nivel)) {
    return;
  }

  const state = getState(deviceKey);

  if (
    nivel <= LOW_LEVEL_THRESHOLD &&
    !state.lowAlertSent
  ) {
    state.lowAlertSent = true;

    const message =
      `🚨 TECNOCOM180 - NIVEL BAJO\n\n` +
      `Dispositivo: ${deviceKey}\n` +
      `Nivel: ${nivel}%\n` +
      `Umbral: ${LOW_LEVEL_THRESHOLD}%\n\n` +
      `Se requiere revisar el nivel de la cisterna.`;

    try {
      await sendTelegramMessage(message);

      console.log(
        `ALERTA Telegram enviada: ${deviceKey} nivel ${nivel}%`,
      );
    } catch (error) {
      state.lowAlertSent = false;

      console.error(
        "Error enviando alerta de nivel por Telegram:",
        error,
      );
    }

    return;
  }

  if (
    nivel >= RECOVERY_LEVEL_THRESHOLD &&
    state.lowAlertSent
  ) {
    state.lowAlertSent = false;

    const message =
      `✅ TECNOCOM180 - NIVEL RESTABLECIDO\n\n` +
      `Dispositivo: ${deviceKey}\n` +
      `Nivel: ${nivel}%\n\n` +
      `El nivel de la cisterna volvió a un rango normal.`;

    try {
      await sendTelegramMessage(message);

      console.log(
        `RESTABLECIMIENTO Telegram enviado: ${deviceKey} nivel ${nivel}%`,
      );
    } catch (error) {
      state.lowAlertSent = true;

      console.error(
        "Error enviando restablecimiento por Telegram:",
        error,
      );
    }
  }
}

export { processLevelAlert };
