import mqtt, { type ISubscriptionMap } from "mqtt";

import { validateDeviceTelemetry } from "./telemetryValidator";
import { prisma } from "../lib/prisma";
import {
  saveDiagnosticResult,
  type DiagnosticPayload,
} from "./diagnosticResults";

import { toNullableNumber } from "./telemetryValidation";
import { saveDeviceDiagnostic } from "./deviceDiagnostics";
import { Prisma } from "../../../../generated/prisma/client";

const brokerUrl = process.env.MQTT_BROKER_URL;
const username = process.env.MQTT_USERNAME;
const password = process.env.MQTT_PASSWORD;

const mqttEnabled = process.env.MQTT_ENABLED !== "false";

if (mqttEnabled && !brokerUrl) {
  throw new Error("MQTT_BROKER_URL no está configurado");
}

if (mqttEnabled && !username) {
  throw new Error("MQTT_USERNAME no está configurado");
}

if (mqttEnabled && !password) {
  throw new Error("MQTT_PASSWORD no está configurado");
}

const mqttClient = mqtt.connect(
  mqttEnabled ? brokerUrl! : "mqtt://127.0.0.1:1883",
  {
    username,
    password,
    clientId: `tecnocom180-api-${Math.random()
      .toString(16)
      .slice(2)}`,
    clean: true,
    reconnectPeriod: mqttEnabled ? 5000 : 0,
    manualConnect: !mqttEnabled,
  },
);
if (!mqttEnabled) {
  console.log(
    "MQTT deshabilitado para este entorno",
  );
}

// ============================================================
// TYPES
// ============================================================

type DiagnosticCommand = {
  diagnosticId: string;
  siteId: string;
  requestedAt: string;
};

type DiagnosticResultMessage = {
  diagnosticId: string;
  siteId: string;
  result: DiagnosticPayload;
};

// ============================================================
// MQTT CONNECT
// ============================================================

const mqttLabMode = process.env.MQTT_LAB_MODE === "true";
if (
  mqttEnabled &&
  process.env.NODE_ENV !== "production" &&
  !mqttLabMode
) {
  throw new Error(
    "SEGURIDAD: MQTT de desarrollo requiere MQTT_LAB_MODE=true",
  );
}
const labTelemetryTopic = "TC180-000006/lab/sensores/";

mqttClient.on("connect", () => {
  console.log(
    mqttLabMode
      ? "MQTT conectado en modo LAB"
      : "MQTT conectado en modo normal",
  );

  const subscriptions: ISubscriptionMap = mqttLabMode
    ? {
        [labTelemetryTopic]: { qos: 0 as const },
      }
    : {
        "+/sensores/": { qos: 0 as const },
        "+/status": { qos: 1 as const },
        "+/diagnostics/result": { qos: 1 as const },
      };

  mqttClient.subscribe(
    subscriptions,
    (error: Error | null) => {
      if (error) {
        console.error(
          "Error suscribiendo a topics MQTT:",
          error.message,
        );
        return;
      }

      console.log(
        "MQTT suscrito a:",
        Object.keys(subscriptions).join(", "),
      );
    },
  );
});
// ============================================================
// SENSOR TELEMETRY
// ============================================================

