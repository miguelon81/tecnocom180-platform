import { prisma } from "../lib/prisma";

type PilotIdentity = {
  organizationId: string;
  deviceId: string;
  recipient: string;
};

function getPilotIdentity(): PilotIdentity | null {
  const organizationId =
    process.env.TELEGRAM_PILOT_ORGANIZATION_ID?.trim();

  const deviceId =
    process.env.TELEGRAM_PILOT_DEVICE_ID?.trim();

  const recipient =
    process.env.TELEGRAM_PILOT_CHAT_ID?.trim();

  if (!organizationId || !deviceId || !recipient) {
    return null;
  }

  return {
    organizationId,
    deviceId,
    recipient,
  };
}

/**
 * Autoriza el destinatario solamente cuando el dispositivo
 * pertenece a la organización y al dispositivo configurados.
 *
 * Si falta configuración o no coincide la propiedad,
 * no se genera ninguna notificación Telegram.
 */
export async function getTelegramPilotRecipient(
  deviceId: string,
): Promise<string | null> {
  const pilot = getPilotIdentity();

  if (!pilot || deviceId !== pilot.deviceId) {
    return null;
  }

  const device = await prisma.device.findFirst({
    where: {
      id: pilot.deviceId,
      site: {
        organizationId: pilot.organizationId,
      },
    },
    select: {
      id: true,
    },
  });

  return device ? pilot.recipient : null;
}

/**
 * Segunda barrera de autorización para el envío.
 *
 * Verifica la relación completa:
 * notificación -> alerta -> dispositivo -> sitio -> organización.
 *
 * También comprueba que el destinatario sea el autorizado.
 */
export async function isTelegramPilotNotificationAllowed(
  notificationId: string,
): Promise<boolean> {
  const pilot = getPilotIdentity();

  if (!pilot) {
    return false;
  }

  const notification = await prisma.alertNotification.findFirst({
    where: {
      id: notificationId,
      channel: "TELEGRAM",
      recipient: pilot.recipient,
      alert: {
        deviceId: pilot.deviceId,
        device: {
          site: {
            organizationId: pilot.organizationId,
          },
        },
      },
    },
    select: {
      id: true,
    },
  });

  return notification !== null;
}