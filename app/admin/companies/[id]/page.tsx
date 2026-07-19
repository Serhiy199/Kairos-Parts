import Link from 'next/link';
import { notFound } from 'next/navigation';

import {
  addCompanyMember,
  assignRequestToCompany,
  removeCompanyMember,
  setPrimaryCompanyMember,
  updateCompany,
  updateCompanyBillingDetails
} from '@/app/admin/company-actions';
import { AdminDbBlocker } from '@/components/admin/admin-db-blocker';
import { StatusBadge } from '@/components/client/status-badge';
import { AdminOwnerDocumentsSection } from '@/components/documents/admin-owner-documents-section';
import { AdminOwnerFleetSection } from '@/components/vehicles/admin-owner-fleet-section';
import { requireCrmSession } from '@/lib/admin/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';
import { getAdminCompanyVehicles } from '@/lib/vehicles/admin-queries';

export const dynamic = 'force-dynamic';

const inputClass = 'rounded-md border border-border px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25';

function resultMessage(result?: string) {
  const messages: Record<string, string> = {
    created: 'Компанію створено.',
    updated: 'Дані компанії оновлено.',
    duplicate: 'Компанія з такою назвою та ЄДРПОУ вже існує.',
    'member-added': 'Користувача додано до компанії.',
    'member-removed': 'Користувача прибрано з компанії.',
    'member-not-client': 'До компанії можна додати тільки CLIENT-користувача.',
    'member-already-linked': 'Цей користувач уже привʼязаний до компанії.',
    'primary-updated': 'Primary contact оновлено.',
    'request-assigned': 'Заявку привʼязано до компанії.',
    'vehicle-assigned': 'Техніку привʼязано до компанії.',
    'vehicle-vin-duplicate': 'Техніку не привʼязано: у компанії вже є запис із таким VIN або серійним номером.',
    'assign-validation': 'Оберіть запис для привʼязки.',
    'billing-updated': 'Реквізити покупця збережено.',
    'billing-validation': 'Перевірте реквізити покупця.'
  };

  return result ? messages[result] : null;
}

