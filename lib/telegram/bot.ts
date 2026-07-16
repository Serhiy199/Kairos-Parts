import type { TelegramSendDocumentOptions, TelegramSendMessageOptions } from './types';
import TelegramBot, { type ReplyMarkup } from 'node-telegram-bot-api';

type TelegramApiResponse<T> = {
  ok: boolean;
  result?: T;
  error_code?: number;
  description?: string;
};

type TelegramFileResult = {
  file_id: string;
  file_unique_id?: string;
  file_size?: number;
  file_path?: string;
};

type TelegramLibraryErrorDetails = {
  httpStatus: number | null;
  errorCode: number | null;
  description: string | null;
  responsePreview: string | null;
};

export class TelegramApiError extends Error {
  method: string;
  status: number;
  errorCode?: number;
  description?: string;
  responsePreview?: string;

  constructor({
    method,
    status,
    errorCode,
    description,
    responsePreview
  }: {
    method: string;
    status: number;
    errorCode?: number;
    description?: string;
    responsePreview?: string;
  }) {
    super(description || `Telegram API ${method} failed.`);
    this.name = 'TelegramApiError';
    this.method = method;
    this.status = status;
    this.errorCode = errorCode;
    this.description = description;
    this.responsePreview = responsePreview;
  }
}

function getBotToken() {
  const token = process.env.TELEGRAM_BOT_TOKEN;

  if (!token) {
    throw new Error('TELEGRAM_BOT_TOKEN is not configured.');
  }

  return token;
}

let telegramBotClient: TelegramBot | null = null;

function getTelegramBotClient() {
  if (!telegramBotClient) {
    telegramBotClient = new TelegramBot(getBotToken(), {
      polling: false
    });
  }

  return telegramBotClient;
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
    throw new TelegramApiError({
      method,
      status: response.status,
      errorCode: payload.error_code,
      description: payload.description
    });
  }

  return payload.result;
}

function sanitizeMultipartFilename(filename: string) {
  return filename.replace(/[\r\n"]/g, '-');
}

function readStringProperty(source: unknown, key: string) {
  if (!source || typeof source !== 'object' || !(key in source)) {
    return null;
  }

  const value = (source as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
}

function readNumberProperty(source: unknown, key: string) {
  if (!source || typeof source !== 'object' || !(key in source)) {
    return null;
  }

  const value = (source as Record<string, unknown>)[key];
  return typeof value === 'number' ? value : null;
}

function normalizeTelegramLibraryError(error: unknown): TelegramLibraryErrorDetails {
  const response = error && typeof error === 'object' && 'response' in error
    ? (error as { response?: unknown }).response
    : null;
  const responseBody = response && typeof response === 'object' && 'body' in response
    ? (response as { body?: unknown }).body
    : null;
  const responseStatus = response && typeof response === 'object'
    ? readNumberProperty(response, 'status') ?? readNumberProperty(response, 'statusCode')
    : null;
  const bodyStatus = readNumberProperty(responseBody, 'status') ?? readNumberProperty(responseBody, 'statusCode');
  const errorCode = readNumberProperty(responseBody, 'error_code') ?? readNumberProperty(responseBody, 'errorCode');
  const description =
    readStringProperty(responseBody, 'description') ??
    readStringProperty(responseBody, 'message') ??
    (error instanceof Error ? error.message : null);
  const responsePreview = responseBody
    ? JSON.stringify(responseBody).slice(0, 300)
    : readStringProperty(response, 'body')?.slice(0, 300) ?? null;

  return {
    httpStatus: responseStatus ?? bodyStatus ?? null,
    errorCode,
    description,
    responsePreview
  };
}

async function telegramDocumentApi<T>({
  chatId,
  buffer,
  filename,
  caption,
  replyMarkup
}: {
  chatId: string | number;
  buffer: Buffer;
  filename: string;
  caption?: string;
  replyMarkup?: Record<string, unknown>;
}): Promise<T> {
  try {
    const result = await getTelegramBotClient().sendDocument(
      chatId,
      buffer,
      {
        caption,
        reply_markup: replyMarkup as ReplyMarkup | undefined
      },
      {
        filename: sanitizeMultipartFilename(filename),
        contentType: 'application/pdf'
      }
    );

    return {
      file_id: result.document?.file_id ?? '',
      file_unique_id: result.document?.file_unique_id,
      file_size: result.document?.file_size,
      file_path: undefined
    } as T;
  } catch (error) {
    const normalizedError = normalizeTelegramLibraryError(error);

    throw new TelegramApiError({
      method: 'sendDocument',
      status: normalizedError.httpStatus ?? 0,
      errorCode: normalizedError.errorCode ?? undefined,
      description: normalizedError.description ?? 'Telegram sendDocument failed.',
      responsePreview: normalizedError.responsePreview ?? undefined
    });
  }
}

export async function sendTelegramMessage(chatId: string | number, text: string, options: TelegramSendMessageOptions = {}) {
  return telegramApi('sendMessage', {
    chat_id: chatId,
    text,
    parse_mode: options.parseMode,
    reply_markup: options.replyMarkup
  });
}

export async function sendTelegramDocument({
  chatId,
  buffer,
  filename,
  caption,
  options = {}
}: {
  chatId: string | number;
  buffer: Buffer;
  filename: string;
  caption?: string;
  options?: TelegramSendDocumentOptions;
}) {
  return telegramDocumentApi<TelegramFileResult>({
    chatId,
    buffer,
    filename,
    caption: caption ?? options.caption,
    replyMarkup: options.replyMarkup
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
