import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  isManualRequestStatus,
  MANUAL_REQUEST_STATUSES,
  normalizeRequestStatusForSelection
} from '../lib/requests/statuses';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const aggregateSubmissionService = read('lib/request-selection/client-submission.ts');
const adminAction = read('app/admin/actions.ts');
const adminApi = read('app/api/admin/requests/[id]/status/route.ts');
const adminUi = read('app/admin/requests/[id]/page.tsx');
const invoiceSelection = read('lib/invoices/selection.ts');

assert.equal(normalizeRequestStatusForSelection('AWAITING_INVOICE'), 'AWAITING_INVOICE');
assert.equal(normalizeRequestStatusForSelection('INVOICE_SENT'), 'INVOICE_SENT');
assert.deepEqual(MANUAL_REQUEST_STATUSES, [
  'AWAITING_SHIPMENT',
  'COMPLETED',
  'CANCELLED'
]);
assert.equal(isManualRequestStatus('NEW'), false);
assert.equal(isManualRequestStatus('AWAITING_INVOICE'), false);
assert.equal(isManualRequestStatus('AWAITING_SHIPMENT'), true);

for (const token of [
  'FINALIZATION_INVARIANT_FAILED',
  'requestReachedTarget',
  'persistedRequest.status'
]) {
  assert.ok(
    aggregateSubmissionService.includes(token),
    `Aggregate finalization invariant is missing: ${token}`
  );
}

for (const source of [adminAction, adminApi]) {
  assert.ok(source.includes("intent !== 'manual-status-change'"));
  assert.ok(source.includes('isManualRequestStatus'));
  assert.ok(source.includes('transitionRequestStatus'));
  assert.ok(!source.includes("data: { status: nextStatus }"));
}
assert.ok(adminUi.includes('Поточний статус:'));
assert.ok(adminUi.includes('MANUAL_REQUEST_STATUSES.map'));
assert.ok(adminUi.includes('name="intent" value="manual-status-change"'));
assert.ok(!adminUi.includes('defaultValue={selectedRequestStatus}'));

for (const reason of [
  'REQUEST_NOT_AWAITING_INVOICE',
  'NO_FINALIZED_APPROVED_BATCH',
  'NO_APPROVED_ITEMS',
  'PENDING_ITEMS_REMAIN',
  'APPROVED_ITEM_PRICE_MISSING',
  'APPROVED_ITEMS_CURRENCY_MISMATCH',
  'INVOICE_ALREADY_EXISTS_FOR_SELECTION'
]) {
  assert.ok(invoiceSelection.includes(reason), `Eligibility reason is missing: ${reason}`);
}
for (const field of [
  'requestStatus',
  'batchStatus',
  'approvedCount',
  'rejectedCount',
  'pendingCount'
]) {
  assert.ok(invoiceSelection.includes(field), `Eligibility diagnostic is missing: ${field}`);
}

console.log(
  'Stage Request Status Automation 5A1 transition, dropdown, and diagnostics checks passed.'
);
