import { contractNotImplemented } from '@/lib/api/not-implemented';

export function POST() {
  return contractNotImplemented({
    module: 'telegram-bot',
    method: 'POST',
    path: '/api/telegram/webhook',
    auth: 'system',
    summary: 'Receive Telegram Bot API webhook updates after validating TELEGRAM_WEBHOOK_SECRET.',
    request: 'Telegram update payload',
    response: '{ accepted: boolean }',
    notes: ['Day 2 does not implement bot scenarios.']
  });
}
