import { notFound } from 'next/navigation';

import { ClientDbBlocker } from '@/components/client/client-db-blocker';
import { InvoicePrintView } from '@/components/invoices/invoice-print-view';
import { getClientAccessContext, requireClientSession } from '@/lib/client/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { getInvoiceForClient } from '@/lib/invoices/service';

export const dynamic = 'force-dynamic';

export default async function ClientInvoicePrintPage({
  params
}: {
  params: Promise<{ invoiceId: string }>;
}) {
  const session = await requireClientSession();

  if (!hasDatabaseUrl()) {
    return (
      <main className="min-h-screen bg-surface p-6">
        <ClientDbBlocker />
      </main>
    );
  }

  const access = await getClientAccessContext(session.user.id);

  if (!access) {
    notFound();
  }

  const { invoiceId } = await params;
  const invoice = await getInvoiceForClient(invoiceId, access);

  if (!invoice) {
    notFound();
  }

  return (
    <InvoicePrintView
      invoice={invoice}
      backHref={`/client/requests/${invoice.request.id}`}
      backLabel="Назад до заявки"
    />
  );
}
