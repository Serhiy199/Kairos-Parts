import Link from 'next/link';

import { AdminDbBlocker } from '@/components/admin/admin-db-blocker';
import { requireCrmSession } from '@/lib/admin/access';
import {
  CONTACT_MESSAGE_STATUS_CLASSES,
  CONTACT_MESSAGE_STATUS_LABELS,
  CONTACT_MESSAGE_TOPIC_LABELS,
  type ContactMessageStatusValue,
  type ContactMessageTopicValue
} from '@/lib/contact-messages';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

const CONTACT_MESSAGES_LIMIT = 100;

function ContactMessageStatusBadge({ status }: { status: ContactMessageStatusValue }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-bold ${CONTACT_MESSAGE_STATUS_CLASSES[status]}`}>
      {CONTACT_MESSAGE_STATUS_LABELS[status]}
    </span>
  );
}

export default async function AdminContactMessagesPage() {
  await requireCrmSession();

  if (!hasDatabaseUrl()) {
    return <AdminDbBlocker />;
  }

  const contactMessages = await prisma.contactMessage.findMany({
    take: CONTACT_MESSAGES_LIMIT,
    orderBy: { createdAt: 'desc' }
  });

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-card sm:p-6">
      <div>
        <p className="text-sm font-bold uppercase text-accent">Контактна форма</p>
        <h2 className="mt-2 text-2xl font-bold text-foreground">Звернення</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Останні повідомлення, які відвідувачі надіслали зі сторінки контактів.
        </p>
      </div>

      {contactMessages.length === 0 ? (
        <div className="mt-6 rounded-md border border-dashed border-border p-6">
          <h3 className="text-lg font-bold text-foreground">Звернень поки немає</h3>
          <p className="mt-2 text-sm leading-6 text-muted">Нові повідомлення з контактної форми з’являться тут.</p>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-3 md:hidden">
            {contactMessages.map((contactMessage) => (
              <article key={contactMessage.id} className="min-w-0 rounded-md border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-bold text-foreground">{contactMessage.name}</p>
                    {contactMessage.company ? <p className="mt-1 break-words text-sm text-muted">{contactMessage.company}</p> : null}
                  </div>
                  <ContactMessageStatusBadge status={contactMessage.status as ContactMessageStatusValue} />
                </div>
                <dl className="mt-4 grid gap-3 text-sm">
                  <div>
                    <dt className="font-semibold text-muted">Дата</dt>
                    <dd className="mt-1 text-foreground">{contactMessage.createdAt.toLocaleString('uk-UA')}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-muted">Тема</dt>
                    <dd className="mt-1 text-foreground">{CONTACT_MESSAGE_TOPIC_LABELS[contactMessage.topic as ContactMessageTopicValue]}</dd>
                  </div>
                  <div>
                    <dt className="font-semibold text-muted">Контакт</dt>
                    <dd className="mt-1 break-all text-foreground">{contactMessage.phone ?? contactMessage.email ?? '—'}</dd>
                  </div>
                </dl>
                <Link
                  href={`/admin/contact-messages/${contactMessage.id}`}
                  className="mt-4 inline-flex rounded-md border border-border px-4 py-2 text-sm font-bold text-foreground transition hover:border-accent hover:text-accent"
                >
                  Відкрити
                </Link>
              </article>
            ))}
          </div>

          <div className="mt-6 hidden max-w-full overflow-x-auto md:block">
            <table className="w-full min-w-[920px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-muted">
                  <th className="px-4 py-3 font-bold">Дата</th>
                  <th className="px-4 py-3 font-bold">Ім’я</th>
                  <th className="px-4 py-3 font-bold">Компанія</th>
                  <th className="px-4 py-3 font-bold">Тема</th>
                  <th className="px-4 py-3 font-bold">Контакт</th>
                  <th className="px-4 py-3 font-bold">Статус</th>
                  <th className="px-4 py-3 font-bold">Дія</th>
                </tr>
              </thead>
              <tbody>
                {contactMessages.map((contactMessage) => (
                  <tr key={contactMessage.id} className="border-b border-border align-top last:border-0">
                    <td className="whitespace-nowrap px-4 py-3 text-muted">{contactMessage.createdAt.toLocaleString('uk-UA')}</td>
                    <td className="px-4 py-3 font-semibold text-foreground">{contactMessage.name}</td>
                    <td className="max-w-48 break-words px-4 py-3 text-muted">{contactMessage.company ?? '—'}</td>
                    <td className="max-w-52 px-4 py-3 text-muted">{CONTACT_MESSAGE_TOPIC_LABELS[contactMessage.topic as ContactMessageTopicValue]}</td>
                    <td className="max-w-56 break-all px-4 py-3 text-muted">{contactMessage.phone ?? contactMessage.email ?? '—'}</td>
                    <td className="px-4 py-3"><ContactMessageStatusBadge status={contactMessage.status as ContactMessageStatusValue} /></td>
                    <td className="px-4 py-3">
                      <Link href={`/admin/contact-messages/${contactMessage.id}`} className="font-bold text-foreground transition hover:text-accent">
                        Відкрити
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
