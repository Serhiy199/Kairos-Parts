import { contractNotImplemented } from '@/lib/api/not-implemented';

export function POST() {
  return contractNotImplemented({
    module: 'notifications',
    method: 'POST',
    path: '/api/notifications',
    auth: 'system',
    summary: 'Queue or send a base customer notification by EMAIL or TELEGRAM.',
    request: '{ requestId?: string, userId?: string, channel: NotificationChannel, message: string }',
    response: 'NotificationContract',
    notes: ['Day 2 does not send email or Telegram messages.']
  });
}
