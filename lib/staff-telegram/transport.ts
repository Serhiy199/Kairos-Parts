import 'server-only';

import { getStaffTelegramConfig } from '@/lib/staff-telegram/config';

const MAX_TELEGRAM_RESPONSE_BYTES = 4_096;

export type StaffTelegramSendResult =
  | { code: 'SENT'; durationMs: number; httpStatus: number }
  | { code: 'SKIPPED_DISABLED'; durationMs: number }
  | { code: 'FAILED_CONFIGURATION'; durationMs: number }
  | { code: 'FAILED_TIMEOUT'; durationMs: number }
  | { code: 'FAILED_NETWORK'; durationMs: number }
  | {
      code: 'FAILED_TELEGRAM_API';
      durationMs: number;
      httpStatus: number;
    };

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
  text: string
): Promise<StaffTelegramSendResult> {
  const startedAt = Date.now();
  const config = getStaffTelegramConfig();

  if (!config.enabled) {
    return { code: 'SKIPPED_DISABLED', durationMs: Date.now() - startedAt };
  }
  if ('configurationError' in config) {
    return { code: 'FAILED_CONFIGURATION', durationMs: Date.now() - startedAt };
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
          text,
          disable_web_page_preview: true
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
