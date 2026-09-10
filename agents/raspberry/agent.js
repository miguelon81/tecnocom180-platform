require("dotenv").config();
const mqtt = require("mqtt");
const { execFile } = require("child_process");
const os = require("os");

const DEVICE_CODE = process.env.AGENT_CODE || "TC180-AG-000001";

const MQTT_BROKER_URL = process.env.MQTT_BROKER_URL;
const MQTT_USERNAME = process.env.MQTT_USERNAME;
const MQTT_PASSWORD = process.env.MQTT_PASSWORD;

const SCRIPT_PATH =
  process.env.DIAGNOSTIC_SCRIPT ||
  "/home/miguelpi/tecnocom180-agent/diagnostico_red_v8.sh";

const STATUS_TOPIC = `${DEVICE_CODE}/status`;
const COMMAND_TOPIC = `${DEVICE_CODE}/diagnostics/command`;
const RESULT_TOPIC = `${DEVICE_CODE}/diagnostics/result`;

const HEARTBEAT_INTERVAL_MS = 30_000;
const DIAGNOSTIC_TIMEOUT_MS = 180_000;

if (!MQTT_BROKER_URL) {
  console.error("Falta MQTT_BROKER_URL");
  process.exit(1);
}

if (!MQTT_USERNAME) {
  console.error("Falta MQTT_USERNAME");
  process.exit(1);
}

if (!MQTT_PASSWORD) {
  console.error("Falta MQTT_PASSWORD");
  process.exit(1);
}

function getLocalIp() {
  const interfaces = os.networkInterfaces();

  for (const entries of Object.values(interfaces)) {
    if (!entries) continue;

    for (const entry of entries) {
      if (
        entry.family === "IPv4" &&
        !entry.internal
      ) {
        return entry.address;
      }
    }
  }

  return null;
}

function buildStatusPayload(online) {
  return {
    online,
    hostname: os.hostname(),
    ip: online ? getLocalIp() : undefined,
    firmware: "agent-1.0.0",
    timestamp: new Date().toISOString(),
  };
}

const client = mqtt.connect(MQTT_BROKER_URL, {
  username: MQTT_USERNAME,
  password: MQTT_PASSWORD,

  reconnectPeriod: 5000,
  connectTimeout: 10000,

  will: {
    topic: STATUS_TOPIC,
    payload: JSON.stringify({
      online: false,
      timestamp: new Date().toISOString(),
    }),
    qos: 1,
    retain: true,
  },
});

function publishStatus() {
  if (!client.connected) {
    return;
  }

  const payload = buildStatusPayload(true);

  client.publish(
    STATUS_TOPIC,
    JSON.stringify(payload),
    {
      qos: 1,
      retain: true,
    },
    (error) => {
      if (error) {
        console.error("Error enviando heartbeat:", error.message);
        return;
      }

      console.log(
        `[HEARTBEAT] ${DEVICE_CODE} ${payload.ip || "sin IP"}`
      );
    }
  );
}

function runDiagnostic(command) {
  return new Promise((resolve, reject) => {
    const child = execFile(
      SCRIPT_PATH,
      ["--json"],
      {
        timeout: DIAGNOSTIC_TIMEOUT_MS,
        maxBuffer: 1024 * 1024,
      },
      (error, stdout, stderr) => {
        if (error) {
          console.error(
            "Error ejecutando diagnóstico:",
            error.message
          );

          if (stderr) {
            console.error(stderr.trim());
          }

          reject(error);
          return;
        }

        const output = stdout.trim();

        if (!output) {
          reject(
            new Error(
              "El script de diagnóstico no produjo salida"
            )
          );
          return;
        }

        try {
          const result = JSON.parse(output);

          resolve({
            diagnosticId: command.diagnosticId,
            siteId: command.siteId,
            result,
          });
        } catch (parseError) {
          console.error(
            "Salida inválida del diagnóstico:"
          );
          console.error(output);

          reject(
            new Error(
              "El script no produjo JSON válido"
            )
          );
        }
      }
    );

    child.on("error", (error) => {
      console.error(
        "No se pudo iniciar el script:",
        error.message
      );
    });
  });
}

let diagnosticRunning = false;
let currentDiagnosticId = null;

async function processDiagnosticCommand(message) {
  let command;

  try {
    command = JSON.parse(message.toString());
  } catch {
    console.error(
      "Comando MQTT inválido: no es JSON"
    );
    return;
  }

  if (
    !command.diagnosticId ||
    !command.siteId
  ) {
    console.error(
      "Comando MQTT inválido: faltan diagnosticId o siteId"
    );
    return;
  }

  if (diagnosticRunning) {
    if (
      currentDiagnosticId === command.diagnosticId
    ) {
      console.log(
        `Comando duplicado ignorado: ${command.diagnosticId}`
      );
      return;
    }

    console.warn(
      `Ya existe un diagnóstico en ejecución: ${currentDiagnosticId}`
    );
    return;
  }

  diagnosticRunning = true;
  currentDiagnosticId = command.diagnosticId;

  console.log("");
  console.log("========================================");
  console.log("DIAGNÓSTICO RECIBIDO");
  console.log("========================================");
  console.log(
    "Diagnostic ID:",
    command.diagnosticId
  );
  console.log("Site ID:", command.siteId);
  console.log(
    "Ejecutando:",
    SCRIPT_PATH,
    "--json"
  );

  try {
    const resultMessage =
      await runDiagnostic(command);

    client.publish(
      RESULT_TOPIC,
      JSON.stringify(resultMessage),
      {
        qos: 1,
        retain: false,
      },
      (error) => {
        if (error) {
          console.error(
            "Error publicando resultado:",
            error.message
          );
          return;
        }

        console.log("");
        console.log(
          "RESULTADO PUBLICADO"
        );
        console.log(
          "Topic:",
          RESULT_TOPIC
        );
        console.log(
          "Diagnostic ID:",
          command.diagnosticId
        );
        console.log(
          "Estado:",
          resultMessage.result.status
        );
      }
    );
  } catch (error) {
    console.error(
      "Diagnóstico falló:",
      error.message
    );
  } finally {
    diagnosticRunning = false;
    currentDiagnosticId = null;
  }
}

client.on("connect", () => {
  console.log("");
  console.log(
    `Agente ${DEVICE_CODE} conectado a MQTT`
  );

  client.subscribe(
    COMMAND_TOPIC,
    {
      qos: 1,
    },
    (error) => {
      if (error) {
        console.error(
          "Error suscribiendo comando:",
          error.message
        );
        return;
      }

      console.log(
        "Escuchando:",
        COMMAND_TOPIC
      );

      publishStatus();
    }
  );
});

client.on(
  "message",
  (topic, message) => {
    if (topic === COMMAND_TOPIC) {
      processDiagnosticCommand(message);
    }
  }
);

client.on("reconnect", () => {
  console.log(
    "Reconectando a MQTT..."
  );
});

client.on("offline", () => {
  console.log(
    "Conexión MQTT offline"
  );
});

client.on("error", (error) => {
  console.error(
    "MQTT error:",
    error.message
  );
});

setInterval(
  publishStatus,
  HEARTBEAT_INTERVAL_MS
);