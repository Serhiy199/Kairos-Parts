import Link from 'next/link';
import { notFound } from 'next/navigation';

import { upsertClientBillingDetails } from '@/app/admin/client-billing-actions';
import { AdminDbBlocker } from '@/components/admin/admin-db-blocker';
import { StatusBadge } from '@/components/client/status-badge';
import { AdminOwnerDocumentsSection } from '@/components/documents/admin-owner-documents-section';
import { AdminOwnerFleetSection } from '@/components/vehicles/admin-owner-fleet-section';
import { requireCrmSession } from '@/lib/admin/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';
import { getAdminClientVehicles } from '@/lib/vehicles/admin-queries';

export const dynamic = 'force-dynamic';

const inputClass = 'h-11 rounded-md border border-border px-3 text-sm outline-none focus:border-accent';

function resultMessage(result?: string) {
  const messages: Record<string, { text: string; tone: 'success' | 'error' }> = {
    'billing-updated': { text: 'Реквізити покупця збережено.', tone: 'success' },
    'billing-validation': { text: 'Перевірте реквізити покупця: юридична назва обов’язкова, email має бути коректним.', tone: 'error' }
  };

  return result ? messages[result] : null;
}

function isCompanyBillingFilled(billingDetails?: { legalName: string | null } | null) {
  return Boolean(billingDetails?.legalName);
}

