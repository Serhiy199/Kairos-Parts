import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const page = read('app/admin/requests/[id]/page.tsx');

assert.match(page, /grid w-full min-w-0 max-w-full gap-4 sm:gap-5 xl:grid-cols-\[minmax\(0,1fr\)_minmax\(300px,360px\)\]/);
assert.match(page, /<main className="grid min-w-0/);
assert.match(page, /<aside className="grid h-fit min-w-0[^"]*xl:sticky xl:top-6/);

assert.match(page, /Підібрані позиції/);
assert.match(page, /min-\[1800px\]:grid-cols-\[minmax\(180px,1\.4fr\)/);
for (const criticalLabel of ['Запчастина', 'Номери', 'К-сть', 'Наявність', 'Ціна без ПДВ', 'Сума без ПДВ', 'Клієнт']) {
  assert.match(page, new RegExp(`>${criticalLabel}<`));
}

assert.match(page, /sendAdminRequestItemsForApproval/);
assert.match(page, /min-h-11 w-full[^"]*whitespace-normal[^"]*text-center/);
assert.doesNotMatch(page, /sm:min-w-\[280px\]/);

assert.match(page, /\[overflow-wrap:anywhere\][^"]*focus-visible:ring-2/);
assert.doesNotMatch(page, /break-all/);
assert.doesNotMatch(page, /line-clamp/);

assert.equal(page.match(/overflow-x-auto overscroll-x-contain/g)?.length, 2);
assert.match(page, /<table className="w-full min-w-\[940px\]/);
assert.match(page, /<table className="w-full min-w-\[1040px\]/);

for (const action of [
  'updateAdminRequestStatus',
  'assignAdminRequestManager',
  'sendAdminRequestItemsForApproval',
  'updateAdminRequestItem',
  'deleteAdminRequestItem'
]) {
  assert.match(page, new RegExp(`action={${action}}`));
}

assert.match(page, /function Info[\s\S]*?\[overflow-wrap:anywhere\]/);
assert.match(page, /className="h-11 w-full min-w-0/);
assert.doesNotMatch(page, /w-\[560px\]/);

console.log('Stage UI 11.5.1 targeted responsive checks passed.');

function read(path: string) {
  return readFileSync(resolve(process.cwd(), path), 'utf8');
}
