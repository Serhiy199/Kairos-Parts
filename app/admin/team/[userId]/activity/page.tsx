import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminDbBlocker } from '@/components/admin/admin-db-blocker';
import { AuditLogFiltersForm } from '@/components/admin/audit-log/audit-log-filters';
import { AuditLogList, AuditLogPagination } from '@/components/admin/audit-log/audit-log-list';
import { requireAdminSession } from '@/lib/admin/access';
import {
  hasAuditLogFilters,
  parseAuditLogFilters,
  type AuditLogSearchParams
} from '@/lib/audit-log/filters';
import { formatAuditDateTime } from '@/lib/audit-log/presentation';
import {
  getAuditActivityMember,
  getAuditLogPage,
  getManagerActivitySummary
} from '@/lib/audit-log/query';
import { hasDatabaseUrl } from '@/lib/env/database';
import { TEAM_ROLE_LABELS, TEAM_STATUS_LABELS } from '@/lib/users/admin-team-rules';

export const dynamic = 'force-dynamic';

export default async function ManagerActivityPage({
  params,
  searchParams
}: {
  params: Promise<{ userId: string }>;
  searchParams: Promise<AuditLogSearchParams>;
}) {
  await requireAdminSession();
  if (!hasDatabaseUrl()) return <AdminDbBlocker />;

  const { userId } = await params;
  const member = await getAuditActivityMember(userId);
  if (!member) notFound();

  const parsedFilters = parseAuditLogFilters(await searchParams);
  const filters = { ...parsedFilters, actorId: null };
  const [page, summary] = await Promise.all([
    getAuditLogPage(filters, userId),
    getManagerActivitySummary(userId)
  ]);
  const basePath = `/admin/team/${userId}/activity`;
  const latest = summary.latestActivityAt ? formatAuditDateTime(summary.latestActivityAt).full : '—';

  return (
    <div className="cabinet-stack">
      <header className="cabinet-card">
        <Link href="/admin/team" className="text-sm font-semibold text-muted transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          ← До команди
        </Link>
        <p className="mt-5 text-sm font-bold uppercase text-accent">Історія працівника</p>
        <h1 className="mt-2 break-words text-2xl font-bold text-foreground">{member.name || member.email || 'Працівник'}</h1>
        <dl className="mt-5 grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
          <div className="min-w-0"><dt className="font-semibold text-muted">Email</dt><dd className="mt-1 break-all text-foreground">{member.email ?? '—'}</dd></div>
          <div><dt className="font-semibold text-muted">Роль</dt><dd className="mt-1 text-foreground">{TEAM_ROLE_LABELS[member.role]}</dd></div>
          <div><dt className="font-semibold text-muted">Статус</dt><dd className="mt-1 text-foreground">{TEAM_STATUS_LABELS[member.status]}</dd></div>
          <div><dt className="font-semibold text-muted">Створено</dt><dd className="mt-1 text-foreground">{member.createdAt.toLocaleDateString('uk-UA')}</dd></div>
        </dl>
      </header>

      <section aria-label="Статистика журналу" className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
        {[
          ['Усього дій', String(summary.totalCount)],
          ['Стандартні', String(summary.standard)],
          ['Фінансові критичні', String(summary.financialCritical)],
          ['Критичні перегляди', String(summary.criticalRead)],
          ['Остання активність', latest]
        ].map(([label, value]) => (
          <div key={label} className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-card">
            <p className="text-sm font-semibold text-muted">{label}</p>
            <p className={`mt-3 break-words font-bold text-foreground ${label === 'Остання активність' ? 'text-base' : 'text-3xl'}`}>{value}</p>
          </div>
        ))}
      </section>

      <AuditLogFiltersForm
        filters={filters}
        actorOptions={[]}
        basePath={basePath}
        hideActor
      />

      <section aria-labelledby="manager-events-title" className="cabinet-stack">
        <div>
          <h2 id="manager-events-title" className="text-xl font-bold text-foreground">Події працівника</h2>
          <p className="mt-1 text-sm text-muted">Показано {page.records.length} із {page.totalCount}</p>
        </div>

        {page.records.length ? (
          <>
            <AuditLogList records={page.records} />
            <AuditLogPagination
              filters={filters}
              page={page.page}
              totalPages={page.totalPages}
              totalCount={page.totalCount}
              basePath={basePath}
            />
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center">
            <p className="text-sm font-semibold text-muted">
              {hasAuditLogFilters(filters)
                ? 'За вибраними фільтрами подій не знайдено.'
                : 'Для цього працівника поки немає записів у журналі дій.'}
            </p>
            <p className="mx-auto mt-2 max-w-2xl text-xs leading-5 text-muted">
              Журнал показує лише події, які система почала фіксувати після впровадження відповідного audit coverage.
            </p>
            {hasAuditLogFilters(filters) ? (
              <Link href={basePath} className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md border border-border px-4 text-sm font-bold text-foreground transition hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                Скинути фільтри
              </Link>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
