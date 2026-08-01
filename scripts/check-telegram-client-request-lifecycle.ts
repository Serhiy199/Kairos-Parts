import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function main() {
  const lifecycle = source('lib/notifications/status-change.ts');
  const draft = source('lib/request-items/create-draft.ts');
  const send = source('lib/request-selection/send-for-approval.ts');
  const submission = source('lib/request-selection/client-submission.ts');
  const adminAction = source('app/admin/actions.ts');
  const adminApi = source('app/api/admin/requests/[id]/status/route.ts');
  const telegramNotifications = source('lib/telegram/notifications.ts');

  for (const event of [
    'WORK_STARTED',
    'CLIENT_SELECTION_APPROVED',
    'CLIENT_SELECTION_REJECTED_ALL',
    'AWAITING_SHIPMENT',
    'COMPLETED',
    'CANCELLED_BY_MANAGER'
  ]) {
    assert.match(lifecycle, new RegExp(`${event}: '${event}'`));
  }
  assert.doesNotMatch(lifecycle, /REQUEST_STATUS_LABELS|extractTelegramChatId|chatId:/);
  assert.match(lifecycle, /clientProfile:\s*\{ select: \{ telegramChatId: true \} \}/);
  assert.match(lifecycle, /\/client\/requests\/\$\{requestId\}/);
  assert.match(lifecycle, /skipped-no-recipient/);
  assert.match(lifecycle, /catch \(error\)/);
  assert.match(draft, /result\.transition\.outcome === 'changed'/);
  assert.match(draft, /CLIENT_REQUEST_NOTIFICATION_EVENTS\.WORK_STARTED/);
  assert.match(draft, /Client work-started Telegram notification failed/);
  assert.match(send, /dependencies\.notify\(/);
  assert.match(send, /committed\.mode === 'RESEND_ACTIVE'/);
  assert.match(submission, /result\.outcome === 'changed'/);
  assert.match(submission, /CLIENT_SELECTION_REJECTED_ALL/);
  assert.match(submission, /CLIENT_SELECTION_APPROVED/);
  assert.match(submission, /Client selection Telegram notification failed/);
  assert.match(adminAction, /CLIENT_REQUEST_NOTIFICATION_EVENTS\.AWAITING_SHIPMENT/);
  assert.match(adminAction, /CLIENT_REQUEST_NOTIFICATION_EVENTS\.COMPLETED/);
  assert.match(adminAction, /CLIENT_REQUEST_NOTIFICATION_EVENTS\.CANCELLED_BY_MANAGER/);
  assert.match(adminApi, /notifyRequestLifecycleEvent/);
  assert.match(telegramNotifications, /Новий етап: позиції надіслано на погодження/);
  assert.match(telegramNotifications, /Новий етап: рахунок/);
  assert.doesNotMatch(lifecycle, /localhost|127\.0\.0\.1/);

  console.log('Telegram client lifecycle regression checks passed.');
}

main();
