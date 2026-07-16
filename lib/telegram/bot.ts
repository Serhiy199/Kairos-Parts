import type { TelegramSendDocumentOptions, TelegramSendMessageOptions } from './types';
import { randomUUID } from 'node:crypto';

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

export class TelegramApiError extends Error {
  method: string;
  status: number;
  errorCode?: number;
  description?: string;

  constructor({
    method,
    status,
    errorCode,
    description
  }: {
    method: string;
    status: number;
    errorCode?: number;
    description?: string;
  }) {
    super(description || `Telegram API ${method} failed.`);
    this.name = 'TelegramApiError';
    this.method = method;
    this.status = status;
    this.errorCode = errorCode;
    this.description = description;
  }
}

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
    throw new TelegramApiError({
      method,
      status: response.status,
      errorCode: payload.error_code,
      description: payload.description
    });
  }

  return payload.result;
}

async function parseTelegramResponse<T>(method: string, response: Response): Promise<T> {
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

function buildMultipartBody({
  fields,
  file
}: {
  fields: Record<string, string>;
  file: {
    fieldName: string;
    filename: string;
    contentType: string;
    buffer: Buffer;
  };
}) {
  const boundary = `kairos-parts-${randomUUID()}`;
  const chunks: Buffer[] = [];

  Object.entries(fields).forEach(([name, value]) => {
    chunks.push(
      Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="${name}"\r\n\r\n${value}\r\n`,
        'utf8'
      )
    );
  });

  chunks.push(
    Buffer.from(
      [
        `--${boundary}`,
        `Content-Disposition: form-data; name="${file.fieldName}"; filename="${sanitizeMultipartFilename(file.filename)}"`,
        `Content-Type: ${file.contentType}`,
        '',
        ''
      ].join('\r\n'),
      'utf8'
    )
  );
  chunks.push(file.buffer);
  chunks.push(Buffer.from(`\r\n--${boundary}--\r\n`, 'utf8'));

  return {
    boundary,
    body: Buffer.concat(chunks)
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
  const token = getBotToken();
  const fields: Record<string, string> = {
    chat_id: String(chatId)
  };

  if (caption) {
    fields.caption = caption;
  }

  if (replyMarkup) {
    fields.reply_markup = JSON.stringify(replyMarkup);
  }

  const multipart = buildMultipartBody({
    fields,
    file: {
      fieldName: 'document',
      filename,
      contentType: 'application/pdf',
      buffer
    }
  });
  const response = await fetch(`https://api.telegram.org/bot${token}/sendDocument`, {
    method: 'POST',
    headers: {
      'Content-Type': `multipart/form-data; boundary=${multipart.boundary}`,
      'Content-Length': String(multipart.body.length)
    },
    body: multipart.body
  });

  return parseTelegramResponse<T>('sendDocument', response);
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
