import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { getAdminRequestItemPresentation } from '../lib/request-items/admin-presentation';

const root = process.cwd();
const read = (path: string) => readFileSync(resolve(root, path), 'utf8');
const adminPage = read('app/admin/requests/[id]/page.tsx');
const requestItemsSection = adminPage.slice(
  adminPage.indexOf('function RequestItemsSection('),
  adminPage.indexOf('function InvoicesSection(')
);
const presentationSource = read('lib/request-items/admin-presentation.ts');
const clientBatch = read('components/client/client-approval-batch-section.tsx');
const clientCheckboxes = read('components/client/client-selection-checkbox-list.tsx');
const mutationPolicy = read('lib/request-items/mutation-policy.ts');
const createItem = read('lib/request-items/create-draft.ts');
const updateItem = read('lib/request-items/update.ts');
const deleteItem = read('lib/request-items/delete.ts');
const clientSubmission = read('lib/request-selection/client-submission.ts');
const sendSelection = read('lib/request-selection/send-for-approval.ts');
const invoiceService = read('lib/invoices/service.ts');
const clientReadModel = read('lib/request-selection/client-read-model.ts');

type PresentationInput = Parameters<typeof getAdminRequestItemPresentation>[0];

function presentation(
  state: PresentationInput['state'],
  selection: PresentationInput['selection'] = null
) {
  return getAdminRequestItemPresentation({ state, selection });
}

let scenarioCount = 0;
function scenario(name: string, assertion: () => void) {
  assertion();
  scenarioCount += 1;
  process.stdout.write(`ok ${scenarioCount} - ${name}\n`);
}

