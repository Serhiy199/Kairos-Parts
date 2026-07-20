import Link from 'next/link';

import { AdminDbBlocker } from '@/components/admin/admin-db-blocker';
import { requireCrmSession } from '@/lib/admin/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function AdminClientsPage() {
  await requireCrmSession();

  if (!hasDatabaseUrl()) {
    return <AdminDbBlocker />;
  }

  const clients = await prisma.clientProfile.findMany({
    orderBy: { updatedAt: 'desc' },
    include: {
      user: { select: { email: true, phone: true, name: true } },
      _count: { select: { requests: true, vehicles: true, documents: true } },
      requests: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { createdAt: true }
      }
    }
  });

  return (
    <div className="cabinet-stack">
      <section className="cabinet-card">
        <p className="text-sm font-bold uppercase text-accent">Клієнтська база</p>
        <h2 className="mt-2 text-2xl font-bold text-foreground">Клієнти</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Базовий CRM перегляд клієнтів, їх заявок, техніки та документів. Редагування клієнтів не входить у Day 9.
        </p>
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
        <div className="grid gap-3 p-4 sm:p-5 xl:hidden">
          {clients.map((client) => (
            <article key={client.id} className="rounded-md border border-border p-4">
              <Link href={`/admin/clients/${client.id}`} className="font-bold text-foreground transition hover:text-accent">
                {client.contactName ?? ([client.firstName, client.lastName].filter(Boolean).join(' ') || client.user.name || 'Клієнт')}
              </Link>
              <dl className="cabinet-record-grid mt-4">
                <ClientCardField label="Компанія" value={client.companyName ?? '—'} />
                <ClientCardField label="Телефон" value={client.phone ?? client.user.phone ?? '—'} />
                <ClientCardField label="Email" value={client.email ?? client.user.email ?? '—'} />
                <ClientCardField label="Тип" value={client.clientType === 'BUSINESS' ? 'ФОП / Юр особа' : 'Фіз особа'} />
                <ClientCardField label="Заявки" value={String(client._count.requests)} />
                <ClientCardField label="Техніка" value={String(client._count.vehicles)} />
                <ClientCardField label="Остання заявка" value={client.requests[0]?.createdAt.toLocaleDateString('uk-UA') ?? '—'} />
              </dl>
            </article>
          ))}
        </div>
        <div className="hidden overflow-x-auto xl:block">
          <table className="w-full min-w-[980px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-muted">
                <th className="px-4 py-3 font-bold">Клієнт</th>
                <th className="px-4 py-3 font-bold">Компанія</th>
                <th className="px-4 py-3 font-bold">Телефон</th>
                <th className="px-4 py-3 font-bold">Email</th>
                <th className="px-4 py-3 font-bold">Тип</th>
                <th className="px-4 py-3 font-bold">Заявки</th>
                <th className="px-4 py-3 font-bold">Техніка</th>
                <th className="px-4 py-3 font-bold">Остання заявка</th>
              </tr>
            </thead>
            <tbody>
              {clients.map((client) => (
                <tr key={client.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3">
                    <Link href={`/admin/clients/${client.id}`} className="font-bold text-foreground transition hover:text-accent">
                      {client.contactName ?? ([client.firstName, client.lastName].filter(Boolean).join(' ') || client.user.name || 'Клієнт')}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{client.companyName ?? '—'}</td>
                  <td className="px-4 py-3 text-muted">{client.phone ?? client.user.phone ?? '—'}</td>
                  <td className="px-4 py-3 text-muted">{client.email ?? client.user.email ?? '—'}</td>
                  <td className="px-4 py-3 text-muted">{client.clientType === 'BUSINESS' ? 'ФОП / Юр особа' : 'Фіз особа'}</td>
                  <td className="px-4 py-3 font-bold text-foreground">{client._count.requests}</td>
                  <td className="px-4 py-3 font-bold text-foreground">{client._count.vehicles}</td>
                  <td className="px-4 py-3 text-muted">{client.requests[0]?.createdAt.toLocaleDateString('uk-UA') ?? '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {clients.length === 0 ? <p className="m-4 rounded-md border border-dashed border-border p-5 text-sm text-muted sm:m-5">Клієнтів ще немає.</p> : null}
      </section>
    </div>
  );
}

function ClientCardField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <dt className="text-xs font-bold uppercase text-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm text-foreground">{value}</dd>
    </div>
  );
}
