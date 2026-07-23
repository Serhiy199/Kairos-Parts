import Link from 'next/link';

import { AdminDbBlocker } from '@/components/admin/admin-db-blocker';
import { AuditLogFiltersForm } from '@/components/admin/audit-log/audit-log-filters';
import { AuditLogList, AuditLogPagination } from '@/components/admin/audit-log/audit-log-list';
import { requireAdminSession } from '@/lib/admin/access';
import {
  hasAuditLogFilters,
  parseAuditLogFilters,
  type AuditLogSearchParams
} from '@/lib/audit-log/filters';
import { getAuditActorOptions, getAuditLogPage } from '@/lib/audit-log/query';
import { hasDatabaseUrl } from '@/lib/env/database';

export const dynamic = 'force-dynamic';

export default async function AdminAuditLogPage({
  searchParams
}: {
  searchParams: Promise<AuditLogSearchParams>;
}) {
  await requireAdminSession();

  if (!hasDatabaseUrl()) {
    return <AdminDbBlocker />;
  }

  const filters = parseAuditLogFilters(await searchParams);
  const [page, actorOptions] = await Promise.all([
    getAuditLogPage(filters),
    getAuditActorOptions()
  ]);

  return (
    <div className="cabinet-stack">
      <header className="cabinet-card">
        <p className="text-sm font-bold uppercase text-accent">Адміністрування</p>
        <h1 className="mt-2 text-2xl font-bold text-foreground">Журнал дій</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Історія критичних і стандартних дій у CRM. Записи доступні лише адміністраторам і не редагуються через CRM.
        </p>
      </header>

      <AuditLogFiltersForm
        filters={filters}
        actorOptions={actorOptions}
        basePath="/admin/audit-log"
      />

      <section aria-labelledby="audit-events-title" className="cabinet-stack">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 id="audit-events-title" className="text-xl font-bold text-foreground">Події</h2>
            <p className="mt-1 text-sm text-muted">
              Показано {page.records.length} із {page.totalCount}
            </p>
          </div>
        </div>

        {page.records.length ? (
          <>
            <AuditLogList records={page.records} />
            <AuditLogPagination
              filters={filters}
              page={page.page}
              totalPages={page.totalPages}
              totalCount={page.totalCount}
              basePath="/admin/audit-log"
            />
          </>
        ) : (
          <div className="rounded-lg border border-dashed border-border bg-card p-6 text-center">
            <p className="text-sm font-semibold text-muted">
              {hasAuditLogFilters(filters)
                ? 'За вибраними фільтрами подій не знайдено.'
                : 'Журнал дій ще порожній.'}
            </p>
            {hasAuditLogFilters(filters) ? (
              <Link href="/admin/audit-log" className="mt-4 inline-flex min-h-11 items-center justify-center rounded-md border border-border px-4 text-sm font-bold text-foreground transition hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                Скинути фільтри
              </Link>
            ) : null}
          </div>
        )}
      </section>
    </div>
  );
}
