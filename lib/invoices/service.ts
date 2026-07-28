import { Prisma, UserRole } from '@prisma/client';

import type { AuditRequestContext } from '@/lib/audit-log/contracts';
import { buildAuditDiff } from '@/lib/audit-log/payload';
import { auditUserActor, writeAuditLog } from '@/lib/audit-log/service';
import type { ClientAccessContext } from '@/lib/client/access';
import { requestAccessWhere } from '@/lib/client/access';
import { buyerBillingSnapshot, sellerBillingSnapshot, type ClientBillingInput, type CompanyBillingInput } from '@/lib/billing/validation';
import { calculateInvoiceLineTotal } from '@/lib/invoices/totals';
import {
  InvoiceSelectionError,
  resolveInvoiceSelection
} from '@/lib/invoices/selection';
import { prisma } from '@/lib/prisma';
import { sendTelegramInvoiceSentNotification } from '@/lib/telegram/notifications';

const crmRoles: UserRole[] = ['MANAGER', 'ADMIN'];
const INVOICE_AUDIT_FIELDS = [
  'invoiceNumber', 'status', 'currency', 'subtotal', 'total', 'itemCount',
  'requestId', 'selectionBatchId', 'sentAt', 'paidAt', 'cancelledAt'
] as const;

export type InvoiceAuditContext = {
  actorId: string;
  actorRole: UserRole;
  requestContext?: AuditRequestContext;
};

const invoiceAuditSelect = {
  id: true,
  requestId: true,
  selectionBatchId: true,
  companyId: true,
  invoiceNumber: true,
  status: true,
  currency: true,
  subtotal: true,
  totalAmount: true,
  sentAt: true,
  paidAt: true,
  cancelledAt: true,
  request: { select: { requestNumber: true } },
  selectionBatch: { select: { revision: true } },
  _count: { select: { items: true } }
} satisfies Prisma.InvoiceSelect;

type InvoiceAuditRecord = Prisma.InvoiceGetPayload<{ select: typeof invoiceAuditSelect }>;

function invoiceSnapshot(invoice: InvoiceAuditRecord) {
  return {
    invoiceNumber: invoice.invoiceNumber,
    status: invoice.status,
    currency: invoice.currency,
    subtotal: invoice.subtotal.toString(),
    total: invoice.totalAmount.toString(),
    itemCount: invoice._count.items,
    requestId: invoice.requestId,
    selectionBatchId: invoice.selectionBatchId,
    sentAt: invoice.sentAt,
    paidAt: invoice.paidAt,
    cancelledAt: invoice.cancelledAt
  };
}

async function writeInvoiceAudit(
  tx: Prisma.TransactionClient,
  audit: InvoiceAuditContext,
  invoice: InvoiceAuditRecord,
  input: {
    action: 'INVOICE_CREATED' | 'INVOICE_SENT' | 'INVOICE_MARKED_PAID' | 'INVOICE_CANCELLED';
    oldValue?: unknown;
    newValue?: unknown;
  }
) {
  await writeAuditLog(tx, {
    actor: auditUserActor(audit.actorId),
    companyId: invoice.companyId,
    entityType: 'INVOICE',
    entityId: invoice.id,
    entityLabel: `Рахунок ${invoice.invoiceNumber}`,
    action: input.action,
    category: 'FINANCIAL_CRITICAL',
    oldValue: input.oldValue,
    newValue: input.newValue,
    metadata: {
      source: 'ADMIN_CRM',
      requestId: invoice.requestId,
      selectionBatchId: invoice.selectionBatchId,
      selectionRevision: invoice.selectionBatch?.revision ?? null
    },
    allowedFields: {
      oldValue: INVOICE_AUDIT_FIELDS,
      newValue: INVOICE_AUDIT_FIELDS,
      metadata: ['source', 'requestId', 'selectionBatchId', 'selectionRevision']
    },
    requestContext: audit.requestContext
  });
}

function isCrmRole(role: UserRole) {
  return crmRoles.includes(role);
}

