import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

import {
  buildInvoiceBuyerTaxId,
  buildInvoicePartyDetails,
  buildInvoicePartyRows
} from '../lib/invoices/party-details';
import {
  buildInvoiceHeading,
  formatInvoiceSentDate,
  INVOICE_VALIDITY_NOTICE
} from '../lib/invoices/presentation';

function readWorkspaceFile(filePath: string) {
  return fs.readFileSync(path.join(process.cwd(), filePath), 'utf8');
}

function main() {
  assert.equal(buildInvoiceBuyerTaxId({ edrpou: '5678547', ipn: '1111111111' }), '5678547 / 1111111111');
  assert.equal(buildInvoiceBuyerTaxId({ edrpou: '5678547', ipn: '' }), '5678547');
  assert.equal(buildInvoiceBuyerTaxId({ edrpou: '', ipn: '1111111111' }), '1111111111');
  assert.equal(buildInvoiceBuyerTaxId({ edrpou: ' ', ipn: null }), null);

  const buyerRows = buildInvoicePartyRows({
    legalName: 'Агроліга',
    edrpou: '5678547',
    ipn: '1111111111',
    iban: 'UA000000000000000000000000000',
    bankName: 'Test Bank',
    mfo: '300001',
    legalAddress: 'Київ',
    contactPerson: 'Тест Тест',
    phone: '+380501111111',
    email: 'client@example.com',
    vatPayer: true
  }, { buyer: true });
  assert.deepEqual(buyerRows, [
    ['Назва', 'Агроліга'],
    ['ЄДРПОУ/ІПН', '5678547 / 1111111111'],
    ['МФО', '300001'],
    ['Контактна особа', 'Тест Тест'],
    ['Телефон', '+380501111111']
  ]);
  assert.equal(buildInvoicePartyRows({ edrpou: '', ipn: '' }, { buyer: true })?.some(([label]) => label === 'ЄДРПОУ/ІПН'), false);

  const buyerDetails = buildInvoicePartyDetails({
    legalName: 'Агроліга',
    edrpou: '5678547',
    ipn: '1111111111',
    iban: 'UA000000000000000000000000000',
    bankName: 'Test Bank',
    mfo: '300001',
    legalAddress: 'Київ',
    contactPerson: 'Тест Тест',
    phone: '+380501111111',
    email: 'client@example.com',
    vatPayer: true
  }, { buyer: true });

  assert.equal(
    buyerDetails,
    'Агроліга, ЄДРПОУ/ІПН 5678547 / 1111111111, МФО 300001, контактна особа: Тест Тест, тел. +380501111111'
  );
  for (const hiddenValue of ['UA000000000000000000000000000', 'Test Bank', 'Київ', 'client@example.com', 'платник ПДВ']) {
    assert.equal(buyerDetails?.includes(hiddenValue), false);
  }

  const sellerDetails = buildInvoicePartyDetails({
    legalName: 'ТОВ "КАЙРОС ПАРТС"',
    iban: 'UA111111111111111111111111111',
    bankName: 'Seller Bank'
  });
  assert.equal(sellerDetails?.includes('IBAN UA111111111111111111111111111'), true);
  assert.equal(sellerDetails?.includes('банк Seller Bank'), true);

  const sentAt = new Date('2026-07-29T21:30:00.000Z');
  assert.equal(formatInvoiceSentDate(sentAt), '30 липня 2026 р.');
  assert.equal(buildInvoiceHeading('28', sentAt), 'Рахунок № 28 від 30 липня 2026 р.');
  assert.equal(buildInvoiceHeading('28', null), 'Рахунок № 28');

  const printView = readWorkspaceFile('components/invoices/invoice-print-view.tsx');
  const pdfTemplate = readWorkspaceFile('lib/invoices/pdf.ts');
  assert.equal(printView.includes('Виконавець'), true);
  assert.equal(printView.includes('Замовник'), false);
  assert.equal(pdfTemplate.includes("'Виконавець'"), true);
  assert.equal(pdfTemplate.includes("'Замовник'"), false);
  assert.equal(printView.includes('INVOICE_VALIDITY_NOTICE'), true);
  assert.equal(pdfTemplate.includes('INVOICE_VALIDITY_NOTICE'), true);
  assert.match(printView, /size: A4 landscape;\r?\n\s+margin: 0;/);
  assert.equal(printView.includes('padding: 9mm !important;'), true);
  assert.equal(
    printView.includes('rounded-md border border-[#d7d9dd] p-4 text-sm print:hidden'),
    true
  );
  assert.equal(INVOICE_VALIDITY_NOTICE, 'Рахунок є дійсним протягом 2-х банківських днів');

  console.log('Invoice presentation checks passed.');
}

main();