export default async function AdminClientDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ result?: string }>;
}) {
  await requireCrmSession();
  const { id } = await params;
  const query = await searchParams;

  if (!hasDatabaseUrl()) {
    return <AdminDbBlocker />;
  }

  const [client, personalVehicles] = await Promise.all([
    prisma.clientProfile.findUnique({
      where: { id },
      include: {
        user: {
          select: {
            name: true,
            email: true,
            phone: true,
            companyMemberships: {
              include: { company: { include: { billingDetails: true } } },
              take: 1
            }
          }
        },
        billingDetails: true,
        documents: {
          where: { vehicleId: null, companyId: null, requestId: null },
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            fileName: true,
            mimeType: true,
            size: true,
            visibleToClient: true,
            createdAt: true,
            uploadedBy: { select: { name: true, email: true } }
          }
        },
        requests: {
          orderBy: { createdAt: 'desc' },
          include: {
            category: { select: { name: true } },
            assignedManager: { select: { name: true, email: true } }
          }
        }
      }
    }),
    getAdminClientVehicles(id)
  ]);

  if (!client) {
    notFound();
  }

  const contactName = client.contactName ?? ([client.firstName, client.lastName].filter(Boolean).join(' ') || client.user.name || 'Клієнт');
  const companyMembership = client.user.companyMemberships[0];
  const billingMessage = resultMessage(query.result);
  const clientBilling = client.billingDetails;
  const company = companyMembership?.company;
  const legalNameDefault = clientBilling?.legalName ?? client.companyName ?? company?.name ?? contactName;
  const contactPersonDefault = clientBilling?.contactPerson ?? client.contactName ?? client.user.name ?? contactName;
  const phoneDefault = clientBilling?.phone ?? client.phone ?? client.user.phone ?? '';
  const emailDefault = clientBilling?.email ?? client.email ?? client.user.email ?? '';
  const edrpouDefault = clientBilling?.edrpou ?? client.taxId ?? company?.edrpou ?? '';

  return (
    <div className="grid gap-6">
      {billingMessage ? (
        <div className={billingMessage.tone === 'error' ? 'rounded-md border border-red-200 bg-red-50 p-4 text-sm font-semibold text-red-700' : 'rounded-md border border-success/30 bg-[#E7F6EC] p-4 text-sm font-semibold text-success'}>
          {billingMessage.text}
        </div>
      ) : null}

      <section className="rounded-lg border border-border bg-card p-6 shadow-card">
        <Link href="/admin/clients" className="text-sm font-semibold text-muted transition hover:text-accent">← До клієнтів</Link>
        <p className="mt-4 text-sm font-bold uppercase text-accent">Клієнт</p>
        <h2 className="mt-2 text-3xl font-bold text-foreground">{contactName}</h2>
        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <Info label="Компанія" value={client.companyName ?? '—'} />
          <Info label="Телефон" value={client.phone ?? client.user.phone ?? '—'} />
          <Info label="Email" value={client.email ?? client.user.email ?? '—'} />
          <Info label="Тип" value={client.clientType === 'BUSINESS' ? 'ФОП / Юр особа' : 'Фіз особа'} />
        </div>
        {companyMembership ? (
          <div className="mt-5 rounded-md border border-accent/30 bg-[#FFF7E0] p-4 text-sm text-[#8A5B24]">
            <p className="font-bold text-foreground">Company account: {companyMembership.company.name}</p>
            <p className="mt-1">ЄДРПОУ: {companyMembership.company.edrpou ?? '—'} · {companyMembership.company.email ?? 'email —'} · {companyMembership.company.phone ?? 'телефон —'}</p>
            <Link href={`/admin/companies/${companyMembership.company.id}`} className="mt-3 inline-flex font-bold text-foreground transition hover:text-accent">
              Відкрити компанію
            </Link>
          </div>
        ) : null}
      </section>

      <section className="grid gap-4 rounded-lg border border-border bg-card p-6 shadow-card">
        <div>
          <p className="text-sm font-bold uppercase text-accent">Реквізити покупця</p>
          <h2 className="mt-2 text-lg font-bold text-foreground">{company ? 'Fallback-реквізити клієнта' : 'Дані для рахунків'}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            {company
              ? 'Клієнт прив’язаний до компанії. Для рахунків у першу чергу використовуються реквізити компанії. Ці реквізити клієнта будуть використані, якщо реквізити компанії не заповнені.'
              : 'Заповніть реквізити покупця, щоб вони автоматично підтягувалися в рахунки цього клієнта.'}
          </p>
          {company ? (
            <div className="mt-4 rounded-md border border-accent/30 bg-[#FFF7E0] p-4 text-sm text-[#8A5B24]">
              <p className="font-bold text-foreground">Компанія: {company.name}</p>
              <p className="mt-1">
                Реквізити компанії: {isCompanyBillingFilled(company.billingDetails) ? `${company.billingDetails?.legalName ?? company.name}${company.billingDetails?.edrpou ? ` · ЄДРПОУ ${company.billingDetails.edrpou}` : ''}` : 'ще не заповнені'}
              </p>
              <Link href={`/admin/companies/${company.id}`} className="mt-3 inline-flex rounded-md border border-accent px-4 py-2 font-bold text-foreground transition hover:bg-accent hover:text-foreground">
                Перейти до реквізитів компанії
              </Link>
            </div>
          ) : null}
          {!clientBilling ? (
            <p className="mt-4 rounded-md border border-warning/30 bg-[#FFF7E0] p-4 text-sm font-semibold text-[#8A5B24]">
              Реквізити покупця ще не заповнені. Початкові значення підставлені з профілю клієнта.
            </p>
          ) : null}
        </div>
        <form action={upsertClientBillingDetails} className="grid gap-4">
          <input type="hidden" name="clientProfileId" value={client.id} />
          <div className="grid gap-4 md:grid-cols-2">
            <label className="grid gap-2 text-sm font-semibold text-foreground">
              Компанія / юридична назва *
              <input name="legalName" required defaultValue={legalNameDefault} className={inputClass} />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-foreground">
              ЄДРПОУ
              <input name="edrpou" defaultValue={edrpouDefault} className={inputClass} />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-foreground">
              ІПН
              <input name="ipn" defaultValue={clientBilling?.ipn ?? ''} className={inputClass} />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-foreground">
              IBAN
              <input name="iban" defaultValue={clientBilling?.iban ?? ''} className={inputClass} />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-foreground">
              Банк
              <input name="bankName" defaultValue={clientBilling?.bankName ?? ''} className={inputClass} />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-foreground">
              Контактна особа
              <input name="contactPerson" defaultValue={contactPersonDefault} className={inputClass} />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-foreground">
              Телефон
              <input name="phone" defaultValue={phoneDefault} className={inputClass} />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-foreground">
              Email
              <input name="email" type="email" defaultValue={emailDefault} className={inputClass} />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-foreground md:col-span-2">
              Юридична адреса
              <input name="legalAddress" defaultValue={clientBilling?.legalAddress ?? company?.legalAddress ?? ''} className={inputClass} />
            </label>
            <label className="flex items-center gap-2 text-sm font-semibold text-foreground md:col-span-2">
              <input name="vatPayer" type="checkbox" defaultChecked={clientBilling?.vatPayer ?? false} className="h-4 w-4 accent-[var(--accent)]" />
              Платник ПДВ
            </label>
          </div>
          <button className="w-fit rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover">
            Зберегти реквізити покупця
          </button>
        </form>
      </section>

      <AdminOwnerFleetSection
        ownerType="client"
        vehicles={personalVehicles}
        createHref={`/admin/clients/${client.id}/vehicles/new`}
      />

      <AdminOwnerDocumentsSection ownerType="client" ownerId={client.id} documents={client.documents} />

      <section className="rounded-lg border border-border bg-card p-6 shadow-card">
        <p className="text-sm font-bold uppercase text-accent">Заявки клієнта</p>
        <div className="mt-4 grid gap-3 xl:hidden">
          {client.requests.map((request) => (
            <article key={request.id} className="rounded-md border border-border p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <Link href={`/admin/requests/${request.id}`} className="font-bold text-foreground transition hover:text-accent">{request.requestNumber}</Link>
                <StatusBadge status={request.status} />
              </div>
              <dl className="cabinet-record-grid mt-4">
                <ClientRequestField label="Категорія" value={request.category?.name ?? '—'} />
                <ClientRequestField label="Менеджер" value={request.assignedManager?.name ?? request.assignedManager?.email ?? 'Не призначено'} />
                <ClientRequestField label="Дата" value={request.createdAt.toLocaleDateString('uk-UA')} />
              </dl>
            </article>
          ))}
        </div>
        <div className="mt-4 hidden overflow-x-auto xl:block">
          <table className="w-full min-w-[760px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-muted">
                <th className="px-4 py-3 font-bold">№</th>
                <th className="px-4 py-3 font-bold">Категорія</th>
                <th className="px-4 py-3 font-bold">Статус</th>
                <th className="px-4 py-3 font-bold">Менеджер</th>
                <th className="px-4 py-3 font-bold">Дата</th>
              </tr>
            </thead>
            <tbody>
              {client.requests.map((request) => (
                <tr key={request.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3"><Link href={`/admin/requests/${request.id}`} className="font-bold text-foreground transition hover:text-accent">{request.requestNumber}</Link></td>
                  <td className="px-4 py-3 text-muted">{request.category?.name ?? '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={request.status} /></td>
                  <td className="px-4 py-3 text-muted">{request.assignedManager?.name ?? request.assignedManager?.email ?? 'Не призначено'}</td>
                  <td className="px-4 py-3 text-muted">{request.createdAt.toLocaleDateString('uk-UA')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {client.requests.length === 0 ? <p className="mt-5 rounded-md border border-dashed border-border p-5 text-sm text-muted">Заявок немає.</p> : null}
      </section>

    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border p-4">
      <p className="text-xs font-bold uppercase text-muted">{label}</p>
      <p className="mt-2 text-sm font-semibold text-foreground">{value}</p>
    </div>
  );
}

function ClientRequestField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-bold uppercase text-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm text-foreground">{value}</dd>
    </div>
  );
}
