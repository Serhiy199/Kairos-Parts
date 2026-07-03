import type { TelegramSendMessageOptions } from './types';

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  description?: string;
};

type TelegramFileResult = {
  file_id: string;
  file_unique_id?: string;
  file_size?: number;
  file_path?: string;
};

function getBotToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is not configured.');
  }

  return token;
}

async function telegramApi<T>(method: string, body: Record<string, unknown>): Promise<T> {
  const token = getBotToken();
  const response = await fetch(`https://api.telegram.org/bot${token}/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const payload = (await response.json()) as TelegramApiResponse<T>;

  if (!response.ok || !payload.ok || payload.result === undefined) {
    throw new Error(payload.description || `Telegram API ${method} failed.`);
  }

  return payload.result;
}

export async function sendTelegramMessage(chatId: string | number, text: string, options: TelegramSendMessageOptions = {}) {
  return telegramApi('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: options.parseMode,
    reply_markup: options.replyMarkup
  });
}

export async function answerCallbackQuery(callbackQueryId: string, text?: string) {
  return telegramApi('answerCallbackQuery', {
    callback_query_id: callbackQueryId,
    text
  });
}

export async function getTelegramFile(fileId: string) {
  return telegramApi<TelegramFileResult>('getFile', {
    file_id: fileId
  });
}

export async function downloadTelegramFile(filePath: string) {
  const token = getBotToken();
  const response = await fetch(`https://api.telegram.org/file/bot${token}/${filePath}`);

  if (!response.ok) {
    throw new Error('Telegram file download failed.');
  }

  return Buffer.from(await response.arrayBuffer());
}