function fallbackBuyerSnapshot(request: {
  client: {
    companyName: string | null;
    taxId: string | null;
    contactName: string | null;
    phone: string | null;
    email: string | null;
    user: { name: string | null; email: string | null; phone: string | null };
  } | null;
}): CompanyBillingInput {
  const legalName = request.client?.companyName ?? request.client?.contactName ?? request.client?.user.name ?? 'Покупець не вказаний';

  return {
    legalName,
    edrpou: request.client?.taxId ?? null,
    ipn: null,
    iban: null,
    bankName: null,
    legalAddress: null,
    contactPerson: request.client?.contactName ?? request.client?.user.name ?? null,
    phone: request.client?.phone ?? request.client?.user.phone ?? null,
    email: request.client?.email ?? request.client?.user.email ?? null,
    vatPayer: false
  };
}

function hasBuyerBillingDetails(details: { legalName: string | null } | null | undefined) {
  return Boolean(details?.legalName);
}

function companyBillingDetailsSnapshot(request: {
  company: {
    name: string;
    billingDetails: {
      legalName: string | null;
      edrpou: string | null;
      ipn: string | null;
      iban: string | null;
      bankName: string | null;
      legalAddress: string | null;
      contactPerson: string | null;
      phone: string | null;
      email: string | null;
      vatPayer: boolean;
    } | null;
  } | null;
}): CompanyBillingInput | null {
  if (!hasBuyerBillingDetails(request.company?.billingDetails)) {
    return null;
  }

  return {
    legalName: request.company?.billingDetails?.legalName ?? request.company?.name ?? 'Покупець не вказаний',
    edrpou: request.company?.billingDetails?.edrpou ?? null,
    ipn: request.company?.billingDetails?.ipn ?? null,
    iban: request.company?.billingDetails?.iban ?? null,
    bankName: request.company?.billingDetails?.bankName ?? null,
    legalAddress: request.company?.billingDetails?.legalAddress ?? null,
    contactPerson: request.company?.billingDetails?.contactPerson ?? null,
    phone: request.company?.billingDetails?.phone ?? null,
    email: request.company?.billingDetails?.email ?? null,
    vatPayer: request.company?.billingDetails?.vatPayer ?? false
  };
}

function clientBillingDetailsSnapshot(details: (Omit<ClientBillingInput, 'legalName'> & { legalName: string | null }) | null | undefined): CompanyBillingInput | null {
  if (!details?.legalName) {
    return null;
  }

  return {
    legalName: details.legalName,
    edrpou: details.edrpou ?? null,
    ipn: details.ipn ?? null,
    iban: details.iban ?? null,
    bankName: details.bankName ?? null,
    legalAddress: details.legalAddress ?? null,
    contactPerson: details.contactPerson ?? null,
    phone: details.phone ?? null,
    email: details.email ?? null,
    vatPayer: details.vatPayer
  };
}