function main() {
  const draft = presentation('NOT_SENT');
  scenario('Draft item shows only Чернетка', () => {
    assert.deepEqual(Object.keys(draft).sort(), ['clientStatus', 'locked']);
    assert.equal(draft.clientStatus.label, 'Чернетка');
  });
  scenario('Draft item does not show Не надіслано клієнту', () => {
    assert.doesNotMatch(JSON.stringify(draft), /Не надіслано клієнту/);
  });

  const waiting = presentation('UNCHANGED', {
    batchStatus: 'SENT',
    itemStatus: 'PENDING'
  });
  scenario('Active SENT/PENDING shows only Очікує рішення клієнта', () => {
    assert.deepEqual(Object.keys(waiting).sort(), ['clientStatus', 'locked']);
    assert.equal(waiting.clientStatus.label, 'Очікує рішення клієнта');
  });
  scenario('Active SENT/PENDING does not show Не включено у рахунок', () => {
    assert.doesNotMatch(JSON.stringify(waiting), /Не включено у рахунок/);
  });

  const approved = presentation('NOT_SENT', {
    batchStatus: 'PARTIALLY_APPROVED',
    itemStatus: 'APPROVED'
  });
  scenario('Finalized approved item shows Погоджено', () => {
    assert.equal(approved.clientStatus.label, 'Погоджено');
  });
  scenario('Approved badge uses success styling', () => {
    assert.match(approved.clientStatus.className, /success/);
  });

  const rejected = presentation('NOT_SENT', {
    batchStatus: 'PARTIALLY_APPROVED',
    itemStatus: 'REJECTED'
  });
  scenario('Finalized rejected item shows Не погоджено', () => {
    assert.equal(rejected.clientStatus.label, 'Не погоджено');
  });
  scenario('Rejected badge uses danger styling', () => {
    assert.match(rejected.clientStatus.className, /red-/);
  });
  scenario('Finalized approved item does not fall back to Чернетка', () => {
    assert.notEqual(approved.clientStatus.label, 'Чернетка');
  });
  scenario('Finalized rejected item does not fall back to Чернетка', () => {
    assert.notEqual(rejected.clientStatus.label, 'Чернетка');
  });
  scenario('Finalized items do not show Не надіслано клієнту', () => {
    assert.doesNotMatch(
      `${JSON.stringify(approved)}${JSON.stringify(rejected)}${presentationSource}`,
      /Не надіслано клієнту/
    );
  });
  scenario('Finalized items do not show Не включено у рахунок', () => {
    assert.doesNotMatch(
      `${JSON.stringify(approved)}${JSON.stringify(rejected)}${presentationSource}`,
      /Не включено у рахунок/
    );
  });

  scenario('Upper finalized summary is absent from CRM item section', () => {
    assert.doesNotMatch(
      requestItemsSection,
      /data-finalized-selection-summary|buildFinalizedSelectionSummary/
    );
  });
  scenario('Версія підбору is absent from the main CRM item section', () => {
    assert.doesNotMatch(requestItemsSection, /Версія підбору/);
  });
  scenario('Дата погодження is absent from the main CRM item section', () => {
    assert.doesNotMatch(requestItemsSection, /Дата погодження/);
  });
  scenario('Finalized aggregate counts block is absent', () => {
    assert.doesNotMatch(
      requestItemsSection,
      /finalizedSummary|approvedCount|rejectedCount|totalCount/
    );
    assert.match(requestItemsSection, /!finalizedSelection && latestSelectionBatch/);
  });
  scenario('Repeated finalized footer is absent and one global note remains', () => {
    assert.doesNotMatch(
      adminPage,
      /Клієнт завершив погодження\. Позиція доступна лише для перегляду\./
    );
    assert.match(
      adminPage,
      /Клієнт завершив погодження\. Підбір доступний лише для перегляду\./
    );
  });
  scenario('Pre-final edit and delete controls remain available', () => {
    assert.match(adminPage, /managerMutationsAllowed && !approvedLocked/);
    assert.match(adminPage, /Редагувати позицію/);
    assert.match(adminPage, /action=\{deleteAdminRequestItem\}/);
  });
  scenario('Finalized edit and delete controls remain hidden', () => {
    assert.equal(approved.locked, true);
    assert.equal(rejected.locked, true);
    assert.match(adminPage, /managerMutationsAllowed && !approvedLocked/);
  });
  scenario('Invoice CTA remains eligibility-driven', () => {
    assert.match(adminPage, /const canCreateInvoice = eligibility\.eligible/);
    assert.match(invoiceService, /resolveSelection/);
  });
  scenario('Client aggregate checkbox UI remains present', () => {
    assert.match(clientBatch, /ClientSelectionCheckboxList/);
    assert.match(clientCheckboxes, /type="checkbox"/);
  });
  scenario('Backend lifecycle remains guarded and aggregate', () => {
    assert.match(mutationPolicy, /FINAL_CLIENT_SELECTION_LOCKED/);
    assert.match(createItem + updateItem + deleteItem, /assertManagerSelectionMutationAllowed/);
    assert.match(sendSelection, /FINALIZED_SELECTION_LOCKED/);
    assert.match(clientSubmission, /resolveAggregateSelectionDecision/);
    assert.match(clientSubmission, /export const submitClientSelection/);
  });
  scenario('Legacy rejection comment remains read-only in CRM', () => {
    assert.match(adminPage, /clientComment: true/);
    assert.match(adminPage, /selection\?\.clientComment/);
    assert.doesNotMatch(adminPage, /name="clientComment"/);
  });
  scenario('Historical revision data remains selected and readable', () => {
    assert.match(adminPage, /orderBy: \[\{ revision: 'desc' \}/);
    assert.match(requestItemsSection, /revision: number/);
    assert.match(adminPage, /sourceRequestItemId: true/);
    assert.match(clientReadModel, /revision: 'desc'/);
    assert.match(presentationSource, /SUPERSEDED/);
  });

  assert.equal(scenarioCount, 24);
  process.stdout.write(`Stage Request Approval 6 checks passed (${scenarioCount} scenarios).\n`);
}

main();
