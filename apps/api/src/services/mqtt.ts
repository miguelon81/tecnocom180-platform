import mqtt from "mqtt";

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

  console.log(
    "Payload:",
    message.toString()
  );
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