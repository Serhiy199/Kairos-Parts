import { notFound } from 'next/navigation';

import { AdminDbBlocker } from '@/components/admin/admin-db-blocker';
import { InvoicePrintView } from '@/components/invoices/invoice-print-view';
import { requireCrmSession } from '@/lib/admin/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { getInvoiceForAdmin } from '@/lib/invoices/service';

export const dynamic = 'force-dynamic';

export default async function AdminInvoicePrintPage({
  params
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  await requireCrmSession();

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

  return (
    <InvoicePrintView
      invoice={invoice}
      backHref={`/admin/requests/${invoice.request.id}`}
      backLabel="Назад до заявки"
    />
  );
}
