import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { Prisma, type RequestStatus } from '@prisma/client';

import {
  assertManagerSelectionMutationAllowed,
  ManagerSelectionMutationError
} from '../lib/request-items/mutation-policy';
import {
  createDeleteRequestItemService,
  RequestItemDeleteError
} from '../lib/request-items/delete';
import {
  deriveRequestSelectionResendEligibility
} from '../lib/request-selection/resend-eligibility';
import {
  buildRequestSelectionSnapshot
} from '../lib/request-selection/snapshot';
import {
  buildRequestItemsApprovalMessage
} from '../lib/telegram/notifications';

function policyDatabase(input: {
  role?: 'ADMIN' | 'MANAGER' | 'CLIENT';
  actorStatus?: 'ACTIVE' | 'DISABLED';
  activeCount?: number;
  finalized?: boolean;
}) {
  return {
    user: {
      findUnique: async () => ({
        role: input.role ?? 'MANAGER',
        status: input.actorStatus ?? 'ACTIVE'
      })
    },
    requestSelectionBatch: {
      findMany: async () => Array.from(
        { length: input.activeCount ?? 0 },
        (_, index) => ({
          id: `sent-${index + 1}`,
          revision: index + 1,
          status: 'SENT'
        })
      ),
      findFirst: async () => input.finalized
        ? { id: 'finalized-1', revision: 1, status: 'APPROVED' }
        : null
    }
  };
}

async function expectPolicyCode(
  status: RequestStatus,
  expectedCode: ManagerSelectionMutationError['code'],
  options: Parameters<typeof policyDatabase>[0] = {}
) {
  await assert.rejects(
    assertManagerSelectionMutationAllowed(policyDatabase(options) as never, {
      requestId: 'request-1',
      requestStatus: status,
      actorId: 'manager-1'
    }),
    (error: unknown) =>
      error instanceof ManagerSelectionMutationError
      && error.code === expectedCode
  );
}

function currentItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    requestId: 'request-1',
    createdAt: new Date('2026-07-30T06:00:00.000Z'),
    updatedAt: new Date('2026-07-30T07:00:00.000Z'),
    equipmentType: 'Трактор',
    name: 'Фільтр',
    brand: 'MANN',
    catalogNumber: 'A-100',
    analogNumber: 'B-100',
    quantity: 2,
    unit: 'шт',
    availability: 'В наявності',
    deliveryTime: '2 дні',
    salePrice: new Prisma.Decimal('1000'),
    currency: 'UAH',
    comment: 'Основний',
    vehicleId: null,
    vehicle: null,
    ...overrides
  };
}

function activeItem(source = currentItem()) {
  return {
    id: `batch-${source.id}`,
    ...buildRequestSelectionSnapshot(source)
  };
}

function eligibility(
  items: ReturnType<typeof currentItem>[],
  activeItems: ReturnType<typeof activeItem>[]
) {
  return deriveRequestSelectionResendEligibility({
    request: {
      id: 'request-1',
      status: 'WAITING_APPROVAL',
      items
    },
    activeBatch: {
      id: 'batch-1',
      revision: 1,
      items: activeItems
    }
  });
}

function deleteHarness(input: { finalized?: boolean; failAudit?: boolean } = {}) {
  const state = {
    itemExists: true,
    audits: 0
  };
  const database = {
    async $transaction<T>(callback: (tx: unknown) => Promise<T>) {
      const before = structuredClone(state);
      const tx = {
        requestItem: {
          findFirst: async () => state.itemExists
            ? {
                id: 'item-1',
                requestId: 'request-1',
                vehicleId: null,
                name: 'Фільтр',
                brand: 'MANN',
                catalogNumber: 'A-100',
                analogNumber: null,
                quantity: 1,
                availability: 'В наявності',
                salePrice: new Prisma.Decimal('1000'),
                visibleToClient: true,
                includeInInvoice: false,
                request: {
                  status: 'WAITING_APPROVAL',
                  requestNumber: 'KP-1',
                  companyId: 'company-1'
                }
              }
            : null,
          deleteMany: async () => {
            if (!state.itemExists) return { count: 0 };
            state.itemExists = false;
            return { count: 1 };
          }
        },
        user: {
          findUnique: async () => ({ role: 'MANAGER', status: 'ACTIVE' })
        },
        requestSelectionBatch: {
          findMany: async () => [{
            id: 'batch-sent',
            revision: 1,
            status: 'SENT'
          }],
          findFirst: async () => input.finalized
            ? { id: 'batch-final', revision: 1, status: 'APPROVED' }
            : null
        },
        requestSelectionBatchItem: {
          findFirst: async () => null
        },
        invoiceItem: {
          findFirst: async () => null
        }
      };
      try {
        return await callback(tx as never);
      } catch (error) {
        Object.assign(state, before);
        throw error;
      }
    }
  };
  const service = createDeleteRequestItemService(database as never, {
    writeAudit: (async () => {
      if (input.failAudit) throw new Error('audit-failed');
      state.audits += 1;
      return { id: `audit-${state.audits}` };
    }) as never
  });
  return { state, service };
}

