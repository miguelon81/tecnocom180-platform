import mqtt from "mqtt";
import { processLevelAlert } from "./levelAlerts";
import { prisma } from "../lib/prisma";
import {
  saveDiagnosticResult,
  type DiagnosticPayload,
} from "./diagnosticResults";

const brokerUrl = process.env.MQTT_BROKER_URL;
const username = process.env.MQTT_USERNAME;
const password = process.env.MQTT_PASSWORD;

if (!brokerUrl) {
  throw new Error("MQTT_BROKER_URL no está configurado");
}

if (!username) {
  throw new Error("MQTT_USERNAME no está configurado");
}

if (!password) {
  throw new Error("MQTT_PASSWORD no está configurado");
}

const mqttClient = mqtt.connect(brokerUrl, {
  username,
  password,
  clientId: `tecnocom180-api-${Math.random()
    .toString(16)
    .slice(2)}`,
  clean: true,
  reconnectPeriod: 5000,
});

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

mqttClient.on("connect", () => {
  console.log("MQTT conectado a HiveMQ Cloud");

    mqttClient.subscribe(
  {
    "+/sensores/": {
      qos: 0,
    },
    "+/status": {
      qos: 1,
    },
    "+/diagnostics/result": {
      qos: 1,
    },
  },
    (error: Error | null) => {
      if (error) {
        console.error(
          "Error suscribiendo a topics MQTT:",
          error.message,
        );
        return;
      }

      console.log("MQTT suscrito a +/sensores/");
      console.log("MQTT suscrito a +/status");
      console.log(
        "MQTT suscrito a +/diagnostics/result",
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
    },
  });

  await prisma.deviceTelemetry.create({
    data: {
      deviceId: device.id,

      nivel: Number.isFinite(
        Number(telemetry.nivel),
      )
        ? Number(telemetry.nivel)
        : null,

      bateria: Number.isFinite(
        Number(telemetry.bateria),
      )
        ? Number(telemetry.bateria)
        : null,

      senal: Number.isFinite(
        Number(telemetry.senal),
      )
        ? Number(telemetry.senal)
        : null,

      recarga: Number.isFinite(
        Number(telemetry.recarga),
      )
        ? Number(telemetry.recarga)
        : null,

      consumo: Number.isFinite(
        Number(telemetry.consumo),
      )
        ? Number(telemetry.consumo)
        : null,

      relay1: Number.isFinite(
        Number(telemetry.relay1),
      )
        ? Number(telemetry.relay1)
        : null,
    },
  });

  console.log(
    `Telemetría guardada: ${deviceCode}`,
  );

  void processLevelAlert(
    deviceCode,
    telemetry,
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