async function processSensorTelemetry(
  deviceCode: string,
  payload: string,
) {
  const telemetry = JSON.parse(payload);

  const device = await prisma.device.findUnique({
    where: {
      deviceCode,
    },
  });

  if (!device) {
    console.error(
      `Dispositivo no encontrado: ${deviceCode}`,
    );
    return;
  }

    await prisma.device.update({
    where: {
      id: device.id,
    },
    data: {
      online: true,
      lastSeenAt: new Date(),
    },
  });
const relay1 = toNullableNumber(telemetry.relay1);

const falla =
  typeof telemetry.falla === "boolean"
    ? telemetry.falla
    : null;

const codigoFalla =
  typeof telemetry.codigoFalla === "string"
    ? telemetry.codigoFalla.slice(0, 100)
    : null;

const firmware =
  typeof telemetry.firmware === "string"
    ? telemetry.firmware.slice(0, 50)
    : null;

const measurementId =
  typeof telemetry.measurementId === "string" &&
  telemetry.measurementId.trim().length > 0
    ? telemetry.measurementId.trim().slice(0, 100)
    : null;

let savedTelemetry;

try {
  savedTelemetry = await prisma.deviceTelemetry.create({
    data: {
      deviceId: device.id,
      measurementId,
      nivel: toNullableNumber(telemetry.nivel),
      bateria: toNullableNumber(telemetry.bateria),
      senal: toNullableNumber(telemetry.senal),
      recarga: toNullableNumber(telemetry.recarga),
      consumo: toNullableNumber(telemetry.consumo),
      relay1:
        relay1 !== null && Number.isInteger(relay1)
          ? relay1
          : null,
      falla,
      codigoFalla,
      firmware,

      // El trabajo de alertas nace junto con la medición.
      // Si falla la validación o se reinicia la API,
      // el registro permanece disponible para recuperación.
      alertProcessingStatus: "PENDING",
    },
  });
} catch (error) {
  if (
    measurementId !== null &&
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === "P2002"
  ) {
    const existing = await prisma.deviceTelemetry.findUnique({
      where: {
        deviceId_measurementId: {
          deviceId: device.id,
          measurementId,
        },
      },
      select: { id: true },
    });

    if (existing) {
      console.log(
        `MQTT duplicado ignorado: ${deviceCode}, ` +
        `measurementId=${measurementId}`,
      );

      return;
    }
  }

  throw error;
}
  console.log(
    `Telemetría guardada: ${deviceCode}`,
  );

  if (telemetry.diagnostico !== undefined) {
  try {
    await saveDeviceDiagnostic(
      device.id,
      telemetry.diagnostico,
    );
  } catch (error) {
    console.error(
      `Error guardando diagnóstico de ${deviceCode}:`,
      error,
    );
  }
}

// Validar la lectura guardada antes de generar alertas.
let validated;

try {
  validated = await validateDeviceTelemetry(
    device.id,
    savedTelemetry.id,
    {
      nivel: telemetry.nivel,
      falla: telemetry.falla,
    },
  );

  console.log(
    `Validación ${deviceCode}: ` +
    `${validated.status} ` +
    `(${validated.reason ?? "OK"})`,
  );
} catch (error) {
  console.error(
    `Error validando telemetría de ${deviceCode}:`,
    error,
  );

  // La telemetría original ya fue guardada.
  // No generar alertas a partir de datos sin validar.
  return;
}

// Solo los niveles validados pueden generar o resolver alertas.
if (validated.status !== "VALID" || validated.nivel === null) {
  return;
}

// El trabajo de alerta ya está registrado en PostgreSQL.
//
// No procesamos alertas directamente desde MQTT.
// El AlertProcessingWorker se encargará de:
// - Procesar mediciones VALID.
// - Omitir mediciones REJECTED o SENSOR_ERROR.
// - Esperar la confirmación de mediciones PENDING.
// - Recuperar errores o interrupciones.
// - Evitar procesamiento duplicado.

console.log(
  `[MQTT] Trabajo de alerta registrado: ${savedTelemetry.id}`,
);

console.log(
  `[MQTT] Validación: ${validated.status}`,
);

}

// ============================================================
// DIAGNOSTIC RESULT
// Por ahora valida el resultado.
// Todavía NO modifica DiagnosticRun.
// ============================================================

async function processDiagnosticResult(
  deviceCode: string,
  payload: string,
) {
  const message = JSON.parse(
    payload,
  ) as DiagnosticResultMessage;

  if (
    !message.diagnosticId ||
    typeof message.diagnosticId !== "string"
  ) {
    console.error(
      "Resultado de diagnóstico sin diagnosticId",
    );
    return;
  }

  if (
    !message.siteId ||
    typeof message.siteId !== "string"
  ) {
    console.error(
      "Resultado de diagnóstico sin siteId",
    );
    return;
  }

  if (
    !message.result ||
    typeof message.result !== "object"
  ) {
    console.error(
      "Resultado de diagnóstico sin result",
    );
    return;
  }

  const agent = await prisma.device.findUnique({
    where: {
      deviceCode,
    },
    include: {
      model: true,
    },
  });

  if (!agent) {
    console.error(
      `Agente no encontrado: ${deviceCode}`,
    );
    return;
  }

  if (agent.model.type !== "AGENT") {
    console.error(
      `El dispositivo ${deviceCode} no es un AGENT`,
    );
    return;
  }

  if (agent.siteId !== message.siteId) {
    console.error(
      `El agente ${deviceCode} no pertenece al sitio recibido`,
    );
    return;
  }

  const diagnostic =
    await prisma.diagnosticRun.findUnique({
      where: {
        id: message.diagnosticId,
      },
      select: {
        id: true,
        siteId: true,
      },
    });

  if (!diagnostic) {
    console.error(
      `Diagnóstico no encontrado: ${message.diagnosticId}`,
    );
    return;
  }

  if (diagnostic.siteId !== agent.siteId) {
    console.error(
      `El diagnóstico ${diagnostic.id} no pertenece al sitio del agente ${deviceCode}`,
    );
    return;
  }

  try {
    const saved =
      await saveDiagnosticResult(
        diagnostic.id,
        message.result,
      );

    console.log(
      "Resultado de diagnóstico MQTT guardado",
    );
    console.log(
      `Agente: ${deviceCode}`,
    );
    console.log(
      `Diagnostic ID: ${diagnostic.id}`,
    );
    console.log(
      `Estado final: ${saved.diagnostic.status}`,
    );
  } catch (error) {
    if (
      error instanceof Error &&
      error.message ===
        "DIAGNOSTIC_RESULT_ALREADY_EXISTS"
    ) {
      console.warn(
        `El diagnóstico ${diagnostic.id} ya tiene resultado`,
      );
      return;
    }

    throw error;
  }
}

