import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import {
  createSendRequestSelectionForApprovalService,
  SendRequestSelectionForApprovalError
} from '../lib/request-selection/send-for-approval';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const eligibility = read('lib/request-selection/resend-eligibility.ts');
const sendService = read('lib/request-selection/send-for-approval.ts');
const adminAction = read('app/admin/actions.ts');
const feedback = read('lib/admin/request-feedback.ts');
const statusTransition = read('lib/requests/status-transition.ts');

const productionEligibility = eligibility.slice(
  eligibility.indexOf('export function createRequestSelectionResendEligibilityService')
);

assert.match(eligibility, /deriveRequestSelectionFollowUpEligibility/);
assert.doesNotMatch(
  productionEligibility,
  /deriveRequestSelectionFollowUpEligibility/
);
assert.doesNotMatch(
  sendService,
  /mode\?:[^;]*FOLLOW_UP_REJECTED|event:\s*mode === 'FOLLOW_UP_REJECTED'/
);
assert.match(sendService, /FINALIZED_SELECTION_LOCKED/);
assert.match(sendService, /resendEligibility\.finalizedSelectionLocked/);
assert.match(adminAction, /modeValue === 'FOLLOW_UP_REJECTED'/);
assert.match(adminAction, /selection-finalized-locked/);
assert.doesNotMatch(feedback, /'follow-up-/);
assert.match(
  feedback,
  /Клієнт уже завершив погодження[\s\S]*потрібно створити нову заявку/
);
assert.match(statusTransition, /FOLLOW_UP_SELECTION_SENT_FOR_APPROVAL/);

async function main() {
  let transactionCalls = 0;
  const service = createSendRequestSelectionForApprovalService({
    $transaction: async () => {
      transactionCalls += 1;
      throw new Error('Legacy follow-up must be blocked before transaction.');
    }
  } as never);

  await assert.rejects(
    service({
      requestId: 'request-1',
      requestItemIds: ['item-1'],
      expectedRequestItemVersions: [{ id: 'item-1', updatedAt: new Date() }],
      actor: { id: 'manager-1' },
      mode: 'FOLLOW_UP_REJECTED'
    } as never),
    (error: unknown) =>
      error instanceof SendRequestSelectionForApprovalError
      && error.code === 'FINALIZED_SELECTION_LOCKED'
  );
  assert.equal(transactionCalls, 0);

  console.log(
    'Stage 5A2 regression passed: historical follow-up semantics remain readable, production follow-up is locked.'
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
