const botToken = process.env.TELEGRAM_BOT_TOKEN;
const defaultChatId = process.env.TELEGRAM_CHAT_ID;

if (!botToken) {
  throw new Error("TELEGRAM_BOT_TOKEN no está configurado");
}

const TELEGRAM_API_URL = `https://api.telegram.org/bot${botToken}`;

type TelegramResponse = {
  ok: boolean;
  description?: string;
  result?: unknown;
};

async function sendTelegramMessage(
  text: string,
  chatId = defaultChatId,
): Promise<TelegramResponse> {
  if (!chatId) {
    throw new Error("TELEGRAM_CHAT_ID no está configurado");
  }

  const response = await fetch(`${TELEGRAM_API_URL}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      chat_id: chatId,
      text,
    }),
  });

  const data = (await response.json()) as TelegramResponse;

  if (!response.ok || !data.ok) {
    throw new Error(
      `Telegram API error: ${data.description ?? response.statusText}`,
    );
  }

  return data;
}

export { sendTelegramMessage };