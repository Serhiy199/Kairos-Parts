import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import path from 'node:path';

import { Prisma } from '@prisma/client';

import { AUDIT_ACTIONS, canReadFullAuditLog } from '../lib/audit-log/contracts';
import { buildAuditDiff, sanitizeAuditPayload } from '../lib/audit-log/payload';
import { auditRequestContextFromHeaders } from '../lib/audit-log/request-context';

const root = process.cwd();

async function source(file: string) {
  return readFile(path.join(root, file), 'utf8');
}

async function sourceFiles(directory: string): Promise<string[]> {
  const entries = await readdir(path.join(root, directory), { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const relative = path.join(directory, entry.name);
    if (entry.isDirectory()) return sourceFiles(relative);
    return /\.(ts|tsx)$/.test(entry.name) ? [relative] : [];
  }));
  return nested.flat();
}

async function assertStaticCoverage() {
  const expectedActions = [
    'REQUEST_STATUS_CHANGED', 'REQUEST_MANAGER_ASSIGNED', 'REQUEST_MANAGER_REASSIGNED',
    'REQUEST_MANAGER_UNASSIGNED', 'REQUEST_COMPANY_CHANGED', 'REQUEST_ITEM_CREATED',
    'REQUEST_ITEM_UPDATED', 'REQUEST_ITEM_DELETED', 'REQUEST_ITEMS_SENT_FOR_APPROVAL',
    'REQUEST_ITEMS_CLIENT_APPROVAL_CHANGED', 'COMMERCIAL_OFFER_CREATED',
    'COMMERCIAL_OFFER_UPDATED', 'COMMERCIAL_OFFER_ITEMS_CHANGED', 'COMMERCIAL_OFFER_SENT',
    'COMMERCIAL_OFFER_APPROVED', 'COMMERCIAL_OFFER_REJECTED', 'COMMERCIAL_OFFER_CANCELLED',
    'COMMERCIAL_OFFER_DELETED', 'INVOICE_CREATED', 'INVOICE_SENT', 'INVOICE_MARKED_PAID',
    'INVOICE_CANCELLED', 'INVOICE_PDF_OPENED', 'DOCUMENT_UPLOADED', 'DOCUMENT_UPDATED',
    'DOCUMENT_RENAMED', 'DOCUMENT_VISIBILITY_CHANGED', 'DOCUMENT_DELETED',
    'DOCUMENT_DOWNLOADED', 'COMPANY_UPDATED', 'COMPANY_BILLING_UPDATED',
    'COMPANY_PRIMARY_CONTACT_CHANGED', 'COMPANY_MEMBER_ADDED', 'COMPANY_MEMBER_REMOVED',
    'CLIENT_BILLING_UPDATED'
  ] as const;
  for (const action of expectedActions) assert.equal(AUDIT_ACTIONS[action], action);

  const [requestActions, offers, invoices, companies, adminPrint, clientPrint, adminDownload] = await Promise.all([
    source('app/admin/actions.ts'),
    source('lib/commercial-offers/service.ts'),
    source('lib/invoices/service.ts'),
    source('app/admin/company-actions.ts'),
    source('app/admin/invoices/[invoiceId]/print/page.tsx'),
    source('app/client/invoices/[invoiceId]/print/page.tsx'),
    source('app/api/admin/request-documents/[documentId]/file/route.ts')
  ]);

  assert.match(requestActions, /REQUEST_STATUS_CHANGED[\s\S]*category: 'STANDARD'/);
  assert.match(requestActions, /REQUEST_ITEMS_SENT_FOR_APPROVAL/);
  assert.match(requestActions, /prisma\.\$transaction\(async \(tx\)/);
  assert.match(offers, /COMMERCIAL_OFFER_CREATED[\s\S]*FINANCIAL_CRITICAL/);
  assert.match(offers, /COMMERCIAL_OFFER_ITEMS_CHANGED[\s\S]*FINANCIAL_CRITICAL/);
  assert.match(offers, /writeOfferAudit\(tx/);
  assert.match(invoices, /INVOICE_CREATED/);
  assert.match(invoices, /INVOICE_MARKED_PAID/);
  assert.match(invoices, /category: 'FINANCIAL_CRITICAL'/);
  assert.match(invoices, /writeInvoiceAudit\(tx/);
  assert.match(companies, /COMPANY_BILLING_UPDATED[\s\S]*FINANCIAL_CRITICAL/);
  assert.match(adminPrint, /INVOICE_PDF_OPENED[\s\S]*CRITICAL_READ/);
  assert.match(clientPrint, /INVOICE_PDF_OPENED[\s\S]*CRITICAL_READ/);
  assert.match(adminDownload, /DOCUMENT_DOWNLOADED[\s\S]*CRITICAL_READ/);

  const files = [...await sourceFiles('app'), ...await sourceFiles('lib')];
  for (const file of files) {
    const content = await source(file);
    if (file !== path.normalize('lib/audit-log/service.ts')) {
      assert.doesNotMatch(content, /auditLog\.create\s*\(/, `raw audit create in ${file}`);
    }
    assert.doesNotMatch(content, /auditLog\.(?:update|delete|deleteMany|upsert)\s*\(/, `audit mutation in ${file}`);
  }
}

function assertPayloadSafety() {
  const invoice = sanitizeAuditPayload({
    invoiceNumber: '22',
    subtotal: new Prisma.Decimal('1000.00'),
    total: new Prisma.Decimal('1200.00'),
    sellerSnapshot: { legalName: 'secret full object' },
    buyerSnapshot: { legalName: 'secret full object' },
    password: 'no',
    resetToken: 'no',
    privateUrl: 'no',
    itemIds: Array.from({ length: 80 }, (_, index) => `item-${index}`)
  }, ['invoiceNumber', 'subtotal', 'total', 'sellerSnapshot', 'buyerSnapshot', 'password', 'resetToken', 'privateUrl', 'itemIds']);

  assert.equal(invoice?.subtotal, '1000');
  assert.equal(invoice?.total, '1200');
  assert.equal(invoice?.password, undefined);
  assert.equal(invoice?.resetToken, undefined);
  assert.equal(invoice?.privateUrl, undefined);
  assert.equal((invoice?.itemIds as unknown[]).length, 50);

  const diff = buildAuditDiff(
    { status: 'DRAFT', total: new Prisma.Decimal('100.00'), unchanged: 'same', token: 'no' },
    { status: 'SENT', total: new Prisma.Decimal('120.00'), unchanged: 'same', token: 'still no' },
    ['status', 'total', 'unchanged', 'token']
  );
  assert.deepEqual(diff.before, { status: 'DRAFT', total: '100' });
  assert.deepEqual(diff.after, { status: 'SENT', total: '120' });
}

function assertRequestContext() {
  const headers = new Headers({
    'x-forwarded-for': '203.0.113.9, 10.0.0.1',
    'x-real-ip': '127.0.0.1',
    'user-agent': 'Audit test agent'
  });
  const context = auditRequestContextFromHeaders(headers);
  assert.equal(context.ipAddress, '203.0.113.9, 10.0.0.1');
  assert.equal(context.userAgent, 'Audit test agent');
  assert.equal(auditRequestContextFromHeaders(new Headers({ 'x-real-ip': '::1' })).ipAddress, '::1');
}

async function assertTransactionBehavior() {
  type State = { businessWrites: number; auditWrites: number };
  const state: State = { businessWrites: 0, auditWrites: 0 };

  async function transaction(work: (draft: State) => Promise<void>) {
    const draft = { ...state };
    await work(draft);
    Object.assign(state, draft);
  }

  await transaction(async (draft) => {
    draft.businessWrites += 1;
    draft.auditWrites += 1;
  });
  assert.deepEqual(state, { businessWrites: 1, auditWrites: 1 });

  await assert.rejects(transaction(async (draft) => {
    draft.businessWrites += 1;
    throw new Error('audit_failure');
  }), /audit_failure/);
  assert.deepEqual(state, { businessWrites: 1, auditWrites: 1 });
  assert.equal(state.auditWrites, state.businessWrites, 'one action must produce one audit record');
}

async function main() {
  await assertStaticCoverage();
  assertPayloadSafety();
  assertRequestContext();
  await assertTransactionBehavior();
  assert.equal(canReadFullAuditLog('ADMIN'), true);
  assert.equal(canReadFullAuditLog('MANAGER'), false);
  process.stdout.write('Admin Audit Log 3 verification passed.\n');
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
