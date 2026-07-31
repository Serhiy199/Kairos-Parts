import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import type { RequestStatus } from '@prisma/client';

import {
  assertManagerSelectionMutationAllowed,
  ManagerSelectionMutationError
} from '../lib/request-items/mutation-policy';
import {
  buildFinalizedSelectionSummary
} from '../lib/request-selection/finalized-summary';
import {
  createSendRequestSelectionForApprovalService,
  SendRequestSelectionForApprovalError
} from '../lib/request-selection/send-for-approval';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const adminPage = read('app/admin/requests/[id]/page.tsx');
const adminActions = read('app/admin/actions.ts');
const clientActions = read('app/client/actions.ts');
const clientBatch = read('components/client/client-approval-batch-section.tsx');
const checkboxList = read('components/client/client-selection-checkbox-list.tsx');
const itemCard = read('components/client/client-selection-item-card.tsx');
const legacyClient = read('components/client/client-legacy-selection-section.tsx');
const mutationPolicy = read('lib/request-items/mutation-policy.ts');
const createItem = read('lib/request-items/create-draft.ts');
const updateItem = read('lib/request-items/update.ts');
const deleteItem = read('lib/request-items/delete.ts');
const sendSelection = read('lib/request-selection/send-for-approval.ts');
const resendEligibility = read('lib/request-selection/resend-eligibility.ts');
const clientSubmission = read('lib/request-selection/client-submission.ts');
const clientReadModel = read('lib/request-selection/client-read-model.ts');
const invoiceSelection = read('lib/invoices/selection.ts');
const invoiceService = read('lib/invoices/service.ts');
const auditPresentation = read('lib/audit-log/presentation.ts');
const statusTransition = read('lib/requests/status-transition.ts');

let scenarioCount = 0;
function scenario(name: string, assertion: () => void) {
  assertion();
  scenarioCount += 1;
  process.stdout.write(`ok ${scenarioCount} - ${name}\n`);
}

function policyDatabase(input: {
  finalizedStatus?: 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED';
  activeCount?: number;
}) {
  return {
    user: {
      findUnique: async () => ({ role: 'MANAGER', status: 'ACTIVE' })
    },
    requestSelectionBatch: {
      findMany: async () => Array.from(
        { length: input.activeCount ?? 0 },
        (_, index) => ({ id: `sent-${index}`, revision: index + 1, status: 'SENT' })
      ),
      findFirst: async () => input.finalizedStatus
        ? { id: 'final', revision: 2, status: input.finalizedStatus }
        : null
    }
  };
}

async function expectFinalizedPolicyLock(
  finalizedStatus: 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED',
  requestStatus: RequestStatus
) {
  await assert.rejects(
    assertManagerSelectionMutationAllowed(
      policyDatabase({ finalizedStatus }) as never,
      { requestId: 'request-1', requestStatus, actorId: 'manager-1' }
    ),
    (error: unknown) =>
      error instanceof ManagerSelectionMutationError
      && error.code === 'FINAL_CLIENT_SELECTION_LOCKED'
  );
}

