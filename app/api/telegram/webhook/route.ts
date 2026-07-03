import { hasDatabaseUrl } from '@/lib/env/database';
import { handleTelegramUpdate } from '@/lib/telegram/session';
import type { TelegramUpdate } from '@/lib/telegram/types';

export const runtime = 'nodejs';

function isAuthorized(request: Request) {
  const expectedSecret = process.env.TELEGRAM_WEBHOOK_SECRET;

  if (!expectedSecret) {
    return process.env.NODE_ENV !== 'production';
  }

  return request.headers.get('x-telegram-bot-api-secret-token') === expectedSecret;
}

export async function POST(request: Request) {
  if (!isAuthorized(request)) {
    return Response.json({ accepted: false }, { status: 401 });
  }

  if (!hasDatabaseUrl()) {
    return Response.json({ accepted: false, status: 'database_not_configured' }, { status: 503 });
  }

  try {
    const update = (await request.json()) as TelegramUpdate;
    await handleTelegramUpdate(update);
    return Response.json({ accepted: true });
  } catch (error) {
    return Response.json(
      {
        accepted: false,
        message: error instanceof Error ? error.message : 'Telegram update could not be processed.'
      },
      { status: 500 }
    );
  }
}
