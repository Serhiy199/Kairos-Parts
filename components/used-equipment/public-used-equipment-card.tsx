import Image from 'next/image';
import Link from 'next/link';
import { FaTractor } from 'react-icons/fa';

import { UsedEquipmentInquiryDialog } from '@/components/used-equipment/used-equipment-inquiry-dialog';
import type { PublicUsedEquipmentListItem } from '@/lib/used-equipment/queries';
import { getEquipmentTypeLabel } from '@/lib/vehicles/equipment-types';

function UsedEquipmentImage({ item }: { item: PublicUsedEquipmentListItem }) {
  const image = item.images[0];

  if (!image) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center border-b border-dashed border-public-border bg-[linear-gradient(145deg,#151d29,#0b111a)] text-accent">
        <FaTractor aria-hidden="true" className="size-14 opacity-85" />
        <span className="sr-only">Фото тимчасово відсутнє</span>
      </div>
    );
  }

  return (
    <div className="relative block aspect-[4/3] w-full overflow-hidden bg-public-elevated">
      <Image
        src={image.url}
        alt={image.alt ?? `${item.title} - БВ техніка`}
        fill
        sizes="(min-width: 1280px) 31vw, (min-width: 768px) 45vw, 100vw"
        unoptimized
        className="object-cover transition duration-300 group-hover:scale-[1.025]"
      />
      <span aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-public-card/85 to-transparent" />
    </div>
  );
}

export function PublicUsedEquipmentCard({ item }: { item: PublicUsedEquipmentListItem }) {
  const equipmentTypeLabel = getEquipmentTypeLabel(item.equipmentType);
  const href = `/used-equipment/${item.slug}`;

  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-lg border border-accent/25 bg-public-card shadow-[0_18px_44px_rgba(0,0,0,0.28)] transition duration-200 hover:-translate-y-1 hover:border-accent/60 hover:bg-public-elevated hover:shadow-[0_24px_54px_rgba(0,0,0,0.38)]">
      <Link
        href={href}
        aria-label={`Відкрити ${item.title}`}
        className="flex min-w-0 flex-1 cursor-pointer flex-col focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-accent"
      >
        <UsedEquipmentImage item={item} />

        <div className="flex flex-1 flex-col p-5">
          <h2 className="line-clamp-2 text-xl font-bold leading-tight text-public-primary transition group-hover:text-accent">{item.title}</h2>

          <div className="mt-4 grid gap-2 text-sm text-public-muted">
            <p>
              <span className="font-semibold text-public-subtle">Виробник:</span>{' '}
              <span className="font-semibold text-public-primary">{item.manufacturerName}</span>
            </p>
            <p>
              <span className="font-semibold text-public-subtle">Тип техніки:</span>{' '}
              <span className="font-semibold text-public-primary">{equipmentTypeLabel}</span>
            </p>
            {item.year ? (
              <p>
                <span className="font-semibold text-public-subtle">Рік:</span>{' '}
                <span className="font-semibold text-public-primary">{item.year}</span>
              </p>
            ) : null}
          </div>
        </div>
      </Link>

      <div className="border-t border-public-border p-5 pt-4">
        <UsedEquipmentInquiryDialog
          usedEquipmentId={item.id}
          equipmentTitle={item.title}
          source="CATALOG_CARD"
          trigger="Запит на перегляд техніки"
          triggerClassName="inline-flex min-h-11 w-full items-center justify-center rounded-md bg-accent px-4 text-center text-sm font-bold leading-tight text-primary transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        />
      </div>
    </article>
  );
}
