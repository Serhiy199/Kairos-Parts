import type { Prisma } from '@prisma/client';
import Link from 'next/link';

import { AdminDbBlocker } from '@/components/admin/admin-db-blocker';
import { StatusBadge } from '@/components/client/status-badge';
import { requireCrmSession } from '@/lib/admin/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';
import { REQUEST_SOURCE_LABELS, REQUEST_SOURCES } from '@/lib/requests/sources';
import { REQUEST_STATUS_LABELS, REQUEST_STATUSES } from '@/lib/requests/statuses';

export const dynamic = 'force-dynamic';

type SearchParams = {
  status?: string;
  source?: string;
  manager?: string;
  category?: string;
  dateFrom?: string;
  dateTo?: string;
  q?: string;
};

function inputValue(value?: string) {
  return value ?? '';
}

export default async function AdminRequestsPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const session = await requireCrmSession();
  const params = await searchParams;

  if (!hasDatabaseUrl()) {
    return <AdminDbBlocker />;
  }

  const where: Prisma.RequestWhereInput = {};

  if (params.status && REQUEST_STATUSES.includes(params.status as never)) {
    where.status = params.status as never;
  }

  if (params.source && REQUEST_SOURCES.includes(params.source as never)) {
    where.source = params.source as never;
  }

  if (params.manager) {
    where.assignedManagerId = params.manager;
  }

  if (params.category) {
    where.categoryId = params.category;
  }

  if (params.dateFrom || params.dateTo) {
    where.createdAt = {
      ...(params.dateFrom ? { gte: new Date(params.dateFrom) } : {}),
      ...(params.dateTo ? { lte: new Date(`${params.dateTo}T23:59:59.999Z`) } : {})
    };
  }

  const query = params.q?.trim();

  if (query) {
    where.OR = [
      { requestNumber: { contains: query, mode: 'insensitive' } },
      { guestPhone: { contains: query, mode: 'insensitive' } },
      { guestName: { contains: query, mode: 'insensitive' } },
      { companyName: { contains: query, mode: 'insensitive' } },
      { vinOrSerial: { contains: query, mode: 'insensitive' } },
      { client: { contactName: { contains: query, mode: 'insensitive' } } },
      { client: { companyName: { contains: query, mode: 'insensitive' } } },
      { client: { phone: { contains: query, mode: 'insensitive' } } },
      { client: { email: { contains: query, mode: 'insensitive' } } }
    ];
  }

  const [requests, managers, categories] = await Promise.all([
    prisma.request.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 100,
      include: {
        client: { select: { contactName: true, companyName: true, phone: true } },
        category: { select: { id: true, name: true } },
        assignedManager: { select: { id: true, name: true, email: true } }
      }
    }),
    prisma.user.findMany({
      where: { role: { in: ['MANAGER', 'ADMIN'] } },
      orderBy: [{ role: 'asc' }, { name: 'asc' }],
      select: { id: true, name: true, email: true, role: true }
    }),
    prisma.category.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true }
    })
  ]);

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-border bg-card p-6 shadow-card">
        <p className="text-sm font-bold uppercase text-accent">CRM заявки</p>
        <h2 className="mt-2 text-2xl font-bold text-foreground">Список заявок</h2>
        <p className="mt-2 text-sm text-muted">
          {session.user.role === 'ADMIN' ? 'Адміністратор бачить повний потік заявок.' : 'Менеджер бачить CRM потік заявок. Обмеження тільки призначеними менеджеру заявками ще не ввімкнено.'}
        </p>

        <form className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <input name="q" defaultValue={inputValue(params.q)} placeholder="Пошук: №, телефон, клієнт, VIN" className="h-11 rounded-md border border-border px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 xl:col-span-2" />
          <select name="status" defaultValue={inputValue(params.status)} className="h-11 rounded-md border border-border px-3 text-sm outline-none focus:border-accent">
            <option value="">Всі статуси</option>
            {REQUEST_STATUSES.map((status) => <option key={status} value={status}>{REQUEST_STATUS_LABELS[status]}</option>)}
          </select>
          <select name="source" defaultValue={inputValue(params.source)} className="h-11 rounded-md border border-border px-3 text-sm outline-none focus:border-accent">
            <option value="">Всі джерела</option>
            {REQUEST_SOURCES.map((source) => <option key={source} value={source}>{REQUEST_SOURCE_LABELS[source]}</option>)}
          </select>
          <select name="manager" defaultValue={inputValue(params.manager)} className="h-11 rounded-md border border-border px-3 text-sm outline-none focus:border-accent">
            <option value="">Всі менеджери</option>
            {managers.map((manager) => <option key={manager.id} value={manager.id}>{manager.name ?? manager.email}</option>)}
          </select>
          <select name="category" defaultValue={inputValue(params.category)} className="h-11 rounded-md border border-border px-3 text-sm outline-none focus:border-accent">
            <option value="">Всі категорії</option>
            {categories.map((category) => <option key={category.id} value={category.id}>{category.name}</option>)}
          </select>
          <input name="dateFrom" type="date" defaultValue={inputValue(params.dateFrom)} className="h-11 rounded-md border border-border px-3 text-sm outline-none focus:border-accent" />
          <input name="dateTo" type="date" defaultValue={inputValue(params.dateTo)} className="h-11 rounded-md border border-border px-3 text-sm outline-none focus:border-accent" />
          <button className="h-11 rounded-md bg-accent px-4 text-sm font-bold text-foreground transition hover:bg-[#DFA600]">Фільтрувати</button>
          <Link href="/admin/requests" className="flex h-11 items-center justify-center rounded-md border border-border px-4 text-sm font-semibold text-foreground transition hover:border-accent">Скинути</Link>
        </form>
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[1180px] border-collapse text-left text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted text-muted">
                <th className="px-4 py-3 font-bold">№</th>
                <th className="px-4 py-3 font-bold">Дата</th>
                <th className="px-4 py-3 font-bold">Клієнт</th>
                <th className="px-4 py-3 font-bold">Телефон</th>
                <th className="px-4 py-3 font-bold">Джерело</th>
                <th className="px-4 py-3 font-bold">Категорія</th>
                <th className="px-4 py-3 font-bold">Техніка</th>
                <th className="px-4 py-3 font-bold">Статус</th>
                <th className="px-4 py-3 font-bold">Менеджер</th>
                <th className="px-4 py-3 font-bold">Оновлено</th>
              </tr>
            </thead>
            <tbody>
              {requests.map((request) => (
                <tr key={request.id} className="border-b border-border last:border-0">
                  <td className="px-4 py-3"><Link href={`/admin/requests/${request.id}`} className="font-bold text-foreground transition hover:text-accent">{request.requestNumber}</Link></td>
                  <td className="px-4 py-3 text-muted">{request.createdAt.toLocaleDateString('uk-UA')}</td>
                  <td className="px-4 py-3 text-muted">{request.client?.companyName ?? request.client?.contactName ?? request.companyName ?? request.guestName ?? 'Гість'}</td>
                  <td className="px-4 py-3 text-muted">{request.client?.phone ?? request.guestPhone ?? '—'}</td>
                  <td className="px-4 py-3 text-muted">{REQUEST_SOURCE_LABELS[request.source]}</td>
                  <td className="px-4 py-3 text-muted">{request.category?.name ?? '—'}</td>
                  <td className="px-4 py-3 text-muted">{request.equipmentType ?? '—'}</td>
                  <td className="px-4 py-3"><StatusBadge status={request.status} /></td>
                  <td className="px-4 py-3 text-muted">{request.assignedManager?.name ?? request.assignedManager?.email ?? 'Не призначено'}</td>
                  <td className="px-4 py-3 text-muted">{request.updatedAt.toLocaleDateString('uk-UA')}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {requests.length === 0 ? <p className="m-6 rounded-md border border-dashed border-border p-5 text-sm text-muted">За вибраними фільтрами заявок немає.</p> : null}
        </div>
      </section>
    </div>
  );
}
