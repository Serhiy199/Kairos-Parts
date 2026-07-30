import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  clientSelectionStateKey,
  summarizeClientSelection,
  toggleClientSelection
} from '../components/client/client-selection-checkbox-list';

function main() {
  const source = readFileSync(
    'components/client/client-selection-checkbox-list.tsx',
    'utf8'
  );
  const parentSource = readFileSync(
    'components/client/client-approval-batch-section.tsx',
    'utf8'
  );
  assert.match(source, /type="checkbox"/);
  assert.match(source, /checked=\{selectedIds\.has\(item\.id\)\}/);
  assert.match(source, /Погоджую позицію/);
  assert.doesNotMatch(source, />Погодити</);
  assert.doesNotMatch(source, />Відхилити</);
  assert.doesNotMatch(source, /textarea|Причина відхилення/);
  assert.match(source, /Погоджено: \{selectedCount\} із \{eligibleItems\.length\}/);
  assert.match(source, /Не погоджено: \{notSelectedCount\}/);

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

  assert.match(source, /activeBatch\.status === 'SENT' && item\.status === 'PENDING'/);
  assert.match(source, /Ви погодили цю позицію/);
  assert.match(source, /Позицію відхилено/);
  assert.match(source, /\{item\.clientComment \? \(/);
  assert.doesNotMatch(source, /<form/);
  assert.match(source, /Надіслати погодження/);

  console.log('Stage Request Approval UI 1 checkbox selection checks passed.');
}

main();
