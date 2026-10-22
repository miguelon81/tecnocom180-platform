const botToken = process.env.TELEGRAM_BOT_TOKEN;
const defaultChatId = process.env.TELEGRAM_CHAT_ID;

type TelegramResponse = {
  ok: boolean;
  description?: string;
  result?: unknown;
};

async function sendTelegramMessage(
  text: string,
  chatId = defaultChatId,
): Promise<TelegramResponse> {

  if (!botToken) {
    throw new Error(
      "TELEGRAM_BOT_TOKEN no está configurado",
    );
  }

  if (!chatId) {
    throw new Error(
      "TELEGRAM_CHAT_ID no está configurado",
    );
  }

  const TELEGRAM_API_URL =
    `https://api.telegram.org/bot${botToken}`;

  const startedAt = Date.now();

  let response: Response;

  try {
    response = await fetch(
      `${TELEGRAM_API_URL}/sendMessage`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          chat_id: chatId,
          text,
        }),
        signal: AbortSignal.timeout(15000),
      },
    );
  } catch (error) {
    console.error("[Telegram] Error HTTP:", {
      elapsedMs: Date.now() - startedAt,
      error:
        error instanceof Error
          ? error.message
          : String(error),
      cause:
        error instanceof Error
          ? String(error.cause ?? "")
          : "",
    });

    throw error;
  }

  console.log("[Telegram] Respuesta HTTP:", {
    status: response.status,
    elapsedMs: Date.now() - startedAt,
  });

  const data =
    (await response.json()) as TelegramResponse;
  if (!response.ok || !data.ok) {
    throw new Error(
      `Telegram API error: ${
        data.description ?? response.statusText
      }`,
    );
  }

  return data;
}

export { sendTelegramMessage };