export async function createInvoiceFromApprovedRequestItems({
  requestId,
  createdById,
  createdByRole,
  requestContext
}: {
  requestId: string;
  createdById: string;
  createdByRole: UserRole;
  requestContext?: AuditRequestContext;
}) {
  if (!isCrmRole(createdByRole)) {
    return { ok: false as const, status: 'invoice-forbidden' };
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    try {
      const invoice = await prisma.$transaction(async (tx) => {
      const selection = await resolveInvoiceSelection(tx, requestId);
      const [request, sellerDetails] = await Promise.all([
        tx.request.findUnique({
          where: { id: requestId },
          select: {
            id: true,
            requestNumber: true,
            companyId: true,
            company: {
              select: {
                name: true,
                edrpou: true,
                phone: true,
                email: true,
                legalAddress: true,
                billingDetails: true
              }
            },
            client: {
              select: {
                userId: true,
                companyName: true,
                taxId: true,
                contactName: true,
                phone: true,
                email: true,
                billingDetails: true,
                user: { select: { name: true, email: true, phone: true } }
              }
            }
          }
        }),
        tx.sellerBillingDetails.findFirst({
          where: { isDefault: true },
          orderBy: { createdAt: 'asc' }
        })
      ]);
      if (!request) {
        throw new InvoiceSelectionError('REQUEST_NOT_FOUND', { requestId });
      }
      if (!sellerDetails) {
        throw new Error('INVOICE_SELLER_DETAILS_REQUIRED');
      }

      const buyerDetails: CompanyBillingInput =
        companyBillingDetailsSnapshot(request)
        ?? clientBillingDetailsSnapshot(request.client?.billingDetails)
        ?? fallbackBuyerSnapshot(request);
      const createItems = selection.items.map((item) => {
        const total = calculateInvoiceLineTotal(
          item.quantity,
          item.approvedUnitPrice
        );
        return {
          requestItemId: item.sourceRequestItemId,
          selectionBatchItemId: item.id,
          name: item.itemName,
          brand: item.brand,
          catalogNumber: item.catalogNumber,
          analogNumber: item.analogNumber,
          quantity: item.quantity,
          unit: item.unit,
          price: item.approvedUnitPrice,
          total,
          comment: item.managerComment
        };
      });
      const subtotal = createItems.reduce(
        (sum, item) => sum.add(item.total),
        new Prisma.Decimal(0)
      );
      const created = await tx.invoice.create({
        data: {
          requestId: request.id,
          selectionBatchId: selection.batchId,
          companyId: request.companyId,
          clientId: request.client?.userId ?? null,
          currency: selection.currency,
          subtotal,
          totalAmount: subtotal,
          sellerSnapshot: sellerBillingSnapshot(sellerDetails),
          buyerSnapshot: buyerBillingSnapshot(buyerDetails),
          createdById,
          items: { create: createItems }
        },
        include: { items: { orderBy: { createdAt: 'asc' } } }
      });
      const auditInvoice = await tx.invoice.findUniqueOrThrow({
        where: { id: created.id },
        select: invoiceAuditSelect
      });
      await writeInvoiceAudit(
        tx,
        { actorId: createdById, actorRole: createdByRole, requestContext },
        auditInvoice,
        { action: 'INVOICE_CREATED', newValue: invoiceSnapshot(auditInvoice) }
      );
      return created;
    }, {
      maxWait: 5_000,
      timeout: 10_000,
      isolationLevel: 'Serializable'
    });
      return { ok: true as const, invoice };
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError
        && error.code === 'P2034'
        && attempt === 0
      ) {
        continue;
      }
      if (error instanceof InvoiceSelectionError) {
        const statusByCode = {
          REQUEST_NOT_FOUND: 'request-not-found',
          REQUEST_NOT_AWAITING_INVOICE: 'invoice-request-not-awaiting',
          NO_FINALIZED_APPROVED_BATCH: 'invoice-selection-not-found',
          NO_APPROVED_ITEMS: 'invoice-no-approved-items',
          PENDING_ITEMS_REMAIN: 'invoice-selection-stale',
          APPROVED_ITEM_PRICE_MISSING: 'invoice-approved-price-missing',
          APPROVED_ITEMS_CURRENCY_MISMATCH: 'invoice-currency-mismatch',
          INVOICE_ALREADY_EXISTS_FOR_SELECTION: 'invoice-selection-already-invoiced'
        } as const;
        return { ok: false as const, status: statusByCode[error.code] };
      }
      if (
        error instanceof Error
        && error.message === 'INVOICE_SELLER_DETAILS_REQUIRED'
      ) {
        return { ok: false as const, status: 'invoice-seller-details-required' };
      }
      if (
        error instanceof Prisma.PrismaClientKnownRequestError
        && error.code === 'P2002'
      ) {
        return {
          ok: false as const,
          status: 'invoice-selection-already-invoiced'
        };
      }
      throw error;
    }
  }
  throw new Error('Invoice creation retry loop exhausted.');
}

export async function listInvoicesForRequestAdmin(requestId: string) {
  return prisma.invoice.findMany({
    where: { requestId },
    orderBy: { createdAt: 'desc' },
    include: {
      createdBy: { select: { name: true, email: true, role: true } },
      items: { orderBy: { createdAt: 'asc' } }
    }
  });
}

export async function getInvoiceForAdmin(invoiceId: string) {
  return prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: {
      request: { select: { id: true, requestNumber: true, createdAt: true } },
      createdBy: { select: { name: true, email: true, role: true } },
      items: { orderBy: { createdAt: 'asc' } }
    }
  });
}

