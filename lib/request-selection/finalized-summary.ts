export type FinalizedSelectionStatus =
  | 'APPROVED'
  | 'PARTIALLY_APPROVED'
  | 'REJECTED';

type FinalizedSelectionItem = {
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
};

export type FinalizedSelectionSummary = {
  status: FinalizedSelectionStatus;
  revision: number;
  totalCount: number;
  approvedCount: number;
  rejectedCount: number;
  completedAt: Date | string | null;
  headline: string;
  detail: string;
};

function approvedPositionLabel(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'позицію';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) {
    return 'позиції';
  }
  return 'позицій';
}

export function buildFinalizedSelectionSummary(input: {
  status: FinalizedSelectionStatus;
  revision: number;
  approvedAt?: Date | string | null;
  rejectedAt?: Date | string | null;
  items: readonly FinalizedSelectionItem[];
}): FinalizedSelectionSummary {
  const totalCount = input.items.length;
  const approvedCount = input.items.filter(
    (item) => item.status === 'APPROVED'
  ).length;
  const rejectedCount = input.items.filter(
    (item) => item.status === 'REJECTED'
  ).length;

  if (input.status === 'APPROVED') {
    return {
      status: input.status,
      revision: input.revision,
      totalCount,
      approvedCount,
      rejectedCount,
      completedAt: input.approvedAt ?? null,
      headline: totalCount === 1
        ? 'Погоджено 1 позицію'
        : `Погоджено всі ${totalCount} ${approvedPositionLabel(totalCount)}`,
      detail: 'Клієнт завершив погодження. Заявка очікує формування рахунку.'
    };
  }

  if (input.status === 'REJECTED') {
    return {
      status: input.status,
      revision: input.revision,
      totalCount,
      approvedCount,
      rejectedCount,
      completedAt: input.rejectedAt ?? null,
      headline: 'Клієнт не погодив жодної позиції',
      detail: 'Заявку завершено без формування рахунку.'
    };
  }

  return {
    status: input.status,
    revision: input.revision,
    totalCount,
    approvedCount,
    rejectedCount,
    completedAt: input.approvedAt ?? null,
    headline: 'Клієнт завершив погодження',
    detail: 'Рахунок буде сформовано лише з погоджених позицій.'
  };
}
