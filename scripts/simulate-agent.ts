import mqtt from "mqtt";

const brokerUrl = process.env.MQTT_BROKER_URL;
const username = process.env.MQTT_USERNAME;
const password = process.env.MQTT_PASSWORD;

const DEVICE_CODE = "TC180-AG-000001";

if (!brokerUrl) {
  throw new Error("MQTT_BROKER_URL no está configurado");
}

if (!username) {
  throw new Error("MQTT_USERNAME no está configurado");
}

if (!password) {
  throw new Error("MQTT_PASSWORD no está configurado");
}

const STATUS_TOPIC =
  `${DEVICE_CODE}/status`;

const client = mqtt.connect(brokerUrl, {
  username,
  password,

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
  const status = {
    online: true,
    hostname: "tc180-hotel-demo",
    ip: "192.168.1.50",
    firmware: "simulator-1.0.0",
    timestamp: new Date().toISOString(),
  };

  client.publish(
    STATUS_TOPIC,
    JSON.stringify(status),
    {
      qos: 1,
      retain: true,
    },
    (error?: Error) => {
      if (error) {
        console.error(
          "Error enviando heartbeat:",
          error.message,
        );
        return;
      }

      console.log(
        `Heartbeat enviado: ${STATUS_TOPIC}`,
      );
    },
  );
}

client.on("connect", () => {
  console.log("SIMULADOR conectado a HiveMQ");

  const commandTopic =
    `${DEVICE_CODE}/diagnostics/command`;

  client.subscribe(
    commandTopic,
    { qos: 1 },
    (error) => {
      if (error) {
        console.error(
          "Error suscribiendo:",
          error.message,
        );
        return;
      }

      console.log(
        `Escuchando: ${commandTopic}`,
      );
      console.log(
        "Esperando diagnóstico...",
      );
    },
  );

  publishStatus();

  setInterval(
    publishStatus,
    30_000,
  );
});

client.on(
  "message",
  (topic: string, message: Buffer) => {
    const payload = message.toString();

    console.log("");
    console.log("COMANDO RECIBIDO");
    console.log("Topic:", topic);
    console.log("Payload:", payload);

    try {
      const command = JSON.parse(payload);

      if (
        !command.diagnosticId ||
        !command.siteId
      ) {
        console.error("Comando incompleto");
        return;
      }

      const resultTopic =
        `${DEVICE_CODE}/diagnostics/result`;

      const resultMessage = {
        diagnosticId: command.diagnosticId,
        siteId: command.siteId,

        result: {
          status: "PASS",

          summary: {
            pass: 5,
            warning: 0,
            fail: 0,
            skip: 0,
          },

          internetRoute: {
            interface: "eth0",
            sourceIp: "192.168.1.50",
            gateway: "192.168.1.1",
          },

          latency: {
            pingMs: 12.4,
            packetLoss: 0,
          },

          dns: {
            servers: [
              "1.1.1.1",
              "8.8.8.8",
            ],
            operational: true,
          },

          internet: true,

          wifi: {
            ssid: "SIMULATED-WIFI",
            bssid: "AA:BB:CC:DD:EE:FF",
            frequencyMHz: 5180,
            signalDbm: -48,
            rxBitrateMbps: 433.3,
            txBitrateMbps: 433.3,
          },
        },
      };

      client.publish(
        resultTopic,
        JSON.stringify(resultMessage),
        {
          qos: 1,
          retain: false,
        },
        (error?: Error) => {
          if (error) {
            console.error(
              "Error enviando resultado:",
              error.message,
            );
            return;
          }

          console.log("");
          console.log(
            "RESULTADO SIMULADO ENVIADO",
          );
          console.log(
            `Topic: ${resultTopic}`,
          );
          console.log(
            `Diagnostic ID: ${command.diagnosticId}`,
          );
        },
      );
    } catch (error) {
      console.error(
        "Error procesando comando:",
        error,
      );
    }
  },
);

client.on(
  "error",
  (error: Error) => {
    console.error(
      "MQTT simulator error:",
      error.message,
    );
  },
);
