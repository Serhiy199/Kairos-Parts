import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminDbBlocker } from '@/components/admin/admin-db-blocker';
import { AuditBeforeAfter, AuditMetadata } from '@/components/admin/audit-log/audit-event-values';
import { requireAdminSession } from '@/lib/admin/access';
import {
  AUDIT_ENTITY_LABELS,
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
import { getAuditLogEvent } from '@/lib/audit-log/query';
import { hasDatabaseUrl } from '@/lib/env/database';

export const dynamic = 'force-dynamic';

function DetailItem({ label, children, mono = false }: { label: string; children: React.ReactNode; mono?: boolean }) {
  return (
    <div className="min-w-0 rounded-md bg-surface-muted p-4">
      <dt className="text-xs font-bold uppercase text-muted">{label}</dt>
      <dd className={`mt-1 whitespace-pre-wrap break-words text-sm text-foreground ${mono ? 'font-mono text-xs' : ''}`}>{children}</dd>
    </div>
  );
}

export default async function AuditLogEventPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminSession();

  if (!hasDatabaseUrl()) return <AdminDbBlocker />;

  const { id } = await params;
  const event = await getAuditLogEvent(id);
  if (!event) notFound();

  const date = formatAuditDateTime(event.createdAt);
  const entityHref = auditEntityHref(event);
  const expired = event.expiresAt.getTime() <= Date.now();

  return (
    <div className="cabinet-stack">
      <header className="cabinet-card">
        <Link href="/admin/audit-log" className="text-sm font-semibold text-muted transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
          ← До журналу дій
        </Link>
        <p className="mt-5 text-sm font-bold uppercase text-accent">{auditCategoryLabel(event.category)}</p>
        <h1 className="mt-2 break-words text-2xl font-bold text-foreground">
          {auditActionLabel(event.action, event.metadata)}
        </h1>
        <p className="mt-2 text-sm text-muted">{date.full}</p>
      </header>

      <section className="cabinet-card">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="text-xl font-bold text-foreground">Основна інформація</h2>
          {entityHref ? (
            <Link href={entityHref} className="inline-flex min-h-11 items-center justify-center rounded-md border border-accent px-4 text-sm font-bold text-foreground transition hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
              Відкрити пов’язаний об’єкт
            </Link>
          ) : null}
        </div>
        <dl className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          <DetailItem label="Дата і час">{date.full}</DetailItem>
          <DetailItem label="Виконавець">{auditActorLabel(event)}</DetailItem>
          <DetailItem label="Email">{auditActorEmail(event) ?? '—'}</DetailItem>
          <DetailItem label="Роль">{auditActorRole(event)}</DetailItem>
          <DetailItem label="Поточний статус">{auditActorStatus(event) ?? 'Snapshot / системна дія'}</DetailItem>
          <DetailItem label="Категорія">{auditCategoryLabel(event.category)}</DetailItem>
          <DetailItem label="Machine action" mono>{event.action}</DetailItem>
          <DetailItem label="Тип об’єкта">{AUDIT_ENTITY_LABELS[event.entityType] ?? event.entityType}</DetailItem>
          <DetailItem label="Об’єкт">{auditEntityLabel(event)}</DetailItem>
          <DetailItem label="Entity ID" mono>{event.entityId}</DetailItem>
          <DetailItem label="Компанія">{event.company?.name ?? '—'}</DetailItem>
          <DetailItem label="IP-адреса" mono>{event.ipAddress ?? '—'}</DetailItem>
          <DetailItem label="User Agent" mono>{event.userAgent ?? '—'}</DetailItem>
          <DetailItem label="Строк зберігання">
            {expired ? 'Строк зберігання завершився' : `Зберігається до: ${event.expiresAt.toLocaleDateString('uk-UA')}`}
          </DetailItem>
          <DetailItem label="Audit event ID" mono>{event.id}</DetailItem>
        </dl>
      </section>

      <AuditBeforeAfter oldValue={event.oldValue} newValue={event.newValue} />
      <AuditMetadata metadata={event.metadata} />
    </div>
  );
}