export async function sendInvoiceToClient(invoiceId: string, audit: InvoiceAuditContext) {
  if (!isCrmRole(audit.actorRole)) {
    return { ok: false as const, status: 'invoice-forbidden' };
  }

  const result = await prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId }, select: invoiceAuditSelect });
    if (!invoice) return { ok: false as const, status: 'invoice-not-found' };
    if (invoice.status !== 'DRAFT') return { ok: false as const, status: 'invoice-invalid-transition' };
    if (invoice._count.items === 0) return { ok: false as const, status: 'invoice-empty' };

    const updated = await tx.invoice.update({
      where: { id: invoice.id },
      data: { status: 'SENT', sentAt: new Date() }
    });
    const auditUpdated = await tx.invoice.findUniqueOrThrow({ where: { id: invoice.id }, select: invoiceAuditSelect });
    const diff = buildAuditDiff(invoiceSnapshot(invoice), invoiceSnapshot(auditUpdated), INVOICE_AUDIT_FIELDS);
    await writeInvoiceAudit(tx, audit, auditUpdated, {
      action: 'INVOICE_SENT',
      oldValue: diff.before,
      newValue: diff.after
    });
    return { ok: true as const, invoice: updated };
  });

  if (!result.ok) return result;

  try {
    await sendTelegramInvoiceSentNotification({ invoiceId: result.invoice.id });
  } catch {
    // Telegram delivery must not block the invoice status transition.
  }

  return result;
}

export async function cancelInvoice(invoiceId: string, audit: InvoiceAuditContext) {
  if (!isCrmRole(audit.actorRole)) {
    return { ok: false as const, status: 'invoice-forbidden' };
  }

  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId }, select: invoiceAuditSelect });
    if (!invoice) return { ok: false as const, status: 'invoice-not-found' };
    if (!['DRAFT', 'SENT'].includes(invoice.status)) return { ok: false as const, status: 'invoice-invalid-transition' };

    const updated = await tx.invoice.update({
      where: { id: invoice.id },
      data: { status: 'CANCELLED', cancelledAt: new Date() }
    });
    const auditUpdated = await tx.invoice.findUniqueOrThrow({ where: { id: invoice.id }, select: invoiceAuditSelect });
    const diff = buildAuditDiff(invoiceSnapshot(invoice), invoiceSnapshot(auditUpdated), INVOICE_AUDIT_FIELDS);
    await writeInvoiceAudit(tx, audit, auditUpdated, {
      action: 'INVOICE_CANCELLED',
      oldValue: diff.before,
      newValue: diff.after
    });
    return { ok: true as const, invoice: updated };
  });
}

export async function markInvoicePaid(invoiceId: string, audit: InvoiceAuditContext) {
  if (!isCrmRole(audit.actorRole)) {
    return { ok: false as const, status: 'invoice-forbidden' };
  }

  return prisma.$transaction(async (tx) => {
    const invoice = await tx.invoice.findUnique({ where: { id: invoiceId }, select: invoiceAuditSelect });
    if (!invoice) return { ok: false as const, status: 'invoice-not-found' };
    if (invoice.status !== 'SENT') return { ok: false as const, status: 'invoice-invalid-transition' };

    const updated = await tx.invoice.update({
      where: { id: invoice.id },
      data: { status: 'PAID', paidAt: new Date() }
    });
    const auditUpdated = await tx.invoice.findUniqueOrThrow({ where: { id: invoice.id }, select: invoiceAuditSelect });
    const diff = buildAuditDiff(invoiceSnapshot(invoice), invoiceSnapshot(auditUpdated), INVOICE_AUDIT_FIELDS);
    await writeInvoiceAudit(tx, audit, auditUpdated, {
      action: 'INVOICE_MARKED_PAID',
      oldValue: diff.before,
      newValue: diff.after
    });
    return { ok: true as const, invoice: updated };
  });
}

export async function listInvoicesForClientRequest(requestId: string, access: ClientAccessContext) {
  return prisma.invoice.findMany({
    where: {
      requestId,
      OR: [
        { status: { in: ['SENT', 'PAID'] } },
        { status: 'CANCELLED', sentAt: { not: null } }
      ],
      request: requestAccessWhere(access)
    },
    orderBy: { createdAt: 'desc' },
    include: { items: { orderBy: { createdAt: 'asc' } } }
  });
}

export async function getInvoiceForClient(invoiceId: string, access: ClientAccessContext) {
  return prisma.invoice.findFirst({
    where: {
      id: invoiceId,
      OR: [
        { status: { in: ['SENT', 'PAID'] } },
        { status: 'CANCELLED', sentAt: { not: null } }
      ],
      request: requestAccessWhere(access)
    },
    include: {
      request: { select: { id: true, requestNumber: true, createdAt: true } },
      items: { orderBy: { createdAt: 'asc' } }
    }
  });
}
