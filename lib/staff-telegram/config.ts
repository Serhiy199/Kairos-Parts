import 'server-only';

const STAFF_TELEGRAM_TIMEOUT_MS = 7_000;

export type StaffTelegramConfig =
  | { enabled: false }
  | {
      enabled: true;
      token: string;
      chatId: string;
      timeoutMs: number;
    }
  | {
      enabled: true;
      configurationError: true;
    };

function isExplicitlyEnabled(value: string | undefined) {
  return value?.trim().toLowerCase() === 'true';
}

export function getStaffTelegramConfig(): StaffTelegramConfig {
  const managerChatId = process.env.TELEGRAM_MANAGER_CHAT_ID?.trim() ?? '';
  const usesSharedBot = managerChatId.length > 0;
  if (
    !usesSharedBot &&
    !isExplicitlyEnabled(
      process.env.STAFF_TELEGRAM_NOTIFICATIONS_ENABLED
    )
  ) {
    return { enabled: false };
  }

  const token = usesSharedBot
    ? process.env.TELEGRAM_BOT_TOKEN?.trim() ?? ''
    : process.env.STAFF_TELEGRAM_BOT_TOKEN?.trim() ?? '';
  const chatId = usesSharedBot
    ? managerChatId
    : process.env.STAFF_TELEGRAM_CHAT_ID?.trim() ?? '';

  if (
    !/^\d+:[A-Za-z0-9_-]+$/.test(token) ||
    !/^-?\d+$/.test(chatId)
  ) {
    return { enabled: true, configurationError: true };
  }

  return {
    enabled: true,
    token,
    chatId,
    timeoutMs: STAFF_TELEGRAM_TIMEOUT_MS
  };
}
