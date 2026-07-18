import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminDbBlocker } from '@/components/admin/admin-db-blocker';
import { requireCrmSession } from '@/lib/admin/access';
import {
  CONTACT_MESSAGE_STATUS_CLASSES,
  CONTACT_MESSAGE_STATUS_LABELS,
  CONTACT_MESSAGE_TOPIC_LABELS,
  getTelephoneHref,
  type ContactMessageStatusValue,
  type ContactMessageTopicValue
} from '@/lib/contact-messages';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';

import { ContactMessageStatusForm } from './status-form';

export const dynamic = 'force-dynamic';

function DetailItem({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="min-w-0 rounded-md border border-border p-4">
      <dt className="text-xs font-bold uppercase text-muted">{label}</dt>
      <dd className="mt-2 break-words text-sm font-semibold text-foreground">{children}</dd>
    </div>
  );
}

export default async function AdminContactMessageDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireCrmSession();

  if (!hasDatabaseUrl()) {
    return <AdminDbBlocker />;
  }

  const { id } = await params;
  const contactMessage = await prisma.contactMessage.findUnique({ where: { id } });

  if (!contactMessage) {
    notFound();
  }

  const status = contactMessage.status as ContactMessageStatusValue;
  const topic = contactMessage.topic as ContactMessageTopicValue;
  const telephoneHref = contactMessage.phone ? getTelephoneHref(contactMessage.phone) : null;

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-border bg-card p-4 shadow-card sm:p-6">
        <Link href="/admin/contact-messages" className="text-sm font-semibold text-muted transition hover:text-accent">
          ← Назад до звернень
        </Link>
        <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <p className="text-sm font-bold uppercase text-accent">Звернення з контактної форми</p>
            <h2 className="mt-2 break-words text-2xl font-bold text-foreground">{contactMessage.name}</h2>
            <p className="mt-2 text-sm text-muted">Отримано {contactMessage.createdAt.toLocaleString('uk-UA')}</p>
          </div>
          <span className={`inline-flex w-fit rounded-full px-3 py-1.5 text-sm font-bold ${CONTACT_MESSAGE_STATUS_CLASSES[status]}`}>
            {CONTACT_MESSAGE_STATUS_LABELS[status]}
          </span>
        </div>

        <dl className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <DetailItem label="Тема">{CONTACT_MESSAGE_TOPIC_LABELS[topic]}</DetailItem>
          <DetailItem label="Ім’я">{contactMessage.name}</DetailItem>
          {contactMessage.company ? <DetailItem label="Компанія">{contactMessage.company}</DetailItem> : null}
          {contactMessage.phone ? (
            <DetailItem label="Телефон">
              {telephoneHref ? <a href={telephoneHref} className="break-all transition hover:text-accent">{contactMessage.phone}</a> : contactMessage.phone}
            </DetailItem>
          ) : null}
          {contactMessage.email ? (
            <DetailItem label="Email">
              <a href={`mailto:${contactMessage.email}`} className="break-all transition hover:text-accent">{contactMessage.email}</a>
            </DetailItem>
          ) : null}
          <DetailItem label="Оновлено">{contactMessage.updatedAt.toLocaleString('uk-UA')}</DetailItem>
        </dl>
      </section>

      <section className="rounded-lg border border-border bg-card p-4 shadow-card sm:p-6">
        <p className="text-sm font-bold uppercase text-accent">Повідомлення</p>
        <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-7 text-foreground sm:text-base">
          {contactMessage.message}
        </p>
      </section>

      <section className="rounded-lg border border-border bg-card p-4 shadow-card sm:p-6">
        <h3 className="text-lg font-bold text-foreground">Змінити статус</h3>
        <p className="mt-2 text-sm leading-6 text-muted">Статус змінюється тільки після явного збереження менеджером або адміністратором.</p>
        <div className="mt-5">
          <ContactMessageStatusForm contactMessageId={contactMessage.id} currentStatus={status} />
        </div>
      </section>
    </div>
  );
}