async function processAgentStatus(
  deviceCode: string,
  payload: string,
) {
  let statusPayload: Record<string, unknown> = {};

  if (payload.trim()) {
    try {
      statusPayload = JSON.parse(payload);
    } catch {
      console.error(
        `Payload de status inválido para ${deviceCode}`,
      );
      return;
    }
  }

  const online =
    statusPayload.online === false
      ? false
      : true;

  const agent = await prisma.device.findUnique({
    where: {
      deviceCode,
    },
    include: {
      model: true,
    },
  });

  if (!agent) {
    console.error(
      `Agente no encontrado: ${deviceCode}`,
    );
    return;
  }

  if (agent.model.type !== "AGENT") {
    console.error(
      `El dispositivo ${deviceCode} no es un AGENT`,
    );
    return;
  }

  await prisma.device.update({
    where: {
      id: agent.id,
    },
    data: {
      online,
      lastSeenAt: new Date(),

      ...(online &&
        typeof statusPayload.ip === "string" && {
          ip: statusPayload.ip,
        }),

      ...(online &&
        typeof statusPayload.hostname === "string" && {
          hostname: statusPayload.hostname,
        }),

      ...(online &&
        typeof statusPayload.firmware === "string" && {
          firmware: statusPayload.firmware,
        }),
    },
  });

  console.log(
    `Estado agente: ${deviceCode} -> ${
      online ? "ONLINE" : "OFFLINE"
    }`,
  );
}

// ============================================================
// MQTT MESSAGE ROUTER
// ============================================================

mqttClient.on(
  "message",
  (topic: string, message: Buffer) => {
    const payload = message.toString();
    const parts = topic.split("/");
    const deviceCode = parts[0];
    // Aislamiento de telemetría en modo laboratorio
    if (mqttLabMode && topic !== labTelemetryTopic) {
      console.warn(
        `[MQTT LAB] Mensaje ignorado: ${topic}`,
      );
      return;
     }

    console.log("MQTT mensaje recibido");
    console.log("Topic:", topic);
    console.log("Payload:", payload);

    if (!deviceCode) {
      console.error(
        `Topic MQTT inválido: ${topic}`,
      );
      return;
    }

    if (topic.endsWith("/sensores/")) {
      void processSensorTelemetry(
        deviceCode,
        payload,
      ).catch((error: unknown) => {
        console.error(
          "Error guardando telemetría MQTT:",
          error,
        );
      });

      return;
    }

    if (topic.endsWith("/status")) {
  void processAgentStatus(
    deviceCode,
    payload,
  ).catch((error: unknown) => {
    console.error(
      "Error procesando heartbeat del agente:",
      error,
    );
  });

  return;
}

    if (
      topic.endsWith("/diagnostics/result")
    ) {
      void processDiagnosticResult(
        deviceCode,
        payload,
      ).catch((error: unknown) => {
        console.error(
          "Error procesando resultado de diagnóstico MQTT:",
          error,
        );
      });

      return;
    }

    console.warn(
      `Topic MQTT sin manejador: ${topic}`,
    );
  },
);

// ============================================================
// PUBLISH DIAGNOSTIC COMMAND
// ============================================================

function publishDiagnosticCommand(
  deviceCode: string,
  command: DiagnosticCommand,
): Promise<void> {
  const topic =
    `${deviceCode}/diagnostics/command`;

  const payload = JSON.stringify(command);

  return new Promise((resolve, reject) => {
    if (!mqttClient.connected) {
      reject(
        new Error(
          "MQTT client is not connected",
        ),
      );
      return;
    }

    mqttClient.publish(
      topic,
      payload,
      {
        qos: 1,
        retain: false,
      },
      (error?: Error) => {
        if (error) {
          reject(error);
          return;
        }

        console.log(
          `MQTT diagnostic command published: ${topic}`,
        );

        console.log(
          `Diagnostic ID: ${command.diagnosticId}`,
        );

        resolve();
      },
    );
  });
}

// ============================================================
// MQTT EVENTS
// ============================================================

mqttClient.on("reconnect", () => {
  console.log(
    "MQTT intentando reconectar...",
  );
});

mqttClient.on(
  "error",
  (error: Error) => {
    console.error(
      "MQTT error:",
      error.message,
    );
  },
);

mqttClient.on("close", () => {
  console.log(
    "MQTT conexión cerrada",
  );
});


export {
  mqttClient,
  publishDiagnosticCommand,
};