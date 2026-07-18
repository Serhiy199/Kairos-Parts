import type { UsedEquipmentStatus } from '@prisma/client';
import Image from 'next/image';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { FaPen, FaPlus, FaTractor } from 'react-icons/fa';
import { TbPhotoOff } from 'react-icons/tb';

import { AdminDbBlocker } from '@/components/admin/admin-db-blocker';
import { requireCrmSession } from '@/lib/admin/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { getAdminUsedEquipmentPage, parseUsedEquipmentPage } from '@/lib/used-equipment/queries';
import { getUsedEquipmentStatusLabel } from '@/lib/used-equipment/status';

export const dynamic = 'force-dynamic';

type SearchParams = {
  page?: string | string[];
};

type UsedEquipmentListItem = Awaited<ReturnType<typeof getAdminUsedEquipmentPage>>['items'][number];

const statusTone: Record<UsedEquipmentStatus, string> = {
  DRAFT: 'border-border bg-surface-muted text-muted',
  PUBLISHED: 'border-success/20 bg-[#E7F6EC] text-success',
  ARCHIVED: 'border-border bg-muted/10 text-muted'
};

function dateLabel(value: Date | null) {
  return value ? value.toLocaleDateString('uk-UA') : '—';
}

function pageHref(page: number) {
  return page <= 1 ? '/admin/used-equipment/items' : `/admin/used-equipment/items?page=${page}`;
}

function StatusBadge({ status }: { status: UsedEquipmentStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusTone[status]}`}>
      {getUsedEquipmentStatusLabel(status)}
    </span>
  );
}

function Thumbnail({ item }: { item: UsedEquipmentListItem }) {
  const image = item.images[0];

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
      alt={image.alt ?? item.title}
      width={image.width ?? 96}
      height={image.height ?? 64}
      sizes="96px"
      unoptimized
      className="h-16 w-24 shrink-0 rounded-md object-cover"
    />
  );
}

function EditLink({ itemId }: { itemId: string }) {
  return (
    <Link
      href={`/admin/used-equipment/items/${itemId}/edit`}
      className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-bold text-foreground transition hover:border-accent hover:text-accent"
    >
      <FaPen aria-hidden="true" className="size-3" />
      Редагувати
    </Link>
  );
}

function ModuleNav() {
  return (
    <div className="flex flex-wrap gap-2">
      <Link href="/admin/used-equipment/items" className="rounded-md bg-accent px-4 py-2 text-sm font-bold text-foreground">
        Техніка
      </Link>
      <Link
        href="/admin/used-equipment/inquiries"
        className="rounded-md border border-border bg-card px-4 py-2 text-sm font-bold text-foreground transition hover:border-accent hover:text-accent"
      >
        Заявки на перегляд
      </Link>
    </div>
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
      <h2 className="mt-4 text-xl font-bold text-foreground">Техніка ще не додана</h2>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-muted">
        Додайте першу одиницю БВ техніки, щоб підготувати її до майбутньої публікації на майданчику.
      </p>
      <Link href="/admin/used-equipment/items/new" className="mt-5 inline-flex items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover">
        <FaPlus aria-hidden="true" className="size-3" />
        Додати техніку
      </Link>
    </section>
  );
}

export default async function AdminUsedEquipmentItemsPage({
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
  const data = await getAdminUsedEquipmentPage({ page: requestedPage });

  if (data.requestedPage !== data.page) {
    redirect(pageHref(data.page));
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-border bg-card p-6 shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-bold uppercase text-accent">Майданчик БВ техніки</p>
            <h2 className="mt-2 text-2xl font-bold text-foreground">БВ техніка</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
              Керуйте технікою, яка буде опублікована на публічному майданчику після наповнення фото й перевірки даних.
            </p>
          </div>
          <div className="grid gap-3 sm:justify-items-end">
            <ModuleNav />
            <Link href="/admin/used-equipment/items/new" className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-accent px-5 text-sm font-bold text-foreground transition hover:bg-accent-hover">
              <FaPlus aria-hidden="true" className="size-3" />
              Додати техніку
            </Link>
          </div>
        </div>
      </section>

      {data.items.length === 0 ? (
        <EmptyState />
      ) : (
        <section className="overflow-hidden rounded-lg border border-border bg-card shadow-card">
          <div className="hidden overflow-x-auto lg:block">
            <table className="w-full min-w-[1120px] border-collapse text-left text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted text-muted">
                  <th className="px-4 py-3 font-bold">Техніка</th>
                  <th className="px-4 py-3 font-bold">Тип</th>
                  <th className="px-4 py-3 font-bold">Виробник</th>
                  <th className="px-4 py-3 font-bold">Рік</th>
                  <th className="px-4 py-3 font-bold">Статус</th>
                  <th className="px-4 py-3 font-bold">Заявки</th>
                  <th className="px-4 py-3 font-bold">Створено</th>
                  <th className="px-4 py-3 font-bold">Оновлено</th>
                  <th className="px-4 py-3 font-bold">Дії</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((item) => (
                  <tr key={item.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Thumbnail item={item} />
                        <div>
                          <p className="font-bold text-foreground">{item.title}</p>
                          <p className="mt-1 text-xs text-muted">{item.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted">{item.equipmentType}</td>
                    <td className="px-4 py-3 text-muted">{item.manufacturerName}</td>
                    <td className="px-4 py-3 text-muted">{item.year ?? '—'}</td>
                    <td className="px-4 py-3">
                      <StatusBadge status={item.status} />
                    </td>
                    <td className="px-4 py-3 font-bold text-foreground">{item._count.inquiries}</td>
                    <td className="px-4 py-3 text-muted">{dateLabel(item.createdAt)}</td>
                    <td className="px-4 py-3 text-muted">{dateLabel(item.updatedAt)}</td>
                    <td className="px-4 py-3">
                      <EditLink itemId={item.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="grid gap-3 p-4 lg:hidden">
            {data.items.map((item) => (
              <article key={item.id} className="rounded-lg border border-border p-4">
                <div className="flex gap-3">
                  <Thumbnail item={item} />
                  <div className="min-w-0">
                    <h3 className="font-bold text-foreground">{item.title}</h3>
                    <p className="mt-1 text-sm text-muted">
                      {item.equipmentType} · {item.manufacturerName}
                    </p>
                  </div>
                </div>
                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <p className="text-xs font-bold uppercase text-muted">Рік</p>
                    <p className="mt-1 font-semibold text-foreground">{item.year ?? '—'}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-muted">Заявки</p>
                    <p className="mt-1 font-semibold text-foreground">{item._count.inquiries}</p>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-muted">Статус</p>
                    <div className="mt-1">
                      <StatusBadge status={item.status} />
                    </div>
                  </div>
                  <div>
                    <p className="text-xs font-bold uppercase text-muted">Створено</p>
                    <p className="mt-1 font-semibold text-foreground">{dateLabel(item.createdAt)}</p>
                  </div>
                </div>
                <div className="mt-4">
                  <EditLink itemId={item.id} />
                </div>
              </article>
            ))}
          </div>

          <Pagination page={data.page} totalPages={data.totalPages} totalCount={data.totalCount} />
        </section>
      )}
    </div>
  );
}
