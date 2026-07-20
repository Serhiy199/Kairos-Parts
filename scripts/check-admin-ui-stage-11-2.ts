import assert from 'node:assert/strict';

import { formatAuditMetadata } from '../lib/audit-log/presentation';
import { parseTaxonomySortOrder } from '../lib/vehicles/taxonomy-sort-order';

assert.equal(parseTaxonomySortOrder('0'), 0);
assert.equal(parseTaxonomySortOrder('999'), 999);
assert.equal(parseTaxonomySortOrder(''), 0);
assert.equal(parseTaxonomySortOrder('-1'), null);
assert.equal(parseTaxonomySortOrder('1000'), null);
assert.equal(parseTaxonomySortOrder('1.5'), null);
assert.equal(parseTaxonomySortOrder('not-a-number'), null);

const details = formatAuditMetadata({
  event: 'VEHICLE_CREATED',
  actorRole: 'ADMIN',
  ownerType: 'client',
  fieldName: 'equipmentType',
  action: 'UPDATE',
  ownerId: 'technical-owner-id',
  originalEntityId: 'technical-entity-id',
  customLegacyValue: { nestedLabel: 'Значення', nestedId: 'technical-nested-id' }
});

assert.deepEqual(
  details.slice(0, 5).map(({ label, value }) => [label, value]),
  [
    ['Подія', 'Техніку створено'],
    ['Роль виконавця', 'Адміністратор'],
    ['Тип власника', 'Клієнт'],
    ['Поле', 'Тип техніки'],
    ['Дія', 'Оновлення']
  ]
);
assert.equal(details.some(({ key }) => key === 'ownerId' || key === 'originalEntityId'), false);
assert.equal(details.find(({ key }) => key === 'customLegacyValue')?.value, 'nested Label: Значення');
assert.equal(formatAuditMetadata(null).length, 0);

console.log('Stage Admin UI 11.2 targeted checks passed.');
