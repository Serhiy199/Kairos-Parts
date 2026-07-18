import type { UsedEquipmentStatus } from '@prisma/client';
import Image from 'next/image';
import { FaTractor } from 'react-icons/fa';

import type { PublicUsedEquipmentListItem } from '@/lib/used-equipment/queries';
import { getUsedEquipmentDescriptionExcerpt } from '@/lib/used-equipment/description';
import { getUsedEquipmentPublicStatusLabel } from '@/lib/used-equipment/status';
import { getEquipmentTypeLabel } from '@/lib/vehicles/equipment-types';

const statusTone: Record<UsedEquipmentStatus, string> = {
  DRAFT: 'border-border bg-surface-muted text-muted',
  PUBLISHED: 'border-success/20 bg-[#E7F6EC] text-success',
  RESERVED: 'border-warning/25 bg-[#FFF7E0] text-[#8A5B24]',
  SOLD: 'border-border bg-surface-muted text-muted',
  ARCHIVED: 'border-border bg-surface-muted text-muted'
};

function UsedEquipmentImage({ item }: { item: PublicUsedEquipmentListItem }) {
  const image = item.images[0];

  if (!image) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center rounded-t-lg border-b border-dashed border-public-border bg-[linear-gradient(135deg,#f7f4ed,#ece7dd)] text-accent">
        <FaTractor aria-hidden="true" className="size-14 opacity-85" />
        <span className="sr-only">Фото тимчасово відсутнє</span>
      </div>
    );
  }

  return (
    <div className="relative aspect-[4/3] w-full overflow-hidden rounded-t-lg bg-surface-muted">
      <Image
        src={image.url}
        alt={image.alt ?? `${item.title} — БВ техніка`}
        fill
        sizes="(min-width: 1280px) 31vw, (min-width: 768px) 45vw, 100vw"
        unoptimized
        className="object-cover transition duration-300 group-hover:scale-[1.025]"
      />
    </div>
  );
}

export function PublicUsedEquipmentCard({ item }: { item: PublicUsedEquipmentListItem }) {
  const description = getUsedEquipmentDescriptionExcerpt(item.description);
  const equipmentTypeLabel = getEquipmentTypeLabel(item.equipmentType);

  return (
    <article className="group flex h-full overflow-hidden rounded-lg border border-public-border bg-card shadow-card transition hover:border-public-border-accent-hover hover:shadow-panel">
      <div className="flex min-w-0 flex-1 flex-col">
        <UsedEquipmentImage item={item} />

        <div className="flex flex-1 flex-col p-5">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${statusTone[item.status]}`}>
              {getUsedEquipmentPublicStatusLabel(item.status)}
            </span>
            <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-semibold text-muted">{equipmentTypeLabel}</span>
          </div>

          <h2 className="mt-4 line-clamp-2 text-xl font-bold leading-tight text-public-primary">{item.title}</h2>

          <div className="mt-3 grid gap-1 text-sm text-public-muted">
            <p>
              <span className="font-semibold text-public-secondary">Виробник:</span> {item.manufacturerName}
            </p>
            <p>
              <span className="font-semibold text-public-secondary">Рік:</span> {item.year ?? 'уточнюється'}
            </p>
          </div>

          {description ? <p className="mt-4 line-clamp-4 text-sm leading-6 text-public-muted">{description}</p> : null}
        </div>
      </div>
    </article>
  );
}
