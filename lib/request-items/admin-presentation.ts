import type { RequestSelectionResendItemState } from '@/lib/request-selection/resend-eligibility';

export type AdminRequestItemPresentation = {
  clientStatus: { label: string; className: string };
  locked: boolean;
};

const clientStatusByState: Record<
  RequestSelectionResendItemState,
  AdminRequestItemPresentation['clientStatus']
> = {
  NOT_SENT: { label: 'Чернетка', className: 'bg-surface-muted text-muted' },
  UNCHANGED: {
    label: 'Очікує рішення клієнта',
    className: 'bg-[#FFF7E0] text-[#8A5B24]'
  },
  CHANGED_AFTER_SEND: {
    label: 'Очікує рішення клієнта',
    className: 'bg-[#FFF7E0] text-[#8A5B24]'
  },
  NEW_AFTER_SEND: { label: 'Чернетка', className: 'bg-surface-muted text-muted' },
  LOCKED_APPROVED: { label: 'Погоджено', className: 'bg-[#E7F6EC] text-success' },
  UNCHANGED_REJECTED: {
    label: 'Не погоджено',
    className: 'bg-red-50 text-red-700'
  },
  CHANGED_REJECTED: {
    label: 'Не погоджено',
    className: 'bg-red-50 text-red-700'
  },
  NEW_FOLLOW_UP: { label: 'Чернетка', className: 'bg-surface-muted text-muted' }
};

export function getAdminRequestItemPresentation(input: {
  state: RequestSelectionResendItemState;
  selection?: {
    batchStatus: 'DRAFT' | 'SENT' | 'APPROVED' | 'PARTIALLY_APPROVED' | 'REJECTED' | 'SUPERSEDED';
    itemStatus: 'PENDING' | 'APPROVED' | 'REJECTED';
  } | null;
}): AdminRequestItemPresentation {
  const finalized =
    input.selection?.batchStatus === 'APPROVED'
    || input.selection?.batchStatus === 'PARTIALLY_APPROVED'
    || input.selection?.batchStatus === 'REJECTED';

  let clientStatus = clientStatusByState[input.state];
  if (
    input.selection?.batchStatus === 'SENT'
    && input.selection.itemStatus === 'PENDING'
  ) {
    clientStatus = {
      label: 'Очікує рішення клієнта',
      className: 'bg-[#FFF7E0] text-[#8A5B24]'
    };
  } else if (finalized && input.selection?.itemStatus === 'APPROVED') {
    clientStatus = {
      label: 'Погоджено',
      className: 'bg-[#E7F6EC] text-success'
    };
  } else if (finalized && input.selection?.itemStatus === 'REJECTED') {
    clientStatus = {
      label: 'Не погоджено',
      className: 'bg-red-50 text-red-700'
    };
  } else if (finalized && input.selection?.itemStatus === 'PENDING') {
    clientStatus = {
      label: 'Очікує рішення клієнта',
      className: 'bg-[#FFF7E0] text-[#8A5B24]'
    };
  }

  return {
    clientStatus,
    locked: finalized || input.state === 'LOCKED_APPROVED'
  };
}
