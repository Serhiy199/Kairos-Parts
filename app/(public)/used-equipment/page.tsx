import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { FaTractor } from 'react-icons/fa';

import { PublicUsedEquipmentCard } from '@/components/used-equipment/public-used-equipment-card';
import { PublicUsedEquipmentPagination } from '@/components/used-equipment/public-used-equipment-pagination';
import { hasDatabaseUrl } from '@/lib/env/database';
import { getPublicUsedEquipmentPage, parseUsedEquipmentPage } from '@/lib/used-equipment/queries';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'БВ техніка — Kairos Parts',
  description: 'Публічний каталог перевіреної вживаної аграрної, вантажної та спеціальної техніки Kairos Parts.'
};

type SearchParams = {
  page?: string | string[];
};

function pageHref(page: number) {
  return page <= 1 ? '/used-equipment' : `/used-equipment?page=${page}`;
}

function EmptyState() {
  return (
    <section className="rounded-lg border border-dashed border-public-border bg-card px-6 py-12 text-center shadow-card">
      <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-accent/10 text-accent">
        <FaTractor aria-hidden="true" className="size-7" />
      </div>
      <h2 className="mt-4 text-2xl font-bold text-public-primary">Доступної БВ техніки поки немає</h2>
      <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-public-muted">
        Каталог показує тільки перевірені публічні позиції. Коли менеджер опублікує техніку, вона з’явиться тут.
      </p>
    </section>
  );
}

function ErrorState() {
  return (
    <section className="rounded-lg border border-red-200 bg-red-50 px-6 py-8 text-red-800">
      <h2 className="text-xl font-bold">Каталог тимчасово недоступний</h2>
      <p className="mt-2 max-w-2xl text-sm leading-6">
        Не вдалося підключитися до бази даних. Спробуйте відкрити сторінку пізніше або зверніться до менеджера Kairos Parts.
      </p>
    </section>
  );
}

export default async function UsedEquipmentPage({
  searchParams
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  if (!hasDatabaseUrl()) {
    return (
      <div className="bg-public-page py-16">
        <div className="kp-container">
          <ErrorState />
        </div>
      </div>
    );
  }

  const requestedPage = parseUsedEquipmentPage(params.page);
  const data = await getPublicUsedEquipmentPage({ page: requestedPage });

  if (data.requestedPage !== data.page) {
    redirect(pageHref(data.page));
  }

  return (
    <div className="bg-public-page">
      <section className="border-b border-public-border bg-primary py-14 text-white sm:py-16">
        <div className="kp-container">
          <div className="max-w-4xl">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-accent sm:text-sm">Майданчик БВ техніки</p>
            <h1 className="mt-4 text-4xl font-bold leading-tight sm:text-5xl">Перевірена техніка для роботи</h1>
            <p className="mt-5 max-w-3xl text-base leading-7 text-sidebar-text sm:text-lg sm:leading-8">
              Переглядайте доступну вживану аграрну, вантажну та спеціальну техніку, яку менеджери Kairos Parts підготували до публічного показу.
            </p>
          </div>
        </div>
      </section>

      <section className="py-12 sm:py-14">
        <div className="kp-container">
          <div className="mb-8 max-w-3xl">
            <p className="text-sm font-bold uppercase text-accent">Каталог</p>
            <h2 className="mt-2 text-3xl font-bold text-public-primary">БВ техніка</h2>
            <p className="mt-2 text-sm leading-6 text-public-muted">
              У каталозі показуються тільки опубліковані позиції, доступні для перегляду клієнтами.
            </p>
          </div>

          {data.items.length === 0 ? (
            <EmptyState />
          ) : (
            <>
              <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                {data.items.map((item) => (
                  <PublicUsedEquipmentCard key={item.id} item={item} />
                ))}
              </div>
              <PublicUsedEquipmentPagination page={data.page} totalPages={data.totalPages} totalCount={data.totalCount} />
            </>
          )}
        </div>
      </section>
    </div>
  );
}
