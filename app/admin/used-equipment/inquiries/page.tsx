import type { UsedEquipmentInquiryStatus } from '@prisma/client';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FaEye, FaTractor } from 'react-icons/fa';
import { TbPhotoOff } from 'react-icons/tb';

import { AdminDbBlocker } from '@/components/admin/admin-db-blocker';
import { requireCrmSession } from '@/lib/admin/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { getAdminUsedEquipmentInquiryPage, parseUsedEquipmentPage } from '@/lib/used-equipment/queries';
import { getUsedEquipmentInquirySourceLabel, getUsedEquipmentInquiryStatusLabel } from '@/lib/used-equipment/status';

export const dynamic = 'force-dynamic';

type SearchParams = {
  page?: string | string[];
};

type InquiryListItem = Awaited<ReturnType<typeof getAdminUsedEquipmentInquiryPage>>['items'][number];

const statusTone: Record<UsedEquipmentInquiryStatus, string> = {
  NEW: 'border-accent/30 bg-accent/10 text-[#8A5B24]',
  IN_PROGRESS: 'border-blue-200 bg-blue-50 text-blue-700',
  COMPLETED: 'border-success/20 bg-[#E7F6EC] text-success',
  CANCELLED: 'border-border bg-surface-muted text-muted'
};

function dateLabel(value: Date) {
  return value.toLocaleString('uk-UA');
}

function pageHref(page: number) {
  return page <= 1 ? '/admin/used-equipment/inquiries' : `/admin/used-equipment/inquiries?page=${page}`;
}

function assigneeLabel(assignee: InquiryListItem['assignedManager']) {
  return assignee?.name || assignee?.email || 'Не призначено';
}

