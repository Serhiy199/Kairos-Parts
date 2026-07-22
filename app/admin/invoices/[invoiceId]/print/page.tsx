import { notFound } from 'next/navigation';

import { AdminDbBlocker } from '@/components/admin/admin-db-blocker';
import { InvoicePrintView } from '@/components/invoices/invoice-print-view';
import { requireCrmSession } from '@/lib/admin/access';
import { getServerAuditRequestContext } from '@/lib/audit-log/request-context';
import { auditUserActor, writeAuditLog } from '@/lib/audit-log/service';
import { hasDatabaseUrl } from '@/lib/env/database';
import { getInvoiceForAdmin } from '@/lib/invoices/service';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function AdminInvoicePrintPage({
  params
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const session = await requireCrmSession();

  if (!hasDatabaseUrl()) {
    return (
      <main className="min-h-screen bg-surface p-6">
        <AdminDbBlocker />
      </main>
    );
  }

  const { invoiceId } = await params;
  const invoice = await getInvoiceForAdmin(invoiceId);

  if (!invoice) {
    notFound();
  }

  await writeAuditLog(prisma, {
    actor: auditUserActor(session.user.id),
    companyId: invoice.companyId,
    entityType: 'INVOICE',
    entityId: invoice.id,
    entityLabel: `Рахунок ${invoice.invoiceNumber}`,
    action: 'INVOICE_PDF_OPENED',
    category: 'CRITICAL_READ',
    metadata: { source: 'ADMIN_CRM', requestId: invoice.requestId, status: invoice.status },
    allowedFields: { metadata: ['source', 'requestId', 'status'] },
    requestContext: await getServerAuditRequestContext()
  });

  return (
    <InvoicePrintView
      invoice={invoice}
      backHref={`/admin/requests/${invoice.request.id}`}
      backLabel="Назад до заявки"
    />
  );
}
