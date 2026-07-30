import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';

import {
  ClientSelectionCheckboxList,
  clientSelectionStateKey,
  summarizeClientSelection,
  toggleClientSelection
} from '../components/client/client-selection-checkbox-list';
import type { ClientRequestApprovalReadModel } from '../lib/request-selection/client-read-model';

type BatchModel = Extract<ClientRequestApprovalReadModel, { mode: 'BATCH' }>;

function item(
  id: string,
  status: 'PENDING' | 'APPROVED' | 'REJECTED',
  clientComment: string | null = null
) {
  return {
    id,
    position: id === 'batch-item-1' ? 1 : 2,
    status,
    equipmentType: 'Трактор',
    itemName: `Позиція ${id}`,
    brand: 'Kairos',
    catalogNumber: `CAT-${id}`,
    analogNumber: null,
    quantity: '1',
    unit: 'шт',
    availability: 'В наявності',
    deliveryTime: '2 дні',
    unitPrice: '1000',
    currency: 'UAH',
    managerComment: null,
    clientComment,
    vehicle: null
  };
}

function model(
  status: 'SENT' | 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED',
  items: ReturnType<typeof item>[],
  revision = 1
): BatchModel {
  return {
    request: { id: 'request-1', number: 'KP-1', status: 'WAITING_APPROVAL' },
    mode: 'BATCH',
    activeBatch: {
      id: 'batch-1',
      revision,
      status,
      sentAt: '2026-07-30T06:00:00.000Z',
      itemCount: items.length,
      previouslyApprovedCount: 0,
      items
    },
    previouslyApprovedItems: [],
    legacyItems: []
  };
}

function render(batchModel: BatchModel) {
  return renderToStaticMarkup(
    React.createElement(ClientSelectionCheckboxList, { model: batchModel })
  );
}

function main() {
  const source = readFileSync(
    'components/client/client-selection-checkbox-list.tsx',
    'utf8'
  );
  const parentSource = readFileSync(
    'components/client/client-approval-batch-section.tsx',
    'utf8'
  );
  const pendingHtml = render(
    model('SENT', [
      item('batch-item-1', 'PENDING'),
      item('batch-item-2', 'PENDING')
    ])
  );

  assert.match(pendingHtml, /type="checkbox"/);
  assert.match(pendingHtml, /Погоджую позицію/);
  assert.doesNotMatch(pendingHtml, />Погодити</);
  assert.doesNotMatch(pendingHtml, />Відхилити</);
  assert.doesNotMatch(pendingHtml, /textarea|Причина відхилення/);
  assert.doesNotMatch(pendingHtml, /checked=""/);
  assert.match(pendingHtml, /Погоджено: 0 із 2 позиції/);
  assert.match(pendingHtml, /Не погоджено: 2 позиції/);

  const selectedFirst = toggleClientSelection(
    new Set<string>(),
    'batch-item-1',
    true
  );
  assert.deepEqual([...selectedFirst], ['batch-item-1']);
  assert.deepEqual(
    summarizeClientSelection(selectedFirst, ['batch-item-1', 'batch-item-2']),
    { selectedCount: 1, notSelectedCount: 1 }
  );

  const selectedBoth = toggleClientSelection(
    selectedFirst,
    'batch-item-2',
    true
  );
  assert.deepEqual(
    [...selectedBoth].sort(),
    ['batch-item-1', 'batch-item-2']
  );
  assert.deepEqual([...selectedFirst], ['batch-item-1']);

  const unselectedFirst = toggleClientSelection(
    selectedBoth,
    'batch-item-1',
    false
  );
  assert.deepEqual([...unselectedFirst], ['batch-item-2']);
  assert.deepEqual(
    summarizeClientSelection(unselectedFirst, ['batch-item-1', 'batch-item-2']),
    { selectedCount: 1, notSelectedCount: 1 }
  );

  assert.notEqual(
    clientSelectionStateKey('batch-1', 1),
    clientSelectionStateKey('batch-1', 2)
  );
  assert.notEqual(
    clientSelectionStateKey('batch-1', 1),
    clientSelectionStateKey('batch-2', 1)
  );
  assert.match(source, /key=\{clientSelectionStateKey\(/);
  assert.match(source, /toggleClientSelection\(current, item\.id/);
  assert.doesNotMatch(
    source,
    /decideClientSelectionItemAction|ReactiveActionForm|fetch\(|localStorage|sessionStorage/
  );
  assert.doesNotMatch(parentSource, /ClientSelectionDecisionControls/);

  const approvedHtml = render(model('APPROVED', [item('batch-item-1', 'APPROVED')]));
  assert.doesNotMatch(approvedHtml, /type="checkbox"/);
  assert.match(approvedHtml, /Ви погодили цю позицію/);

  const rejectedHtml = render(
    model('REJECTED', [
      item('batch-item-1', 'REJECTED', 'Потрібна інша позиція')
    ])
  );
  assert.doesNotMatch(rejectedHtml, /type="checkbox"/);
  assert.match(rejectedHtml, /Позицію відхилено/);
  assert.match(rejectedHtml, /Потрібна інша позиція/);

  assert.doesNotMatch(pendingHtml, /<button|<form/);
  assert.doesNotMatch(pendingHtml, /Надіслати погодження/);
  assert.match(pendingHtml, /Фінальне надсилання буде підключене/);

  console.log('Stage Request Approval UI 1 checkbox selection checks passed.');
}

main();
