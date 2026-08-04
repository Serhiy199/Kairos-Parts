import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function main() {
  const action = source('app/client/actions.ts');
  const submission = source('lib/request-selection/client-submission.ts');
  const notifier = source('lib/staff-telegram/notifications.ts');
  const messages = source('lib/staff-telegram/messages.ts');
  const transport = source('lib/staff-telegram/transport.ts');
  const config = source('lib/staff-telegram/config.ts');
  const siteUrl = source('lib/site-url.ts');
  const schema = source('prisma/schema.prisma');

  assert.match(action, /submitClientSelection\(/);
  assert.match(submission, /isolationLevel: 'Serializable'/);
  assert.match(submission, /result\.outcome === 'changed' && dependencies\.notifyStaff/);
  assert.match(submission, /await dependencies\.notifyStaff\(/);
  assert.ok(
    submission.indexOf("await dependencies.notifyStaff(")
      > submission.indexOf('await database.$transaction(')
  );
  assert.match(submission, /CLIENT_APPROVAL_FINALIZED/);
  assert.match(submission, /Client selection Telegram notification failed/);
  assert.match(submission, /Staff Telegram approval notification failed/);
  assert.match(submission, /if \(finalizedBatchStatus\)/);
  assert.match(submission, /outcome: 'noop'/);
  assert.match(submission, /batch\.status !== 'SENT'/);

  assert.match(notifier, /notifyClientApprovalFinalized/);
  assert.match(notifier, /buildClientApprovalFinalizedMessage/);
  assert.match(notifier, /\/admin\/requests\/\$\{encodeURIComponent\(input\.id\)\}/);
  assert.match(notifier, /async function notify[\s\S]*try[\s\S]*catch/);
  assert.match(transport, /sendStaffTelegramMessage/);
  assert.match(config, /TELEGRAM_MANAGER_CHAT_ID/);
  assert.match(config, /TELEGRAM_BOT_TOKEN/);

  assert.match(messages, /✅ Клієнт погодив підібрані позиції/);
  assert.match(messages, /Погоджено позицій: \$\{input\.approvedCount\} із \$\{input\.totalCount\}/);
  assert.match(messages, /Можна формувати рахунок/);
  assert.match(messages, /❌ Клієнт скасував заявку на етапі погодження/);
  assert.match(messages, /Погоджено позицій: 0 із \$\{input\.totalCount\}/);
  assert.match(messages, /Клієнт не погодив жодної з підібраних позицій/);
  assert.match(messages, /Формування рахунку не потрібне/);
  assert.doesNotMatch(messages, /Email:/);
  assert.doesNotMatch(messages, /VIN:/);

  assert.match(siteUrl, /NODE_ENV === 'production'[\s\S]*return PUBLIC_SITE_ORIGIN/);
  assert.match(siteUrl, /PUBLIC_SITE_ORIGIN = 'https:\/\/kairos-parts\.com\.ua'/);
  assert.match(siteUrl, /url\.hostname\.endsWith\('\.vercel\.app'\)/);
  assert.match(schema, /model Notification/);
  assert.doesNotMatch(schema, /CLIENT_APPROVAL_FINALIZED/);

  console.log('Staff Telegram client-approval-finalized checks passed.');
}

main();
