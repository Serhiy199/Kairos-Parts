import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { Prisma } from '@prisma/client';

import { getAdminRequestItemPresentation } from '../lib/request-items/admin-presentation';
import { mapClientPreviouslyApprovedItems } from '../lib/request-selection/client-read-model';

function source(path: string) {
  return readFileSync(path, 'utf8');
}

function presentation(
  state: Parameters<typeof getAdminRequestItemPresentation>[0]['state'],
  approvedBatchItemId: string | null,
  invoiced: string[] = []
) {
  return getAdminRequestItemPresentation({
    state,
    approvedBatchItemId,
    invoicedBatchItemIds: new Set(invoiced)
  });
}

async function main() {
  const approvedHistory = mapClientPreviouslyApprovedItems([
    {
      id: 'approved-r1',
      sourceRequestItemId: 'source-a',
      approvedAt: new Date('2026-07-28T10:00:00.000Z'),
      itemName: 'Старий snapshot',
      catalogNumber: 'OLD',
      analogNumber: null,
      quantity: 1,
      unit: 'шт',
      approvedUnitPrice: new Prisma.Decimal('100'),
      currency: 'UAH',
      vehicleDisplayName: null,
      vehicleBrand: 'MAN',
      vehicleModel: 'TGS',
      vehicleYear: 2020,
      batch: { revision: 1 },
      invoiceItem: null
    },
    {
      id: 'approved-r2',
      sourceRequestItemId: 'source-a',
      approvedAt: new Date('2026-07-28T11:00:00.000Z'),
      itemName: 'Новий immutable snapshot',
      catalogNumber: 'NEW',
      analogNumber: 'ALT',
      quantity: 2,
      unit: 'шт',
      approvedUnitPrice: new Prisma.Decimal('200'),
      currency: 'UAH',
      vehicleDisplayName: null,
      vehicleBrand: 'MAN',
      vehicleModel: 'TGS',
      vehicleYear: 2021,
      batch: { revision: 2 },
      invoiceItem: { id: 'invoice-item' }
    },
    {
      id: 'approved-orphan',
      sourceRequestItemId: null,
      approvedAt: null,
      itemName: 'Snapshot без live source',
      catalogNumber: null,
      analogNumber: null,
      quantity: 1,
      unit: 'шт',
      approvedUnitPrice: null,
      currency: 'UAH',
      vehicleDisplayName: null,
      vehicleBrand: null,
      vehicleModel: null,
      vehicleYear: null,
      batch: { revision: 1 },
      invoiceItem: null
    }
  ] as never);

  assert.equal(approvedHistory.length, 2, 'cumulative history deduplicates by source identity');
  assert.equal(approvedHistory[1]?.itemName, 'Новий immutable snapshot');
  assert.equal(approvedHistory[1]?.invoiceState, 'IN_INVOICE');
  assert.equal(approvedHistory[0]?.invoiceState, 'AWAITING_INVOICE');
  assert.equal('sourceRequestItemId' in approvedHistory[1]!, false);
  assert.equal('vehicleVin' in approvedHistory[1]!, false);
  assert.equal('snapshotHash' in approvedHistory[1]!, false);
  assert.equal('managerComment' in approvedHistory[1]!, false);

  assert.deepEqual(
    [presentation('NOT_SENT', null).approval.label, presentation('NOT_SENT', null).invoice.label],
    ['Чернетка', 'Не надіслано клієнту']
  );
  assert.deepEqual(
    [presentation('UNCHANGED', null).approval.label, presentation('UNCHANGED', null).invoice.label],
    ['Очікує рішення клієнта', 'Не включено у рахунок']
  );
  assert.deepEqual(
    [presentation('LOCKED_APPROVED', 'approved-r2').approval.label, presentation('LOCKED_APPROVED', 'approved-r2').invoice.label],
    ['Погоджено', 'Очікує на створення рахунку']
  );
  assert.equal(
    presentation('LOCKED_APPROVED', 'approved-r2', ['approved-r2']).invoice.label,
    'Внесено в рахунок'
  );
  assert.equal(
    presentation('LOCKED_APPROVED', 'another-snapshot', ['approved-r2']).invoice.label,
    'Очікує на створення рахунку',
    'another revision of the same source must not be marked invoiced'
  );
  assert.deepEqual(
    [presentation('UNCHANGED_REJECTED', null).approval.label, presentation('UNCHANGED_REJECTED', null).invoice.label],
    ['Відхилено — можна доопрацювати', 'Не включено у рахунок']
  );
  assert.equal(presentation('CHANGED_REJECTED', null).invoice.label, 'Потребує повторного погодження');
  assert.equal(presentation('NEW_FOLLOW_UP', null).invoice.label, 'Потребує погодження');
  assert.equal(presentation('LOCKED_APPROVED', 'approved-r2').helper, 'Погоджені дані позиції не можна змінити.');

  const clientReadModel = source('lib/request-selection/client-read-model.ts');
  const clientUi = source('components/client/client-approval-batch-section.tsx');
  const adminUi = source('app/admin/requests/[id]/page.tsx');
  const reactiveForm = source('components/workflow/reactive-action-form.tsx');
  const toastProvider = source('components/ui/toast-provider.tsx');
  const rootLayout = source('app/layout.tsx');
  const adminActions = source('app/admin/actions.ts');
  const clientActions = source('app/client/actions.ts');

  assert.match(clientReadModel, /status: \{ in: \['APPROVED', 'PARTIALLY_APPROVED'\] \}/);
  assert.match(clientReadModel, /invoiceItem: \{ select: \{ id: true \} \}/);
  assert.doesNotMatch(clientReadModel.slice(clientReadModel.indexOf('approvedHistoryItemSelect'), clientReadModel.indexOf('legacyItemSelect')), /vehicleVin|snapshotHash|managerComment/);
  assert.match(clientUi, /<details[\s\S]*Раніше погоджені позиції/);
  assert.match(clientUi, /overflow-wrap:anywhere/);
  assert.match(adminUi, /selectionBatchItemId/);
  assert.doesNotMatch(adminUi, /Погоджено — заблоковано/);
  assert.match(adminUi, /Результат погодження версії/);
  assert.match(reactiveForm, /useTransition/);
  assert.match(reactiveForm, /router\.refresh\(\)/);
  assert.doesNotMatch(reactiveForm, /location\.reload|window\.location/);
  assert.match(toastProvider, /aria-live="polite"/);
  assert.match(toastProvider, /aria-label="Закрити повідомлення"/);
  assert.match(rootLayout, /<ToastProvider>/);
  assert.match(adminActions, /return workflowResult\('item-created', true\)/);
  assert.match(adminActions, /mode === 'RESEND_ACTIVE'[\s\S]*'selection-updated-for-client'[\s\S]*'items-sent-for-approval'/);
  assert.match(adminActions, /return workflowResult\('invoice-created', true\)/);
  assert.match(adminActions, /return workflowResult\('invoice-sent', true\)/);
  assert.match(clientActions, /getClientSelectionFeedback\(feedback\)/);
  assert.doesNotMatch(
    [
      adminUi,
      reactiveForm,
      source('components/client/client-selection-decision-controls.tsx')
    ].join('\n'),
    /window\.location\.reload|location\.href/
  );

  console.log('Stage 5A3 approval history, provenance, badge matrix, and reactive feedback checks passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
