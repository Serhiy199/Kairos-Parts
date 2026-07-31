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
  selection: Parameters<typeof getAdminRequestItemPresentation>[0]['selection'] = null
) {
  return getAdminRequestItemPresentation({
    state,
    selection
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

  assert.equal(presentation('NOT_SENT').clientStatus.label, 'Чернетка');
  assert.equal(
    presentation('UNCHANGED', {
      batchStatus: 'SENT',
      itemStatus: 'PENDING'
    }).clientStatus.label,
    'Очікує рішення клієнта'
  );
  assert.equal(
    presentation('NOT_SENT', {
      batchStatus: 'PARTIALLY_APPROVED',
      itemStatus: 'APPROVED'
    }).clientStatus.label,
    'Погоджено'
  );
  assert.equal(
    presentation('NOT_SENT', {
      batchStatus: 'PARTIALLY_APPROVED',
      itemStatus: 'REJECTED'
    }).clientStatus.label,
    'Не погоджено'
  );
  assert.equal(presentation('UNCHANGED_REJECTED').clientStatus.label, 'Не погоджено');
  assert.equal(presentation('NEW_FOLLOW_UP').clientStatus.label, 'Чернетка');

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
      source('components/client/client-selection-checkbox-list.tsx')
    ].join('\n'),
    /window\.location\.reload|location\.href/
  );

  console.log('Stage 5A3 approval history, provenance, badge matrix, and reactive feedback checks passed.');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
