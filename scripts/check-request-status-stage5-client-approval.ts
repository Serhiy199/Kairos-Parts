import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  resolveAggregateSelectionDecision
} from '../lib/request-selection/client-submission';
import { resolveRequestSelectionBatchTransition } from '../lib/request-selection/lifecycle';
import {
  REQUEST_STATUS_EVENTS,
  resolveRequestStatusTransition
} from '../lib/requests/status-transition';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const actions = read('app/client/actions.ts');
const clientUi = read('components/client/client-approval-batch-section.tsx');
const checkboxUi = read('components/client/client-selection-checkbox-list.tsx');
const itemCard = read('components/client/client-selection-item-card.tsx');
const legacyUi = read('components/client/client-legacy-selection-section.tsx');
const aggregateService = read('lib/request-selection/client-submission.ts');
const readModel = read('lib/request-selection/client-read-model.ts');

assert.deepEqual(resolveAggregateSelectionDecision(['a', 'b'], ['a', 'b']), {
  batchStatus: 'APPROVED',
  approvedItemIds: ['a', 'b'],
  rejectedItemIds: []
});
assert.deepEqual(resolveAggregateSelectionDecision(['a', 'b'], ['a']), {
  batchStatus: 'PARTIALLY_APPROVED',
  approvedItemIds: ['a'],
  rejectedItemIds: ['b']
});
assert.deepEqual(resolveAggregateSelectionDecision(['a', 'b'], []), {
  batchStatus: 'REJECTED',
  approvedItemIds: [],
  rejectedItemIds: ['a', 'b']
});

assert.deepEqual(resolveRequestSelectionBatchTransition('SENT', 'APPROVE'), {
  outcome: 'allowed',
  nextStatus: 'APPROVED'
});
assert.deepEqual(
  resolveRequestSelectionBatchTransition('SENT', 'PARTIALLY_APPROVE'),
  { outcome: 'allowed', nextStatus: 'PARTIALLY_APPROVED' }
);
assert.deepEqual(resolveRequestSelectionBatchTransition('SENT', 'REJECT'), {
  outcome: 'allowed',
  nextStatus: 'REJECTED'
});
assert.deepEqual(
  resolveRequestStatusTransition(
    'WAITING_APPROVAL',
    REQUEST_STATUS_EVENTS.CLIENT_SELECTION_APPROVED
  ),
  { outcome: 'allowed', nextStatus: 'AWAITING_INVOICE' }
);

for (const token of [
  "status: 'SENT'",
  "status: 'PENDING'",
  "isolationLevel: 'Serializable'",
  'resolveAggregateSelectionDecision',
  'FINALIZATION_INVARIANT_FAILED',
  'CLIENT_SELECTION_SUBMITTED'
]) {
  assert.ok(
    aggregateService.includes(token),
    `Aggregate client approval invariant is missing: ${token}`
  );
}

assert.match(actions, /submitClientSelectionAction/);
assert.doesNotMatch(
  actions,
  /decideClientSelectionItemAction|approveClientRequestItemsAction/
);
assert.equal(
  existsSync(resolve(root, 'lib/request-selection/client-decision.ts')),
  false
);
assert.equal(
  existsSync(resolve(root, 'components/client/client-selection-decision-controls.tsx')),
  false
);
assert.match(clientUi, /data-finalized-selection-summary/);
assert.match(clientUi, /activeBatch\.status === 'SENT'/);
assert.match(clientUi, /ClientSelectionCheckboxList/);
assert.doesNotMatch(clientUi, /ClientSelectionDecisionControls/);
assert.match(checkboxUi, /type="checkbox"/);
assert.match(checkboxUi, /Надіслати погодження/);
assert.match(itemCard, /Коментар клієнта/);
assert.doesNotMatch(legacyUi, /type="checkbox"|<form|approveClientRequestItemsAction/);
assert.match(legacyUi, /Архівна версія/);
assert.match(
  readModel,
  /status: \{ in: \['APPROVED', 'PARTIALLY_APPROVED', 'REJECTED'\] \}/
);
assert.match(readModel, /clientComment: true/);

console.log(
  'Stage Request Status Automation 5 aggregate client approval regression checks passed.'
);
