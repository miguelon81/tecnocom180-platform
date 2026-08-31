import mqtt from "mqtt";
import { processLevelAlert } from "./levelAlerts";
import { prisma } from "../lib/prisma";

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

mqttClient.on("connect", () => {
  console.log("MQTT conectado a HiveMQ Cloud");

  mqttClient.subscribe(
    "+/sensores/",
    { qos: 0 },
    (error) => {
      if (error) {
        console.error(
          "Error suscribiendo a sensores:",
          error.message
        );
        return;
      }

      console.log(
        "MQTT suscrito a +/sensores/"
      );
    }
  );
});

mqttClient.on("message", (topic, message) => {
  console.log("MQTT mensaje recibido");
  console.log("Topic:", topic);

  const payload = message.toString();

  console.log("Payload:", payload);

  try {
    const telemetry = JSON.parse(payload);

    const deviceKey = topic.split("/")[0];

    void (async () => {
      const device = await prisma.device.findUnique({
        where: {
          deviceCode: deviceKey,
        },
      });

      if (!device) {
        console.error(
          `Dispositivo no encontrado: ${deviceKey}`
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
          nivel: Number.isFinite(Number(telemetry.nivel))
            ? Number(telemetry.nivel)
            : null,
          bateria: Number.isFinite(Number(telemetry.bateria))
            ? Number(telemetry.bateria)
            : null,
          senal: Number.isFinite(Number(telemetry.senal))
            ? Number(telemetry.senal)
            : null,
          recarga: Number.isFinite(Number(telemetry.recarga))
            ? Number(telemetry.recarga)
            : null,
          consumo: Number.isFinite(Number(telemetry.consumo))
            ? Number(telemetry.consumo)
            : null,
          relay1: Number.isFinite(Number(telemetry.relay1))
            ? Number(telemetry.relay1)
            : null,
        },
      });

      console.log(
        `Telemetría guardada: ${deviceKey}`
      );

      void processLevelAlert(
        deviceKey,
        telemetry,
      );
    })().catch((error) => {
      console.error(
        "Error guardando telemetría MQTT:",
        error
      );
    });
  } catch (error) {
    console.error(
      "Error procesando payload MQTT:",
      error,
    );
  }
});

mqttClient.on("reconnect", () => {
  console.log(
    "MQTT intentando reconectar..."
  );
});

mqttClient.on("error", (error) => {
  console.error(
    "MQTT error:",
    error.message
  );
});

mqttClient.on("close", () => {
  console.log(
    "MQTT conexión cerrada"
  );
});

export { mqttClient };