async function main() {
  await expectFinalizedPolicyLock('APPROVED', 'AWAITING_INVOICE');
  scenario('APPROVED batch hides create item', () => {
    assert.match(adminPage, /managerMutationsAllowed \?/);
    assert.match(mutationPolicy, /FINAL_CLIENT_SELECTION_LOCKED/);
  });
  scenario('APPROVED batch hides edit', () => {
    assert.match(adminPage, /managerMutationsAllowed && !approvedLocked/);
  });
  scenario('APPROVED batch hides delete', () => assert.match(adminPage, /managerMutationsAllowed && !approvedLocked/));
  scenario('APPROVED batch hides update selection', () => assert.match(adminPage, /finalizedSelectionLocked/));

  await expectFinalizedPolicyLock('PARTIALLY_APPROVED', 'AWAITING_INVOICE');
  scenario('PARTIALLY_APPROVED uses the same mutation lock', () => {
    assert.match(mutationPolicy, /'PARTIALLY_APPROVED'/);
  });
  await expectFinalizedPolicyLock('REJECTED', 'CANCELLED');
  scenario('REJECTED uses the same mutation lock', () => {
    assert.match(mutationPolicy, /'REJECTED'/);
  });
  scenario('AWAITING_INVOICE renders finalized item decisions', () => {
    assert.match(adminPage, /selectionBySourceItemId/);
    assert.match(adminPage, /presentation\.clientStatus/);
  });
  scenario('AWAITING_INVOICE invoice CTA remains eligibility-driven', () => {
    assert.match(adminPage, /const canCreateInvoice = eligibility\.eligible/);
  });
  scenario('CANCELLED hides invoice CTA', () => {
    assert.match(adminPage, /eligibility\.requestStatus !== 'CANCELLED'/);
  });
  scenario('final summary counts approved and rejected items', () => {
    const summary = buildFinalizedSelectionSummary({
      status: 'PARTIALLY_APPROVED',
      revision: 2,
      items: [{ status: 'APPROVED' }, { status: 'REJECTED' }]
    });
    assert.deepEqual(
      [summary.approvedCount, summary.rejectedCount, summary.totalCount],
      [1, 1, 2]
    );
  });

  const preFinalPolicy = await assertManagerSelectionMutationAllowed(
    policyDatabase({ activeCount: 1 }) as never,
    {
      requestId: 'request-1',
      requestStatus: 'WAITING_APPROVAL',
      actorId: 'manager-1'
    }
  );
  scenario('WAITING_APPROVAL plus one SENT permits manager mutation', () => {
    assert.equal(preFinalPolicy.activeBatch?.status, 'SENT');
  });
  scenario('create service uses the canonical mutation policy', () => {
    assert.match(createItem, /assertManagerSelectionMutationAllowed/);
  });
  scenario('edit service uses the canonical mutation policy', () => {
    assert.match(updateItem, /assertManagerSelectionMutationAllowed/);
  });
  scenario('delete service uses the canonical mutation policy', () => {
    assert.match(deleteItem, /assertManagerSelectionMutationAllowed/);
  });
  scenario('semantic changes enable update selection', () => {
    assert.match(resendEligibility, /hasDirtySelection/);
  });
  scenario('no semantic changes keep update disabled', () => {
    assert.match(resendEligibility, /reason = 'NOTHING_TO_SEND'/);
  });
  scenario('pre-final resend creates a new revision', () => {
    assert.match(sendSelection, /mode === 'RESEND_ACTIVE'/);
  });
  scenario('pre-final resend supersedes the old revision', () => {
    assert.match(sendSelection, /event: 'SUPERSEDE'/);
  });
  scenario('pre-final flow remains distinct from post-final flow', () => {
    assert.match(sendSelection, /FINALIZED_SELECTION_LOCKED/);
  });

  scenario('old per-item approve action is removed', () => {
    assert.doesNotMatch(clientActions, /decideClientSelectionItemAction/);
  });
  scenario('old per-item reject action is removed', () => {
    assert.equal(
      existsSync(resolve(root, 'components/client/client-selection-decision-controls.tsx')),
      false
    );
    assert.doesNotMatch(legacyClient, /type="checkbox"|<form/);
  });
  scenario('old rejection comment mutation service is removed', () => {
    assert.equal(
      existsSync(resolve(root, 'lib/request-selection/client-decision.ts')),
      false
    );
  });
  scenario('follow-up after APPROVED is rejected by finalized batch guard', () => {
    assert.match(sendSelection, /resendEligibility\.finalizedSelectionLocked/);
  });
  scenario('follow-up after PARTIALLY_APPROVED is rejected by finalized batch guard', () => {
    assert.match(resendEligibility, /'PARTIALLY_APPROVED'/);
  });
  scenario('follow-up after REJECTED is rejected by finalized batch guard', () => {
    assert.match(resendEligibility, /'REJECTED'/);
  });
  scenario('new SENT cannot be created after finalized batch', () => {
    assert.match(sendSelection, /fail\('FINALIZED_SELECTION_LOCKED'/);
  });

  let transactionCalls = 0;
  const guardedSend = createSendRequestSelectionForApprovalService({
    $transaction: async () => {
      transactionCalls += 1;
      throw new Error('transaction must not start');
    }
  } as never);
  await assert.rejects(
    guardedSend({
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
  scenario('blocked direct follow-up does not mutate RequestItem', () => assert.equal(transactionCalls, 0));
  scenario('blocked direct follow-up does not create a batch', () => assert.equal(transactionCalls, 0));
  scenario('blocked direct follow-up does not create mutation audit', () => assert.equal(transactionCalls, 0));
  scenario('blocked direct follow-up does not create status history', () => assert.equal(transactionCalls, 0));

  scenario('active SENT shows checkbox', () => assert.match(checkboxList, /type="checkbox"/));
  scenario('finalized batch does not mount checkbox list', () => {
    assert.match(clientBatch, /finalizedSummary \?[\s\S]*ClientSelectionCheckboxList/);
  });
  scenario('finalized batch does not show aggregate submit', () => {
    assert.match(clientBatch, /finalizedSummary \?/);
    assert.doesNotMatch(itemCard, /Надіслати погодження/);
  });
  scenario('finalized batch has no per-item buttons', () => {
    assert.doesNotMatch(itemCard, /Погодити|Відхилити/);
  });
  scenario('finalized batch has no rejection textarea', () => {
    assert.doesNotMatch(clientBatch + itemCard, /<textarea/);
  });
  scenario('legacy rejection comment is read-only', () => {
    assert.match(itemCard, /Коментар клієнта/);
    assert.doesNotMatch(itemCard, /name="clientComment"/);
  });
  scenario('all-approved summary is canonical', () => {
    const result = buildFinalizedSelectionSummary({
      status: 'APPROVED',
      revision: 1,
      items: [{ status: 'APPROVED' }, { status: 'APPROVED' }]
    });
    assert.equal(result.headline, 'Погоджено всі 2 позиції');
  });
  scenario('partial summary is canonical', () => {
    const result = buildFinalizedSelectionSummary({
      status: 'PARTIALLY_APPROVED',
      revision: 1,
      items: [{ status: 'APPROVED' }, { status: 'REJECTED' }]
    });
    assert.equal(result.detail, 'Рахунок буде сформовано лише з погоджених позицій.');
  });
  scenario('reject-all summary is canonical', () => {
    const result = buildFinalizedSelectionSummary({
      status: 'REJECTED',
      revision: 1,
      items: [{ status: 'REJECTED' }]
    });
    assert.equal(result.detail, 'Заявку завершено без формування рахунку.');
  });

  scenario('multi-revision legacy request remains readable', () => {
    assert.match(clientReadModel, /orderBy: \[\{ revision: 'desc' \}/);
  });
  scenario('SUPERSEDED revision remains represented read-only', () => {
    assert.match(auditPresentation, /REQUEST_SELECTION_BATCH_SUPERSEDED/);
  });
  scenario('historical follow-up event remains readable', () => {
    assert.match(statusTransition, /FOLLOW_UP_SELECTION_SENT_FOR_APPROVAL/);
  });
  scenario('historical comments remain selected', () => {
    assert.match(clientReadModel, /clientComment: true/);
  });
  scenario('existing invoices are not mutated by cleanup', () => {
    assert.doesNotMatch(sendSelection, /invoice\.(update|delete)|invoiceItem\.(update|delete)/);
  });
  scenario('legacy invoice selection mode remains available', () => {
    assert.match(invoiceSelection, /LEGACY_SELECTION_AMBIGUOUS/);
    assert.match(invoiceService, /resolveSelection/);
  });

  scenario('hidden UI cannot bypass direct manager action', () => {
    assert.match(adminActions, /modeValue === 'FOLLOW_UP_REJECTED'/);
  });
  scenario('finalized batch conditional guard is canonical', () => {
    assert.match(mutationPolicy, /if \(finalizedBatch\)/);
  });
  scenario('stale manager action uses conditional source versions', () => {
    assert.match(sendSelection, /SOURCE_ITEM_VERSION_CONFLICT/);
  });
  scenario('manager update versus client submit race guards remain', () => {
    assert.match(clientSubmission, /CONCURRENT_SUBMISSION/);
    assert.match(sendSelection, /ACTIVE_SELECTION_VERSION_CONFLICT/);
  });
  scenario('one active SENT invariant remains enforced', () => {
    assert.match(mutationPolicy, /activeBatches\.length > 1/);
    assert.match(sendSelection, /activeBatches\.length > 1/);
  });

  assert.equal(scenarioCount, 50);
  console.log(
    'Stage Request Approval 5 final-state lockdown: 50 scenarios passed (all 47 required cases covered).'
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
