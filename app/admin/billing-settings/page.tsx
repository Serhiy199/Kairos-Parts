import { saveSellerBillingDetails } from '@/app/admin/billing-actions';
import { AdminDbBlocker } from '@/components/admin/admin-db-blocker';
import { requireAdminSession } from '@/lib/admin/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const inputClass = 'rounded-md border border-border px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25';

function resultMessage(result?: string) {
  const messages: Record<string, string> = {
    saved: 'Реквізити продавця збережено.',
    validation: 'Перевірте реквізити продавця.',
    database: 'DATABASE_URL не налаштовано.'
  };

  return result ? messages[result] : null;
}

export default async function AdminBillingSettingsPage({
  searchParams
}: {
  searchParams: Promise<{ result?: string }>;
}) {
  await requireAdminSession();
  const query = await searchParams;

  if (!hasDatabaseUrl()) {
    return <AdminDbBlocker />;
  }

  const details = await prisma.sellerBillingDetails.findFirst({
    where: { isDefault: true },
    orderBy: { createdAt: 'asc' }
  });
  const message = resultMessage(query.result);

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-border bg-card p-6 shadow-card">
        <p className="text-sm font-bold uppercase text-accent">Реквізити продавця</p>
        <h1 className="mt-2 text-2xl font-bold text-foreground">Kairos Parts для рахунків</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">
          Ці дані автоматично потрапляють у snapshot рахунку під час створення. Зміна реквізитів не змінює вже створені рахунки.
        </p>
        {message ? <div className="mt-4 rounded-md border border-success/30 bg-[#E7F6EC] p-4 text-sm font-semibold text-success">{message}</div> : null}
      </section>

      <form action={saveSellerBillingDetails} className="grid gap-5 rounded-lg border border-border bg-card p-6 shadow-card">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Назва компанії *
            <input name="legalName" required defaultValue={details?.legalName ?? 'ТОВ "КАЙРОС ПАРТС"'} className={inputClass} />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            ЄДРПОУ
            <input name="edrpou" defaultValue={details?.edrpou ?? ''} className={inputClass} />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            ІПН
            <input name="ipn" defaultValue={details?.ipn ?? ''} className={inputClass} />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            IBAN
            <input name="iban" defaultValue={details?.iban ?? ''} className={inputClass} />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Банк
            <input name="bankName" defaultValue={details?.bankName ?? ''} className={inputClass} />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            МФО
            <input name="mfo" defaultValue={details?.mfo ?? ''} className={inputClass} />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Телефон
            <input name="phone" defaultValue={details?.phone ?? ''} className={inputClass} />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Email
            <input name="email" type="email" defaultValue={details?.email ?? ''} className={inputClass} />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground md:col-span-2">
            Адреса
            <input name="legalAddress" defaultValue={details?.legalAddress ?? ''} className={inputClass} />
          </label>
        </div>
        <button className="w-fit rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover">
          Зберегти реквізити
        </button>
      </form>
    </div>
  );
}
