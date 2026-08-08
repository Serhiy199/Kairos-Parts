import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const root = resolve(import.meta.dirname, '..');
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');

const page = read('app/admin/requests/[id]/page.tsx');
const access = read('lib/admin/access.ts');
const schema = read('prisma/schema.prisma');
const requestModel = schema.match(/model Request \{[\s\S]*?\n\}/)?.[0] ?? '';

assert.match(page, /export default async function AdminRequestDetailPage/);
assert.match(page, /const session = await requireCrmSession\(\)/);
assert.match(access, /const CRM_ROLES: UserRole\[\] = \['MANAGER', 'ADMIN'\]/);
assert.equal(existsSync(resolve(root, 'app/manager/requests/[id]/page.tsx')), false);

assert.doesNotMatch(page, /Привʼязана техніка/);
assert.doesNotMatch(page, /request\.vehicle(?:\.|\s*\?)/);
assert.doesNotMatch(page, /^\s*vehicle: true,\s*$/m);

for (const label of [
  'Виробник / марка',
  'Тип техніки',
  'Модель',
  'Рік випуску',
  'VIN / серійний номер',
  'Опис'
]) {
  assert.match(page, new RegExp(label.replace('/', '\\/')));
}

for (const section of ['Дії', 'Історія статусів', 'Повідомлення']) {
  assert.match(page, new RegExp(section));
}

assert.match(page, /<main className="grid min-w-0 gap-4 sm:gap-5 xl:gap-6">[\s\S]*?<RequestItemsSection/);
assert.match(page, /client:\s*\{[\s\S]*?vehicles: \{ orderBy: \{ createdAt: 'desc' \} \}/);
assert.match(requestModel, /vehicleId\s+String\?/);
assert.match(requestModel, /vehicle\s+Vehicle\?\s+@relation\(fields: \[vehicleId\], references: \[id\], onDelete: SetNull\)/);
assert.match(requestModel, /@@index\(\[vehicleId\]\)/);

console.log('Admin request-details linked-vehicle cleanup checks passed.');
