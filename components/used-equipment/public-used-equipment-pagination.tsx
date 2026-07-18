import Link from 'next/link';

function pageHref(page: number) {
  return page <= 1 ? '/used-equipment' : `/used-equipment?page=${page}`;
}

export function PublicUsedEquipmentPagination({
  page,
  totalPages,
  totalCount
}: {
  page: number;
  totalPages: number;
  totalCount: number;
}) {
  if (totalCount === 0 || totalPages <= 1) {
    return null;
  }

  const previousDisabled = page <= 1;
  const nextDisabled = page >= totalPages;

  return (
    <nav
      aria-label="Пагінація каталогу БВ техніки"
      className="mt-8 flex flex-col gap-3 rounded-lg border border-public-border bg-card p-3 text-sm shadow-card sm:flex-row sm:items-center sm:justify-between"
    >
      <p className="text-center font-semibold text-public-muted sm:text-left">
        Сторінка {page} із {totalPages}
      </p>
      <div className="grid grid-cols-2 gap-2 sm:flex">
        {previousDisabled ? (
          <span className="inline-flex h-10 items-center justify-center rounded-md border border-public-border px-4 font-semibold text-public-subtle opacity-60">
            Назад
          </span>
        ) : (
          <Link
            href={pageHref(page - 1)}
            className="inline-flex h-10 items-center justify-center rounded-md border border-public-border px-4 font-semibold text-public-primary transition hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Назад
          </Link>
        )}
        {nextDisabled ? (
          <span className="inline-flex h-10 items-center justify-center rounded-md border border-public-border px-4 font-semibold text-public-subtle opacity-60">
            Далі
          </span>
        ) : (
          <Link
            href={pageHref(page + 1)}
            className="inline-flex h-10 items-center justify-center rounded-md border border-public-border px-4 font-semibold text-public-primary transition hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Далі
          </Link>
        )}
      </div>
    </nav>
  );
}
