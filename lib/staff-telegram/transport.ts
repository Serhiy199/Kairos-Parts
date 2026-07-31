import 'server-only';

import { getStaffTelegramConfig } from '@/lib/staff-telegram/config';

const MAX_TELEGRAM_RESPONSE_BYTES = 4_096;

export type StaffTelegramSendResult =
  | { code: 'SENT'; durationMs: number; httpStatus: number }
  | { code: 'SKIPPED_DISABLED'; durationMs: number }
  | { code: 'FAILED_INPUT'; durationMs: number }
  | { code: 'FAILED_CONFIGURATION'; durationMs: number }
  | { code: 'FAILED_TIMEOUT'; durationMs: number }
  | { code: 'FAILED_NETWORK'; durationMs: number }
  | {
      code: 'FAILED_TELEGRAM_API';
      durationMs: number;
      httpStatus: number;
    };

export type StaffTelegramSendInput = {
  text: string;
  button?: {
    text: string;
    url: string;
  };
};

function isValidButton(input: NonNullable<StaffTelegramSendInput['button']>) {
  if (
    !input.text ||
    input.text !== input.text.trim() ||
    input.url !== input.url.trim() ||
    /[\u0000-\u001f\u007f]/.test(input.text) ||
    /[\u0000-\u001f\u007f]/.test(input.url)
  ) {
    return false;
  }

  try {
    const url = new URL(input.url);
    const isLocalDevelopmentUrl =
      url.protocol === 'http:' &&
      ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname);

    return (
      (url.protocol === 'https:' || isLocalDevelopmentUrl) &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash
    );
  } catch {
    return false;
  }
}

async function telegramResponseIsOk(response: Response) {
  if (!response.body) return false;

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let body = '';
  let bytesRead = 0;

  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;

      bytesRead += chunk.value.byteLength;
      if (bytesRead > MAX_TELEGRAM_RESPONSE_BYTES) {
        await reader.cancel();
        return false;
      }
      body += decoder.decode(chunk.value, { stream: true });
    }
    body += decoder.decode();
  } finally {
    reader.releaseLock();
  }

  try {
    const parsed = JSON.parse(body) as { ok?: unknown };
    return parsed.ok === true;
  } catch {
    return false;
  }
}

export async function sendStaffTelegramMessage(
  input: StaffTelegramSendInput
): Promise<StaffTelegramSendResult> {
  const startedAt = Date.now();
  const config = getStaffTelegramConfig();

  if (!config.enabled) {
    return { code: 'SKIPPED_DISABLED', durationMs: Date.now() - startedAt };
  }
  if ('configurationError' in config) {
    return { code: 'FAILED_CONFIGURATION', durationMs: Date.now() - startedAt };
  }
  if (input.button && !isValidButton(input.button)) {
    return { code: 'FAILED_INPUT', durationMs: Date.now() - startedAt };
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), config.timeoutMs);

  try {
    const response = await fetch(
      `https://api.telegram.org/bot${config.token}/sendMessage`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: config.chatId,
          text: input.text,
          disable_web_page_preview: true,
          ...(input.button
            ? {
                reply_markup: {
                  inline_keyboard: [[input.button]]
                }
              }
            : {})
        }),
        signal: controller.signal,
        cache: 'no-store'
      }
    );
    const apiOk = await telegramResponseIsOk(response);
    const durationMs = Date.now() - startedAt;

    if (response.ok && apiOk) {
      return { code: 'SENT', durationMs, httpStatus: response.status };
    }
    return {
      code: 'FAILED_TELEGRAM_API',
      durationMs,
      httpStatus: response.status
    };
  } catch {
    return {
      code: controller.signal.aborted
        ? 'FAILED_TIMEOUT'
        : 'FAILED_NETWORK',
      durationMs: Date.now() - startedAt
    };
  } finally {
    clearTimeout(timeout);
  }
}
