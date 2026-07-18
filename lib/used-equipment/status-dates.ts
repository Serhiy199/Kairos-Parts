import type { UsedEquipmentStatus } from '@prisma/client';

type PreviousStatusDates = {
  publishedAt: Date | null;
  reservedAt: Date | null;
  soldAt: Date | null;
  archivedAt: Date | null;
};

export function resolveUsedEquipmentStatusDates({
  nextStatus,
  previous
}: {
  nextStatus: UsedEquipmentStatus;
  previous?: PreviousStatusDates;
}) {
  const now = new Date();

  return {
    publishedAt: nextStatus === 'PUBLISHED' && !previous?.publishedAt ? now : previous?.publishedAt ?? null,
    reservedAt: nextStatus === 'RESERVED' ? previous?.reservedAt ?? now : null,
    soldAt: nextStatus === 'SOLD' ? previous?.soldAt ?? now : null,
    archivedAt: nextStatus === 'ARCHIVED' ? previous?.archivedAt ?? now : null
  };
}
