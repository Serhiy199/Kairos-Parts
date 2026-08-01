import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

function source(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}

function occurrences(value: string, pattern: RegExp) {
  return [...value.matchAll(pattern)].length;
}

function main() {
  const webRoute = source('app/api/requests/route.ts');
  const telegramSession = source('lib/telegram/session.ts');
  const notifier = source('lib/staff-telegram/notifications.ts');
  const config = source('lib/staff-telegram/config.ts');
  const messages = source('lib/staff-telegram/messages.ts');
  const siteUrl = source('lib/site-url.ts');
  const logistics = source('lib/logistics/create-request.ts');
  const usedEquipment = source('app/(public)/used-equipment/actions.ts');

  assert.equal(occurrences(webRoute, /await notifyNewPartsRequest\(/g), 1);
  assert.equal(occurrences(telegramSession, /await notifyNewPartsRequest\(/g), 1);
  assert.ok(webRoute.indexOf('await notifyNewPartsRequest(') > webRoute.indexOf('await uploadRequestFilesForActor('));
  assert.ok(telegramSession.indexOf('await notifyNewPartsRequest(') > telegramSession.indexOf('await prisma.telegramDraftRequest.delete('));
  assert.match(notifier, /async function notify[\s\S]*try[\s\S]*catch/);
  assert.match(config, /TELEGRAM_MANAGER_CHAT_ID/);
  assert.match(config, /TELEGRAM_BOT_TOKEN/);
  assert.match(messages, /Нова заявка на підбір запчастин/);
  assert.match(messages, /Техніка:/);
  assert.match(messages, /Опис:/);
  assert.match(messages, /Джерело:/);
  assert.match(notifier, /\/admin\/requests\//);
  assert.match(siteUrl, /NODE_ENV === 'production'[\s\S]*return PUBLIC_SITE_ORIGIN/);
  assert.match(siteUrl, /PUBLIC_SITE_ORIGIN = 'https:\/\/kairos-parts\.com\.ua'/);
  assert.doesNotMatch(logistics, /notifyNewPartsRequest/);
  assert.doesNotMatch(usedEquipment, /notifyNewPartsRequest/);

  console.log('Telegram manager request-created regression checks passed.');
}

main();
