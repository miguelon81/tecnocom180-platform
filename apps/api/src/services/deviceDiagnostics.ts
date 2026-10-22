import { prisma } from "../lib/prisma";

type SensorDiagnostic = {
  estado?: unknown;
  codigo?: unknown;
  sensor?: unknown;
  intentos?: unknown;
  detalle?: unknown;
  severidad?: unknown;
  ocurridoEn?: unknown;
};

export async function saveDeviceDiagnostic(
  deviceId: string,
  diagnostic: unknown,
): Promise<void> {
  if (
    !diagnostic ||
    typeof diagnostic !== "object" ||
    Array.isArray(diagnostic)
  ) {
    return;
  }

  const data = diagnostic as SensorDiagnostic;

  // No registrar eventos cuando todo funciona correctamente.
  if (data.estado === "OK") {
    return;
  }

  if (
    typeof data.codigo !== "string" ||
    !data.codigo.trim()
  ) {
    console.warn(
      `Diagnóstico ignorado: código inválido (${deviceId})`,
    );
    return;
  }

  const attempts = Number(data.intentos);

  const occurredAt =
    typeof data.ocurridoEn === "string"
      ? new Date(data.ocurridoEn)
      : null;

  await prisma.deviceDiagnosticEvent.create({
    data: {
      deviceId,
      code: data.codigo,
      component:
        typeof data.sensor === "string"
          ? data.sensor
          : null,
      severity:
        typeof data.severidad === "string"
          ? data.severidad
          : "WARNING",
      detail:
        typeof data.detalle === "string"
          ? data.detalle
          : null,
      attempts:
        data.intentos !== null &&
        data.intentos !== undefined &&
        Number.isInteger(attempts) &&
        attempts >= 0
          ? attempts
          : null,
      occurredAt:
        occurredAt && !Number.isNaN(occurredAt.getTime())
          ? occurredAt
          : null,
    },
  });

  console.log(
    `Diagnóstico ESP32 registrado: ${deviceId} - ${data.codigo}`,
  );
}