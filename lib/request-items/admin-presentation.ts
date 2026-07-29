import type { RequestSelectionResendItemState } from '@/lib/request-selection/resend-eligibility';

export type AdminRequestItemPresentation = {
  approval: { label: string; className: string };
  invoice: { label: string; className: string };
  locked: boolean;
  helper: string | null;
};

const approvalByState: Record<
  RequestSelectionResendItemState,
  AdminRequestItemPresentation['approval']
> = {
  NOT_SENT: { label: 'Чернетка', className: 'bg-surface-muted text-muted' },
  UNCHANGED: {
    label: 'Очікує рішення клієнта',
    className: 'bg-[#FFF7E0] text-[#8A5B24]'
  },
  CHANGED_AFTER_SEND: {
    label: 'Змінено після надсилання',
    className: 'bg-[#FFF7E0] text-[#8A5B24]'
  },
  NEW_AFTER_SEND: { label: 'Нова позиція', className: 'bg-accent/20 text-foreground' },
  LOCKED_APPROVED: { label: 'Погоджено', className: 'bg-[#E7F6EC] text-success' },
  UNCHANGED_REJECTED: {
    label: 'Відхилено — можна доопрацювати',
    className: 'bg-red-50 text-red-700'
  },
  CHANGED_REJECTED: {
    label: 'Змінено після відхилення',
    className: 'bg-[#FFF7E0] text-[#8A5B24]'
  },
  NEW_FOLLOW_UP: { label: 'Нова позиція', className: 'bg-accent/20 text-foreground' }
};

export function getAdminRequestItemPresentation(input: {
  state: RequestSelectionResendItemState;
  approvedBatchItemId: string | null;
  invoicedBatchItemIds: ReadonlySet<string>;
}): AdminRequestItemPresentation {
  const locked = input.state === 'LOCKED_APPROVED';
  const requiresApproval =
    input.state === 'CHANGED_AFTER_SEND'
    || input.state === 'CHANGED_REJECTED'
    || input.state === 'NEW_AFTER_SEND'
    || input.state === 'NEW_FOLLOW_UP';

  let invoice: AdminRequestItemPresentation['invoice'];
  if (locked && input.approvedBatchItemId) {
    invoice = input.invoicedBatchItemIds.has(input.approvedBatchItemId)
      ? { label: 'Внесено в рахунок', className: 'bg-[#E8F1FF] text-info' }
      : {
          label: 'Очікує на створення рахунку',
          className: 'bg-[#FFF7E0] text-[#8A5B24]'
        };
  } else if (requiresApproval) {
    invoice = {
      label: input.state === 'CHANGED_AFTER_SEND' || input.state === 'CHANGED_REJECTED'
        ? 'Потребує повторного погодження'
        : 'Потребує погодження',
      className: 'bg-[#FFF7E0] text-[#8A5B24]'
    };
  } else {
    invoice = {
      label: input.state === 'NOT_SENT' ? 'Не надіслано клієнту' : 'Не включено у рахунок',
      className: 'bg-surface-muted text-muted'
    };
  }

  return {
    approval: approvalByState[input.state],
    invoice,
    locked,
    helper: locked ? 'Погоджені дані позиції не можна змінити.' : null
  };
}
