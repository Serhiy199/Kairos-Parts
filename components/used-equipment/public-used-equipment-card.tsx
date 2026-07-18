import type { UsedEquipmentStatus } from '@prisma/client';
import Image from 'next/image';
import Link from 'next/link';
import { FaTractor } from 'react-icons/fa';

import { UsedEquipmentInquiryDialog } from '@/components/used-equipment/used-equipment-inquiry-dialog';
import { getUsedEquipmentDescriptionExcerpt } from '@/lib/used-equipment/description';
import type { PublicUsedEquipmentListItem } from '@/lib/used-equipment/queries';
import { getUsedEquipmentPublicStatusLabel } from '@/lib/used-equipment/status';
import { getEquipmentTypeLabel } from '@/lib/vehicles/equipment-types';

const statusTone: Record<UsedEquipmentStatus, string> = {
  DRAFT: 'border-public-border bg-public-elevated text-public-muted',
  PUBLISHED: 'border-emerald-400/25 bg-emerald-500/10 text-emerald-200',
  ARCHIVED: 'border-public-border bg-public-elevated text-public-muted'
};

function UsedEquipmentImage({ item, href }: { item: PublicUsedEquipmentListItem; href: string }) {
  const image = item.images[0];

  if (!image) {
    return (
      <Link
        href={href}
        className="flex aspect-[4/3] w-full items-center justify-center rounded-t-lg border-b border-dashed border-public-border bg-[linear-gradient(145deg,#151d29,#0b111a)] text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        aria-label={`Відкрити ${item.title}`}
      >
        <FaTractor aria-hidden="true" className="size-14 opacity-85" />
        <span className="sr-only">Фото тимчасово відсутнє</span>
      </Link>
    );
  }

  return (
    <Link
      href={href}
      className="relative block aspect-[4/3] w-full overflow-hidden rounded-t-lg bg-public-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      aria-label={`Відкрити ${item.title}`}
    >
      <Image
        src={image.url}
        alt={image.alt ?? `${item.title} - БВ техніка`}
        fill
        sizes="(min-width: 1280px) 31vw, (min-width: 768px) 45vw, 100vw"
        unoptimized
        className="object-cover transition duration-300 group-hover:scale-[1.025]"
      />
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-public-card/85 to-transparent" />
    </Link>
  );
}

export function PublicUsedEquipmentCard({ item }: { item: PublicUsedEquipmentListItem }) {
  const description = getUsedEquipmentDescriptionExcerpt(item.description);
  const equipmentTypeLabel = getEquipmentTypeLabel(item.equipmentType);
  const href = `/used-equipment/${item.slug}`;

  return (
    <article className="group flex h-full overflow-hidden rounded-lg border border-accent/25 bg-public-card shadow-[0_18px_44px_rgba(0,0,0,0.28)] transition duration-200 hover:-translate-y-1 hover:border-accent/60 hover:bg-public-elevated hover:shadow-[0_24px_54px_rgba(0,0,0,0.38)]">
      <div className="flex min-w-0 flex-1 flex-col">
        <UsedEquipmentImage item={item} href={href} />

        <div className="flex flex-1 flex-col p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusTone[item.status]}`}>
              {getUsedEquipmentPublicStatusLabel(item.status)}
            </span>
            <span className="rounded-full border border-accent/25 bg-primary/35 px-3 py-1 text-xs font-semibold text-public-secondary">{equipmentTypeLabel}</span>
          </div>

          <h2 className="mt-4 line-clamp-2 text-xl font-bold leading-tight text-public-primary">
            <Link
              href={href}
              className="transition hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {item.title}
            </Link>
          </h2>

          <div className="mt-3 grid gap-1 text-sm text-public-muted">
            <p>
              <span className="font-semibold text-public-secondary">Виробник:</span> {item.manufacturerName}
            </p>
            <p>
              <span className="font-semibold text-public-secondary">Рік:</span> {item.year ?? 'уточнюється'}
            </p>
          </div>

          {description ? <p className="mt-4 line-clamp-4 text-sm leading-6 text-public-muted">{description}</p> : null}

          <div className="mt-auto flex flex-col gap-2 pt-5 sm:flex-row">
            <Link
              href={href}
              className="inline-flex min-h-11 flex-1 items-center justify-center rounded-md border border-accent/55 bg-primary/25 px-4 text-center text-sm font-bold text-accent transition hover:border-accent hover:bg-accent/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Детальніше
            </Link>
            <UsedEquipmentInquiryDialog
              usedEquipmentId={item.id}
              equipmentTitle={item.title}
              source="CATALOG_CARD"
              trigger="Запит на перегляд техніки"
              triggerClassName="inline-flex min-h-11 flex-1 items-center justify-center rounded-md bg-accent px-4 text-center text-sm font-bold leading-tight text-primary transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
          </div>
        </div>
      </div>
    </article>
  );
}