async function main() {
  await assertManagerSelectionMutationAllowed(policyDatabase({}) as never, {
    requestId: 'request-1',
    requestStatus: 'NEW',
    actorId: 'manager-1'
  });
  await assertManagerSelectionMutationAllowed(policyDatabase({}) as never, {
    requestId: 'request-1',
    requestStatus: 'IN_PROGRESS',
    actorId: 'manager-1'
  });
  await assertManagerSelectionMutationAllowed(
    policyDatabase({ activeCount: 1 }) as never,
    {
      requestId: 'request-1',
      requestStatus: 'WAITING_APPROVAL',
      actorId: 'manager-1'
    }
  );
  await expectPolicyCode(
    'WAITING_APPROVAL',
    'REQUEST_STATUS_LOCKED'
  );
  for (const status of [
    'AWAITING_INVOICE',
    'INVOICE_SENT',
    'AWAITING_SHIPMENT',
    'COMPLETED',
    'CANCELLED'
  ] as const) {
    await expectPolicyCode(status, 'REQUEST_STATUS_LOCKED');
  }
  await expectPolicyCode('IN_PROGRESS', 'ACTOR_NOT_ALLOWED', {
    role: 'CLIENT'
  });
  await expectPolicyCode('IN_PROGRESS', 'ACTOR_NOT_ALLOWED', {
    actorStatus: 'DISABLED'
  });
  await expectPolicyCode('WAITING_APPROVAL', 'FINAL_CLIENT_SELECTION_LOCKED', {
    activeCount: 1,
    finalized: true
  });
  await expectPolicyCode('IN_PROGRESS', 'ACTIVE_BATCH_INTEGRITY_ERROR', {
    activeCount: 1
  });
  await expectPolicyCode('WAITING_APPROVAL', 'ACTIVE_BATCH_INTEGRITY_ERROR', {
    activeCount: 2
  });

  const published = currentItem();
  const unchanged = eligibility([published], [activeItem(published)]);
  assert.equal(unchanged.hasUnpublishedSelectionChanges, false);
  assert.equal(unchanged.canSend, false);

  const changedFields: Array<Record<string, unknown>> = [
    { quantity: 3 },
    { salePrice: new Prisma.Decimal('1100') },
    { currency: 'EUR' },
    { name: 'Оливний фільтр' },
    { catalogNumber: 'A-101' },
    { analogNumber: 'B-101' },
    { availability: 'Під замовлення' },
    { deliveryTime: '5 днів' },
    { comment: 'Оновлено' }
  ];
  for (const change of changedFields) {
    const changed = eligibility(
      [currentItem({ ...change, updatedAt: new Date('2026-07-30T08:00:00.000Z') })],
      [activeItem(published)]
    );
    assert.equal(changed.hasUnpublishedSelectionChanges, true);
    assert.equal(changed.canSend, true);
  }

  const added = eligibility(
    [published, currentItem({ id: 'item-2' })],
    [activeItem(published)]
  );
  assert.equal(added.hasUnpublishedSelectionChanges, true);
  const removed = eligibility([], [activeItem(published)]);
  assert.equal(removed.hasUnpublishedSelectionChanges, true);
  assert.equal(removed.canSend, false);
  const internalOnly = eligibility(
    [currentItem({
      updatedAt: new Date('2026-07-30T09:00:00.000Z'),
      supplierName: 'Internal',
      purchasePrice: new Prisma.Decimal('500')
    })],
    [activeItem(published)]
  );
  assert.equal(internalOnly.hasUnpublishedSelectionChanges, false);
  const reverted = eligibility([currentItem()], [activeItem(published)]);
  assert.equal(reverted.hasUnpublishedSelectionChanges, false);

  const deleteAllowed = deleteHarness();
  await deleteAllowed.service({
    requestItemId: 'item-1',
    requestId: 'request-1',
    actor: { id: 'manager-1' }
  });
  assert.equal(deleteAllowed.state.itemExists, false);
  assert.equal(deleteAllowed.state.audits, 1);

  const deleteFinalized = deleteHarness({ finalized: true });
  await assert.rejects(
    deleteFinalized.service({
      requestItemId: 'item-1',
      requestId: 'request-1',
      actor: { id: 'manager-1' }
    }),
    (error: unknown) =>
      error instanceof RequestItemDeleteError
      && error.code === 'REQUEST_SELECTION_MUTATION_LOCKED'
  );
  assert.equal(deleteFinalized.state.itemExists, true);

  const deleteAuditFailure = deleteHarness({ failAudit: true });
  await assert.rejects(
    deleteAuditFailure.service({
      requestItemId: 'item-1',
      requestId: 'request-1',
      actor: { id: 'manager-1' }
    }),
    (error: unknown) =>
      error instanceof RequestItemDeleteError
      && error.code === 'REQUEST_ITEM_DELETE_FAILED'
  );
  assert.equal(deleteAuditFailure.state.itemExists, true);

  assert.match(
    buildRequestItemsApprovalMessage('KP-1', true),
    /Менеджер оновив підбір[\s\S]*Перевірте актуальний список позицій/
  );

  const createSource = readFileSync('lib/request-items/create-draft.ts', 'utf8');
  const updateSource = readFileSync('lib/request-items/update.ts', 'utf8');
  const deleteSource = readFileSync('lib/request-items/delete.ts', 'utf8');
  const sendSource = readFileSync(
    'lib/request-selection/send-for-approval.ts',
    'utf8'
  );
  const eligibilitySource = readFileSync(
    'lib/request-selection/resend-eligibility.ts',
    'utf8'
  );
  const pageSource = readFileSync('app/admin/requests/[id]/page.tsx', 'utf8');
  const actionSource = readFileSync('app/admin/actions.ts', 'utf8');
  const clientCheckboxSource = readFileSync(
    'components/client/client-selection-checkbox-list.tsx',
    'utf8'
  );
  const migrationSource = readFileSync(
    'prisma/migrations/20260727183000_add_request_selection_batch_foundation/migration.sql',
    'utf8'
  );

  for (const source of [createSource, updateSource, deleteSource]) {
    assert.match(source, /assertManagerSelectionMutationAllowed/);
    assert.match(source, /isolationLevel:\s*'Serializable'/);
  }
  assert.match(createSource, /normalizedStatus === 'WAITING_APPROVAL'/);
  assert.match(updateSource, /expectedUpdatedAt/);
  assert.match(updateSource, /updateMany/);
  assert.match(deleteSource, /APPROVED_REQUEST_ITEM_DELETE_BLOCKED/);
  assert.match(deleteSource, /invoiceItem/);
  assert.match(actionSource, /await deleteRequestItem\(\{/);
  assert.match(actionSource, /expectedActiveBatchId/);
  assert.match(actionSource, /expectedActiveRevision/);

  const productionEligibility = eligibilitySource.slice(
    eligibilitySource.indexOf('export function createRequestSelectionResendEligibilityService')
  );
  assert.doesNotMatch(
    productionEligibility,
    /deriveRequestSelectionFollowUpEligibility/
  );
  assert.match(sendSource, /if \(followUpRequested\)/);
  assert.match(sendSource, /FOLLOW_UP_REQUEST_STATUS_BLOCKED/);
  assert.match(sendSource, /ACTIVE_SELECTION_VERSION_CONFLICT/);
  assert.match(sendSource, /MANAGER_UPDATED_BEFORE_CLIENT_FINAL_DECISION/);
  assert.match(sendSource, /isolationLevel:\s*'Serializable'/);
  assert.match(sendSource, /event:\s*'SUPERSEDE'/);
  assert.match(sendSource, /event:\s*'SEND'/);
  assert.match(sendSource, /updatedSelection:\s*committed\.mode === 'RESEND_ACTIVE'/);
  assert.match(
    migrationSource,
    /RequestSelectionBatch_one_sent_per_request/
  );

  assert.match(pageSource, /Є ненадіслані зміни/);
  assert.match(pageSource, /Клієнт бачить актуальну версію підбору/);
  assert.match(pageSource, /Оновити підбір для клієнта/);
  assert.match(pageSource, /managerMutationsAllowed/);
  assert.match(pageSource, /expectedActiveBatchId/);
  assert.match(pageSource, /expectedActiveRevision/);
  assert.match(clientCheckboxSource, /clientSelectionStateKey/);
  assert.match(clientCheckboxSource, /activeBatch\.id, model\.activeBatch\.revision/);

  console.log(
    'Stage Request Approval 3 manager edit-before-final checks passed.'
  );
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
