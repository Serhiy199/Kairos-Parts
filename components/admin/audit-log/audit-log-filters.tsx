import type { UserRole, UserStatus } from '@prisma/client';
import Link from 'next/link';

import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '@/lib/audit-log/contracts';
import type { AuditLogFilters } from '@/lib/audit-log/filters';
import {
  AUDIT_ACTION_LABELS,
  AUDIT_CATEGORY_LABELS,
  AUDIT_ENTITY_LABELS
} from '@/lib/audit-log/presentation';

type ActorOption = {
  id: string;
  name: string | null;
  email: string | null;
  role: UserRole;
  status: UserStatus;
};

const fieldClass = 'mt-2 min-h-11 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent';

export function AuditLogFiltersForm({
  filters,
  actorOptions,
  basePath,
  hideActor = false
}: {
  filters: AuditLogFilters;
  actorOptions: ActorOption[];
  basePath: string;
  hideActor?: boolean;
}) {
  return (
    <form action={basePath} method="get" className="rounded-lg border border-border bg-card p-4 shadow-card sm:p-5">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <label className="text-sm font-bold text-foreground xl:col-span-2">
          Пошук
          <input
            name="search"
            defaultValue={filters.search}
            maxLength={120}
            placeholder="Виконавець, email, об’єкт або ID"
            className={fieldClass}
          />
        </label>

        {!hideActor ? (
          <label className="text-sm font-bold text-foreground">
            Виконавець
            <select name="actor" defaultValue={filters.actorId ?? ''} className={fieldClass}>
              <option value="">Усі виконавці</option>
              {actorOptions.map((actor) => (
                <option key={actor.id} value={actor.id}>
                  {actor.name || actor.email || 'Без імені'} · {actor.role === 'ADMIN' ? 'Адміністратор' : 'Менеджер'}
                  {actor.status === 'DISABLED' ? ' · вимкнений' : ''}
                </option>
              ))}
            </select>
          </label>
        ) : null}

        <label className="text-sm font-bold text-foreground">
          Категорія
          <select name="category" defaultValue={filters.category ?? ''} className={fieldClass}>
            <option value="">Усі категорії</option>
            {Object.entries(AUDIT_CATEGORY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>

        <label className="text-sm font-bold text-foreground">
          Тип об’єкта
          <select name="entity" defaultValue={filters.entityType ?? ''} className={fieldClass}>
            <option value="">Усі типи</option>
            {Object.values(AUDIT_ENTITY_TYPES).map((value) => (
              <option key={value} value={value}>{AUDIT_ENTITY_LABELS[value] ?? value}</option>
            ))}
          </select>
        </label>

        <label className="text-sm font-bold text-foreground xl:col-span-2">
          Дія
          <select name="action" defaultValue={filters.action ?? ''} className={fieldClass}>
            <option value="">Усі дії</option>
            {Object.values(AUDIT_ACTIONS).map((value) => (
              <option key={value} value={value}>{AUDIT_ACTION_LABELS[value] ?? value}</option>
            ))}
          </select>
        </label>

        <label className="text-sm font-bold text-foreground">
          Дата від
          <input name="from" type="date" defaultValue={filters.dateFrom} className={fieldClass} />
        </label>

        <label className="text-sm font-bold text-foreground">
          Дата до
          <input name="to" type="date" defaultValue={filters.dateTo} className={fieldClass} />
        </label>
      </div>

      <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md border border-border px-4 text-sm font-bold text-foreground focus-within:ring-2 focus-within:ring-accent">
          <input name="critical" value="1" type="checkbox" defaultChecked={filters.criticalOnly} className="size-4 accent-current" />
          Лише критичні дії
        </label>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Link href={basePath} className="inline-flex min-h-11 items-center justify-center rounded-md border border-border px-4 text-sm font-bold text-foreground transition hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            Скинути
          </Link>
          <button type="submit" className="min-h-11 rounded-md bg-accent px-5 text-sm font-bold text-foreground transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            Фільтрувати
          </button>
        </div>
      </div>
    </form>
  );
}