export default async function AdminCompanyDetailPage({
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

  const [company, availableClients, unassignedRequests, companyVehicles] = await Promise.all([
    prisma.company.findUnique({
      where: { id },
      include: {
        members: {
          orderBy: [{ isPrimaryContact: 'desc' }, { createdAt: 'asc' }],
          include: { user: { include: { clientProfile: true } } }
        },
        requests: {
          orderBy: { createdAt: 'desc' },
          take: 12,
          include: { client: true, category: true }
        },
        billingDetails: true,
        documents: {
          where: { vehicleId: null, clientId: null, requestId: null },
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
        }
      }
    }),
    prisma.user.findMany({
      where: {
        role: 'CLIENT',
        companyMemberships: { none: {} }
      },
      orderBy: { createdAt: 'desc' },
      include: { clientProfile: true },
      take: 100
    }),
    prisma.request.findMany({
      where: { companyId: null, clientId: { not: null } },
      orderBy: { createdAt: 'desc' },
      include: { client: true },
      take: 100
    }),
    getAdminCompanyVehicles(id)
  ]);

  if (!company) {
    notFound();
  }

  const message = resultMessage(query.result);

  return (
    <div className="grid gap-6">
      <div className="rounded-lg border border-border bg-card p-6 shadow-card">
        <Link href="/admin/companies" className="text-sm font-semibold text-muted transition hover:text-accent">← До компаній</Link>
        <div className="mt-4 flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
          <div>
            <p className="text-sm font-bold uppercase text-accent">Компанія</p>
            <h1 className="mt-2 text-2xl font-bold text-foreground">{company.name}</h1>
            <p className="mt-2 text-sm text-muted">{company.edrpou ? `ЄДРПОУ: ${company.edrpou}` : 'ЄДРПОУ не вказано'}</p>
          </div>
          <div className="grid gap-1 text-sm text-muted lg:text-right">
            <p>{company.email ?? 'Email не вказано'}</p>
            <p>{company.phone ?? 'Телефон не вказано'}</p>
            <p>{company.legalAddress ?? 'Адресу не вказано'}</p>
          </div>
        </div>
        {message ? <div className="mt-4 rounded-md border border-success/30 bg-[#E7F6EC] p-4 text-sm font-semibold text-success">{message}</div> : null}
      </div>

      <form action={updateCompany} className="grid gap-4 rounded-lg border border-border bg-card p-6 shadow-card">
        <input type="hidden" name="companyId" value={company.id} />
        <h2 className="text-lg font-bold text-foreground">Дані компанії</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-foreground">Назва *<input name="name" required defaultValue={company.name} className={inputClass} /></label>
          <label className="grid gap-2 text-sm font-semibold text-foreground">ЄДРПОУ<input name="edrpou" defaultValue={company.edrpou ?? ''} className={inputClass} /></label>
          <label className="grid gap-2 text-sm font-semibold text-foreground">Email<input name="email" type="email" defaultValue={company.email ?? ''} className={inputClass} /></label>
          <label className="grid gap-2 text-sm font-semibold text-foreground">Телефон<input name="phone" defaultValue={company.phone ?? ''} className={inputClass} /></label>
          <label className="grid gap-2 text-sm font-semibold text-foreground md:col-span-2">Юридична адреса<input name="legalAddress" defaultValue={company.legalAddress ?? ''} className={inputClass} /></label>
        </div>
        <button className="w-fit rounded-md border border-border px-5 py-3 text-sm font-bold text-foreground transition hover:border-accent hover:bg-surface-muted">Зберегти</button>
      </form>

      <form action={updateCompanyBillingDetails} className="grid gap-4 rounded-lg border border-border bg-card p-6 shadow-card">
        <input type="hidden" name="companyId" value={company.id} />
        <div>
          <p className="text-sm font-bold uppercase text-accent">Реквізити покупця</p>
          <h2 className="mt-2 text-lg font-bold text-foreground">Дані для рахунків</h2>
          <p className="mt-2 text-sm leading-6 text-muted">
            Ці реквізити автоматично підтягнуться у snapshot нового рахунку. Якщо їх змінити пізніше, старі рахунки не зміняться.
          </p>
          {!company.billingDetails ? (
            <p className="mt-4 rounded-md border border-warning/30 bg-[#FFF7E0] p-4 text-sm font-semibold text-[#8A5B24]">
              Реквізити покупця ще не заповнені. Заповніть їх, щоб вони автоматично підтягувалися у рахунки.
            </p>
          ) : null}
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Компанія / юридична назва *
            <input name="legalName" required defaultValue={company.billingDetails?.legalName ?? company.name} className={inputClass} />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            ЄДРПОУ
            <input name="edrpou" defaultValue={company.billingDetails?.edrpou ?? company.edrpou ?? ''} className={inputClass} />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            ІПН
            <input name="ipn" defaultValue={company.billingDetails?.ipn ?? ''} className={inputClass} />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            IBAN
            <input name="iban" defaultValue={company.billingDetails?.iban ?? ''} className={inputClass} />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Банк
            <input name="bankName" defaultValue={company.billingDetails?.bankName ?? ''} className={inputClass} />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Контактна особа
            <input name="contactPerson" defaultValue={company.billingDetails?.contactPerson ?? company.members.find((member) => member.isPrimaryContact)?.user.clientProfile?.contactName ?? ''} className={inputClass} />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Телефон
            <input name="phone" defaultValue={company.billingDetails?.phone ?? company.phone ?? ''} className={inputClass} />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Email
            <input name="email" type="email" defaultValue={company.billingDetails?.email ?? company.email ?? ''} className={inputClass} />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground md:col-span-2">
            Юридична адреса
            <input name="legalAddress" defaultValue={company.billingDetails?.legalAddress ?? company.legalAddress ?? ''} className={inputClass} />
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-foreground md:col-span-2">
            <input name="vatPayer" type="checkbox" defaultChecked={company.billingDetails?.vatPayer ?? false} className="h-4 w-4 accent-[var(--accent)]" />
            Платник ПДВ
          </label>
        </div>
        <button className="w-fit rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover">
          Зберегти реквізити покупця
        </button>
      </form>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-lg border border-border bg-card p-6 shadow-card">
          <h2 className="text-lg font-bold text-foreground">Учасники компанії</h2>
          <div className="mt-5 grid gap-3">
            {company.members.map((member) => (
              <div key={member.id} className="flex flex-col justify-between gap-3 rounded-md border border-border p-4 md:flex-row md:items-center">
                <div>
                  <p className="font-bold text-foreground">{member.user.clientProfile?.contactName ?? member.user.name ?? member.user.email ?? 'CLIENT user'}</p>
                  <p className="mt-1 text-sm text-muted">{member.user.email ?? 'Email не вказано'} · {member.user.clientProfile?.phone ?? member.user.phone ?? 'Телефон не вказано'}</p>
                  {member.isPrimaryContact ? <p className="mt-2 text-xs font-bold uppercase text-accent">Primary contact</p> : null}
                </div>
                <div className="flex flex-wrap gap-2">
                  {!member.isPrimaryContact ? (
                    <form action={setPrimaryCompanyMember}>
                      <input type="hidden" name="companyId" value={company.id} />
                      <input type="hidden" name="memberId" value={member.id} />
                      <button className="rounded-md border border-border px-3 py-2 text-xs font-bold text-foreground transition hover:border-accent">Primary</button>
                    </form>
                  ) : null}
                  <form action={removeCompanyMember}>
                    <input type="hidden" name="companyId" value={company.id} />
                    <input type="hidden" name="memberId" value={member.id} />
                    <button className="rounded-md border border-danger/30 px-3 py-2 text-xs font-bold text-danger transition hover:bg-danger/10">Прибрати</button>
                  </form>
                </div>
              </div>
            ))}
            {company.members.length === 0 ? <p className="rounded-md border border-dashed border-border p-5 text-sm text-muted">У компанії ще немає учасників.</p> : null}
          </div>
        </section>

        <form action={addCompanyMember} className="grid h-fit gap-4 rounded-lg border border-border bg-card p-6 shadow-card">
          <input type="hidden" name="companyId" value={company.id} />
          <h2 className="text-lg font-bold text-foreground">Додати CLIENT user</h2>
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Користувач
            <select name="userId" required className={inputClass}>
              <option value="">Оберіть клієнта</option>
              {availableClients.map((user) => (
                <option key={user.id} value={user.id}>
                  {user.clientProfile?.contactName ?? user.name ?? user.email ?? user.id} · {user.email ?? 'без email'}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-sm font-semibold text-foreground">
            <input name="isPrimaryContact" type="checkbox" className="h-4 w-4 accent-[var(--accent)]" />
            Primary contact
          </label>
          <button className="rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover">Додати до компанії</button>
        </form>
      </div>

      <section className="rounded-lg border border-border bg-card p-6 shadow-card">
        <h2 className="text-lg font-bold text-foreground">Заявки компанії</h2>
        <div className="mt-5 grid gap-3">
          {company.requests.map((request) => (
            <Link key={request.id} href={`/admin/requests/${request.id}`} className="rounded-md border border-border p-4 transition hover:border-accent hover:bg-surface-muted">
              <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                <div>
                  <p className="font-bold text-foreground">{request.requestNumber}</p>
                  <p className="mt-1 text-sm text-muted">{request.category?.name ?? request.equipmentType ?? request.description.slice(0, 80)}</p>
                </div>
                <StatusBadge status={request.status} />
              </div>
            </Link>
          ))}
          {company.requests.length === 0 ? <p className="rounded-md border border-dashed border-border p-5 text-sm text-muted">Привʼязаних заявок ще немає.</p> : null}
        </div>
        <form action={assignRequestToCompany} className="mt-5 grid gap-3 border-t border-border pt-5">
          <input type="hidden" name="companyId" value={company.id} />
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Привʼязати існуючу заявку
            <select name="requestId" className={inputClass}>
              <option value="">Оберіть заявку</option>
              {unassignedRequests.map((request) => (
                <option key={request.id} value={request.id}>
                  {request.requestNumber} · {request.client?.contactName ?? request.client?.email ?? 'client'}
                </option>
              ))}
            </select>
          </label>
          <button className="w-fit rounded-md border border-border px-4 py-2 text-sm font-bold text-foreground transition hover:border-accent">Привʼязати заявку</button>
        </form>
      </section>

      <AdminOwnerFleetSection
        ownerType="company"
        vehicles={companyVehicles}
        createHref={`/admin/companies/${company.id}/vehicles/new`}
      />

      <AdminOwnerDocumentsSection ownerType="company" ownerId={company.id} documents={company.documents} />
    </div>
  );
}
