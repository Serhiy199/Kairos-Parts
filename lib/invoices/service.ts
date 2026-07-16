import { Prisma, UserRole } from '@prisma/client';

import type { ClientAccessContext } from '@/lib/client/access';
import { requestAccessWhere } from '@/lib/client/access';
import { buyerBillingSnapshot, sellerBillingSnapshot, type ClientBillingInput, type CompanyBillingInput } from '@/lib/billing/validation';
import { prisma } from '@/lib/prisma';
import { sendTelegramInvoiceSentNotification } from '@/lib/telegram/notifications';

const crmRoles: UserRole[] = ['MANAGER', 'ADMIN'];

function calculateLineTotal(quantity: number, price: Prisma.Decimal.Value) {
  return new Prisma.Decimal(price).mul(quantity);
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

export async function generateInvoiceNumber(requestId: string) {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: { requestNumber: true }
  });

  if (!request) {
    throw new Error('request_not_found');
  }

  const count = await prisma.invoice.count({ where: { requestId } });
  return `${request.requestNumber}-INV-${String(count + 1).padStart(2, '0')}`;
}

export async function createInvoiceFromApprovedRequestItems({
  requestId,
  createdById,
  createdByRole
}: {
  requestId: string;
  createdById: string;
  createdByRole: UserRole;
}) {
  if (!isCrmRole(createdByRole)) {
    return { ok: false as const, status: 'invoice-forbidden' };
  }

  const request = await prisma.request.findUnique({
    where: { id: requestId },
    select: {
      id: true,
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
      },
      items: {
        where: {
          approvedByClient: true,
          includeInInvoice: true,
          visibleToClient: true
        },
        orderBy: { createdAt: 'asc' }
      }
    }
  });

  if (!request) {
    return { ok: false as const, status: 'request-not-found' };
  }

  if (request.items.length === 0) {
    return { ok: false as const, status: 'invoice-no-approved-items' };
  }

  const sellerDetails = await prisma.sellerBillingDetails.findFirst({
    where: { isDefault: true },
    orderBy: { createdAt: 'asc' }
  });

  if (!sellerDetails) {
    return { ok: false as const, status: 'invoice-seller-details-required' };
  }

  const buyerDetails: CompanyBillingInput = companyBillingDetailsSnapshot(request)
    ?? clientBillingDetailsSnapshot(request.client?.billingDetails)
    ?? fallbackBuyerSnapshot(request);

  const invoiceNumber = await generateInvoiceNumber(request.id);
  const createItems = request.items.map((item) => {
    const price = item.salePrice ?? new Prisma.Decimal(0);
    const total = calculateLineTotal(item.quantity, price);

    return {
      requestItemId: item.id,
      name: item.name,
      brand: item.brand,
      catalogNumber: item.catalogNumber,
      quantity: item.quantity,
      unit: item.unit,
      price,
      total,
      comment: item.comment
    };
  });
  const subtotal = createItems.reduce((sum, item) => sum.add(item.total), new Prisma.Decimal(0));

  const invoice = await prisma.invoice.create({
    data: {
      requestId: request.id,
      companyId: request.companyId,
      clientId: request.client?.userId ?? null,
      invoiceNumber,
      currency: 'UAH',
      subtotal,
      totalAmount: subtotal,
      sellerSnapshot: sellerBillingSnapshot(sellerDetails),
      buyerSnapshot: buyerBillingSnapshot(buyerDetails),
      createdById,
      items: { create: createItems }
    },
    include: { items: { orderBy: { createdAt: 'asc' } } }
  });

  return { ok: true as const, invoice };
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

export async function sendInvoiceToClient(invoiceId: string, actorRole: UserRole) {
  if (!isCrmRole(actorRole)) {
    return { ok: false as const, status: 'invoice-forbidden' };
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    include: { items: { select: { id: true } } }
  });

  if (!invoice) {
    return { ok: false as const, status: 'invoice-not-found' };
  }

  if (invoice.status !== 'DRAFT') {
    return { ok: false as const, status: 'invoice-invalid-transition' };
  }

  if (invoice.items.length === 0) {
    return { ok: false as const, status: 'invoice-empty' };
  }

  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: { status: 'SENT', sentAt: new Date() }
  });

  try {
    await sendTelegramInvoiceSentNotification({ invoiceId: updated.id });
  } catch {
    // Telegram delivery must not block the invoice status transition.
  }

  return { ok: true as const, invoice: updated };
}

export async function cancelInvoice(invoiceId: string, actorRole: UserRole) {
  if (!isCrmRole(actorRole)) {
    return { ok: false as const, status: 'invoice-forbidden' };
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, status: true }
  });

  if (!invoice) {
    return { ok: false as const, status: 'invoice-not-found' };
  }

  if (!['DRAFT', 'SENT'].includes(invoice.status)) {
    return { ok: false as const, status: 'invoice-invalid-transition' };
  }

  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: { status: 'CANCELLED', cancelledAt: new Date() }
  });

  return { ok: true as const, invoice: updated };
}

export async function markInvoicePaid(invoiceId: string, actorRole: UserRole) {
  if (!isCrmRole(actorRole)) {
    return { ok: false as const, status: 'invoice-forbidden' };
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: { id: true, status: true }
  });

  if (!invoice) {
    return { ok: false as const, status: 'invoice-not-found' };
  }

  if (invoice.status !== 'SENT') {
    return { ok: false as const, status: 'invoice-invalid-transition' };
  }

  const updated = await prisma.invoice.update({
    where: { id: invoice.id },
    data: { status: 'PAID', paidAt: new Date() }
  });

  return { ok: true as const, invoice: updated };
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
