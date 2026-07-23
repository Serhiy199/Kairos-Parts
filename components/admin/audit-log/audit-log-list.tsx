import type { Prisma } from '@prisma/client';
import Link from 'next/link';

import type { AuditLogFilters } from '@/lib/audit-log/filters';
import { auditLogQuery } from '@/lib/audit-log/filters';
import {
  auditActionLabel,
  auditActorEmail,
  auditActorLabel,
  auditActorRole,
  auditActorStatus,
  auditCategoryLabel,
  auditEntityHref,
  auditEntityLabel,
  formatAuditDateTime
} from '@/lib/audit-log/presentation';
import { auditLogInclude } from '@/lib/audit-log/service';

export type AuditLogRecord = Prisma.AuditLogGetPayload<{ include: typeof auditLogInclude }>;

const CATEGORY_TONES: Record<string, string> = {
  TECHNICAL: 'border-slate-200 bg-slate-50 text-slate-700',
  LOGIN: 'border-blue-200 bg-blue-50 text-blue-700',
  CRITICAL_READ: 'border-orange-200 bg-orange-50 text-orange-800',
  STANDARD: 'border-green-200 bg-green-50 text-green-700',
  FINANCIAL_CRITICAL: 'border-red-200 bg-red-50 text-red-700'
};

function CategoryBadge({ category }: { category: string }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-bold ${CATEGORY_TONES[category] ?? CATEGORY_TONES.TECHNICAL}`}>
      {auditCategoryLabel(category)}
    </span>
  );
}

function Actor({ record, compact = false }: { record: AuditLogRecord; compact?: boolean }) {
  const email = auditActorEmail(record);
  const status = auditActorStatus(record);

  return (
    <div className="min-w-0">
      <p className="break-words font-semibold text-foreground">{auditActorLabel(record)}</p>
      {!compact && email ? <p className="mt-1 break-all text-xs text-muted">{email}</p> : null}
      <p className="mt-1 text-xs text-muted">
        {auditActorRole(record)}
        {status ? ` · ${status}` : ''}
      </p>
    </div>
  );
}

function Entity({ record }: { record: AuditLogRecord }) {
  const href = auditEntityHref(record);
  const label = auditEntityLabel(record);

  return href ? (
    <Link href={href} className="break-words font-semibold text-foreground transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
      {label}
    </Link>
  ) : (
    <span className="break-words font-semibold text-foreground">{label}</span>
  );
}

export function AuditLogList({
  records,
  detailBasePath = '/admin/audit-log'
}: {
  records: AuditLogRecord[];
  detailBasePath?: string;
}) {
  return (
    <>
      <div className="grid gap-3 lg:hidden">
        {records.map((record) => {
          const date = formatAuditDateTime(record.createdAt);
          return (
            <article key={record.id} className="min-w-0 rounded-lg border border-border bg-card p-4 shadow-card">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <time dateTime={record.createdAt.toISOString()} className="text-sm font-semibold text-muted">
                  {date.date} · {date.time}
                </time>
                <CategoryBadge category={record.category} />
              </div>
              <h3 className="mt-4 break-words text-base font-bold text-foreground">
                {auditActionLabel(record.action, record.metadata)}
              </h3>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2">
                <div className="min-w-0">
                  <dt className="text-xs font-bold uppercase text-muted">Виконавець</dt>
                  <dd className="mt-1"><Actor record={record} /></dd>
                </div>
                <div className="min-w-0">
                  <dt className="text-xs font-bold uppercase text-muted">Об’єкт</dt>
                  <dd className="mt-1"><Entity record={record} /></dd>
                </div>
              </dl>
              <Link href={`${detailBasePath}/${record.id}`} className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border px-4 text-sm font-bold text-foreground transition hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:w-auto">
                Переглянути деталі
              </Link>
            </article>
          );
        })}
      </div>

      <div className="hidden overflow-hidden rounded-lg border border-border bg-card shadow-card lg:block">
        <table className="w-full table-fixed border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted text-muted">
              <th scope="col" className="w-32 px-3 py-3 font-bold xl:px-4">Дата</th>
              <th scope="col" className="w-[22%] px-3 py-3 font-bold xl:px-4">Виконавець</th>
              <th scope="col" className="w-[25%] px-3 py-3 font-bold xl:px-4">Дія</th>
              <th scope="col" className="w-40 px-3 py-3 font-bold xl:px-4">Категорія</th>
              <th scope="col" className="px-3 py-3 font-bold xl:px-4">Об’єкт</th>
              <th scope="col" className="w-28 px-3 py-3 text-right font-bold xl:px-4">Деталі</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => {
              const date = formatAuditDateTime(record.createdAt);
              return (
                <tr key={record.id} className="border-b border-border align-top last:border-0">
                  <td className="px-3 py-4 text-muted xl:px-4">
                    <time dateTime={record.createdAt.toISOString()}>
                      <span className="block">{date.date}</span>
                      <span className="mt-1 block text-xs">{date.time}</span>
                    </time>
                  </td>
                  <td className="min-w-0 px-3 py-4 xl:px-4"><Actor record={record} compact /></td>
                  <td className="min-w-0 px-3 py-4 font-semibold text-foreground xl:px-4">
                    <span className="line-clamp-3 break-words">{auditActionLabel(record.action, record.metadata)}</span>
                  </td>
                  <td className="px-3 py-4 xl:px-4"><CategoryBadge category={record.category} /></td>
                  <td className="min-w-0 px-3 py-4 xl:px-4"><Entity record={record} /></td>
                  <td className="px-3 py-4 text-right xl:px-4">
                    <Link href={`${detailBasePath}/${record.id}`} className="inline-flex min-h-10 items-center justify-center rounded-md border border-border px-3 text-xs font-bold text-foreground transition hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                      Переглянути
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function AuditLogPagination({
  filters,
  page,
  totalPages,
  totalCount,
  basePath
}: {
  filters: AuditLogFilters;
  page: number;
  totalPages: number;
  totalCount: number;
  basePath: string;
}) {
  if (totalCount === 0 || totalPages <= 1) return null;
  const previousHref = `${basePath}${auditLogQuery(filters, { page: Math.max(1, page - 1) })}`;
  const nextHref = `${basePath}${auditLogQuery(filters, { page: Math.min(totalPages, page + 1) })}`;
  const linkClass = 'inline-flex min-h-11 items-center justify-center rounded-md border border-border px-4 text-sm font-bold text-foreground transition hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

  return (
    <nav aria-label="Сторінки журналу дій" className="flex flex-col gap-3 rounded-lg border border-border bg-card p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-center text-sm font-semibold text-muted sm:text-left">
        Сторінка {page} із {totalPages} · усього {totalCount}
      </p>
      <div className="grid grid-cols-2 gap-2">
        {page > 1 ? <Link href={previousHref} rel="prev" className={linkClass}>Попередня</Link> : <span aria-disabled="true" className={`${linkClass} cursor-not-allowed opacity-50`}>Попередня</span>}
        {page < totalPages ? <Link href={nextHref} rel="next" className={linkClass}>Наступна</Link> : <span aria-disabled="true" className={`${linkClass} cursor-not-allowed opacity-50`}>Наступна</span>}
      </div>
    </nav>
  );
}