function InquiryStatusBadge({ status }: { status: UsedEquipmentInquiryStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusTone[status]}`}>
      {getUsedEquipmentInquiryStatusLabel(status)}
    </span>
  );
}

function ModuleNav() {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/admin/used-equipment/items"
        className="rounded-md border border-border bg-card px-4 py-2 text-sm font-bold text-foreground transition hover:border-accent hover:text-accent"
      >
        Техніка
      </Link>
      <Link href="/admin/used-equipment/inquiries" className="rounded-md bg-accent px-4 py-2 text-sm font-bold text-foreground">
        Заявки на перегляд
      </Link>
    </div>
  );
}

function Thumbnail({ item }: { item: InquiryListItem }) {
  const image = item.usedEquipment.images[0];

  if (!image) {
    return (
      <div className="flex h-16 w-24 shrink-0 items-center justify-center rounded-md border border-dashed border-border bg-surface-muted text-muted">
        <TbPhotoOff aria-hidden="true" className="size-6" />
        <span className="sr-only">Фото відсутнє</span>
      </div>
    );
  }

  return (
    <Image
      src={image.url}
      alt={image.alt ?? item.equipmentTitle}
      width={image.width ?? 96}
      height={image.height ?? 64}
      sizes="96px"
      unoptimized
      className="h-16 w-24 shrink-0 rounded-md object-cover"
    />
  );
}

function Pagination({ page, totalPages, totalCount }: { page: number; totalPages: number; totalCount: number }) {
  if (totalCount === 0) {
    return null;
  }

  const previousDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  return (
    <div className="flex flex-col gap-3 border-t border-border px-4 py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p className="font-semibold text-muted">
        Сторінка {page} із {totalPages}
      </p>
      <div className="flex gap-2">
        {previousDisabled ? (
          <span className="rounded-md border border-border px-4 py-2 font-semibold text-muted opacity-60">Назад</span>
        ) : (
          <Link href={pageHref(page - 1)} className="rounded-md border border-border px-4 py-2 font-semibold text-foreground transition hover:border-accent">
            Назад
          </Link>
        )}
        {nextDisabled ? (
          <span className="rounded-md border border-border px-4 py-2 font-semibold text-muted opacity-60">Далі</span>
        ) : (
          <Link href={pageHref(page + 1)} className="rounded-md border border-border px-4 py-2 font-semibold text-foreground transition hover:border-accent">
            Далі
          </Link>
        )}
      </div>
    </div>
  );
}

function EmptyState() {
  return (
    <section className="rounded-lg border border-dashed border-border bg-card p-8 text-center shadow-card">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent/10 text-accent">
        <FaTractor aria-hidden="true" className="size-7" />
      </div>
      <h2 className="mt-4 text-xl font-bold text-foreground">Заявок на перегляд ще немає</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">
        Нові звернення з публічного майданчика з’являться тут автоматично.
      </p>
    </section>
  );
}

export default async function AdminUsedEquipmentInquiriesPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  await requireCrmSession();
  const params = await searchParams;

  if (!hasDatabaseUrl()) {
    return <AdminDbBlocker />;
  }

  const requestedPage = parseUsedEquipmentPage(params.page);
  const data = await getAdminUsedEquipmentInquiryPage({ page: requestedPage });

  if (data.requestedPage !== data.page) {
    redirect(pageHref(data.page));
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-border bg-card p-6 shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase text-accent">Майданчик БВ техніки</p>
            <h2 className="mt-2 text-2xl font-bold text-foreground">Заявки на перегляд техніки</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              Переглядайте та обробляйте звернення клієнтів щодо БВ техніки.
            </p>
          </div>
          <ModuleNav />
        </div>
      </section>

      {data.items.length === 0 ? (
        <EmptyState />
      ) : (
        <section className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
          <div className="hidden overflow-x-auto xl:block">
            <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-muted">
                  <th className="px-4 py-3 font-bold">Техніка</th>
                  <th className="px-4 py-3 font-bold">Клієнт</th>
                  <th className="px-4 py-3 font-bold">Телефон</th>
                  <th className="px-4 py-3 font-bold">Статус</th>
                  <th className="px-4 py-3 font-bold">Джерело</th>
                  <th className="px-4 py-3 font-bold">Відповідальний</th>
                  <th className="px-4 py-3 font-bold">Дата</th>
                  <th className="px-4 py-3 font-bold">Дія</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => {
                  const currentTitleChanged = item.usedEquipment.title !== item.equipmentTitle;

                  return (
                    <tr key={item.id} className="border-b border-border align-top last:border-0">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <Thumbnail item={item} />
                          <div className="min-w-0">
                            <p className="font-bold text-foreground">{item.equipmentTitle}</p>
                            {currentTitleChanged ? (
                              <p className="mt-1 text-xs text-muted">Поточна картка: {item.usedEquipment.title}</p>
                            ) : null}
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 font-semibold text-foreground">{item.name}</td>
                      <td className="px-4 py-3 text-muted">{item.phone}</td>
                      <td className="px-4 py-3">
                        <InquiryStatusBadge status={item.status} />
                      </td>
                      <td className="px-4 py-3 text-muted">{getUsedEquipmentInquirySourceLabel(item.source)}</td>
                      <td className="px-4 py-3 text-muted">{assigneeLabel(item.assignedManager)}</td>
                      <td className="whitespace-nowrap px-4 py-3 text-muted">{dateLabel(item.createdAt)}</td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/admin/used-equipment/inquiries/${item.id}`}
                          className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-bold text-foreground transition hover:border-accent hover:text-accent"
                        >
                          <FaEye aria-hidden="true" className="size-3" />
                          Відкрити
                        </Link>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 p-4 sm:p-5 xl:hidden">
            {data.items.map((item) => {
              const currentTitleChanged = item.usedEquipment.title !== item.equipmentTitle;

              return (
                <article key={item.id} className="rounded-lg border border-border p-4">
                  <div className="flex gap-3">
                    <Thumbnail item={item} />
                    <div className="min-w-0">
                      <h3 className="font-bold text-foreground">{item.equipmentTitle}</h3>
                      {currentTitleChanged ? <p className="mt-1 text-xs text-muted">Поточна картка: {item.usedEquipment.title}</p> : null}
                    </div>
                  </div>
                  <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                    <div>
                      <dt className="text-xs font-bold uppercase text-muted">Клієнт</dt>
                      <dd className="mt-1 font-semibold text-foreground">{item.name}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold uppercase text-muted">Телефон</dt>
                      <dd className="mt-1 break-all font-semibold text-foreground">{item.phone}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold uppercase text-muted">Статус</dt>
                      <dd className="mt-1">
                        <InquiryStatusBadge status={item.status} />
                      </dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold uppercase text-muted">Дата</dt>
                      <dd className="mt-1 font-semibold text-foreground">{dateLabel(item.createdAt)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold uppercase text-muted">Джерело</dt>
                      <dd className="mt-1 font-semibold text-foreground">{getUsedEquipmentInquirySourceLabel(item.source)}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-bold uppercase text-muted">Відповідальний</dt>
                      <dd className="mt-1 font-semibold text-foreground">{assigneeLabel(item.assignedManager)}</dd>
                    </div>
                  </dl>
                  <Link
                    href={`/admin/used-equipment/inquiries/${item.id}`}
                    className="mt-4 inline-flex items-center justify-center gap-2 rounded-md border border-border px-4 py-2 text-sm font-bold text-foreground transition hover:border-accent hover:text-accent"
                  >
                    <FaEye aria-hidden="true" className="size-3" />
                    Відкрити
                  </Link>
                </article>
              );
            })}
          </div>

          <Pagination page={data.page} totalPages={data.totalPages} totalCount={data.totalCount} />
        </section>
      )}
    </div>
  );
}
