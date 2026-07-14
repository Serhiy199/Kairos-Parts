import { Prisma, UserRole } from '@prisma/client';

import type { ClientAccessContext } from '@/lib/client/access';
import { requestAccessWhere } from '@/lib/client/access';
import { prisma } from '@/lib/prisma';

const crmRoles: UserRole[] = ['MANAGER', 'ADMIN'];

function calculateLineTotal(quantity: number, price: Prisma.Decimal.Value) {
  return new Prisma.Decimal(price).mul(quantity);
}

function isCrmRole(role: UserRole) {
  return crmRoles.includes(role);
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
      client: { select: { userId: true } },
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

  const invoiceNumber = await generateInvoiceNumber(request.id);
  const createItems = request.items.map((item) => {
    const price = item.salePrice ?? new Prisma.Decimal(0);
    const total = calculateLineTotal(item.quantity, price);

    return {
      requestItemId: item.id,
      name: item.name,
      brand: item.brand,
      catalogNumber: item.catalogNumber,
      analogNumber: item.analogNumber,
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
      request: { select: { id: true, requestNumber: true } },
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
      status: { in: ['SENT', 'PAID', 'CANCELLED'] },
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
      status: { in: ['SENT', 'PAID', 'CANCELLED'] },
      request: requestAccessWhere(access)
    },
    include: {
      request: { select: { id: true, requestNumber: true } },
      items: { orderBy: { createdAt: 'asc' } }
    }
  });
}
