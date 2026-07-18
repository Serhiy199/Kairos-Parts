'use client';

import type { UsedEquipmentInquiryStatus } from '@prisma/client';
import { useActionState, useEffect, useId } from 'react';
import { useRouter } from 'next/navigation';

import { updateUsedEquipmentInquiry, type UsedEquipmentInquiryUpdateState } from '@/app/admin/used-equipment/inquiries/actions';
import { USED_EQUIPMENT_INQUIRY_UPDATE_STATUSES } from '@/lib/used-equipment/inquiry-validation';
import { getUsedEquipmentInquiryStatusLabel } from '@/lib/used-equipment/status';

type AssigneeOption = {
  id: string;
  name: string | null;
  email: string | null;
  role: string;
};

type AdminUsedEquipmentInquiryFormProps = {
  inquiryId: string;
  status: UsedEquipmentInquiryStatus;
  assignedManagerId: string | null;
  internalComment: string | null;
  assignees: AssigneeOption[];
};

const INITIAL_STATE: UsedEquipmentInquiryUpdateState = {
  status: 'idle'
};

function fieldClass(error?: string) {
  return `rounded-md border bg-card px-3 text-sm font-semibold text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:bg-surface-muted disabled:text-muted ${
    error ? 'border-danger/50' : 'border-border'
  }`;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="text-xs font-semibold text-danger">
      {message}
    </p>
  ) : null;
}

function assigneeLabel(assignee: AssigneeOption) {
  return `${assignee.name || assignee.email || 'Користувач'} (${assignee.role})`;
}

export function AdminUsedEquipmentInquiryForm({
  inquiryId,
  status,
  assignedManagerId,
  internalComment,
  assignees
}: AdminUsedEquipmentInquiryFormProps) {
  const router = useRouter();
  const [state, formAction, isPending] = useActionState(updateUsedEquipmentInquiry, INITIAL_STATE);
  const statusErrorId = useId();
  const assigneeErrorId = useId();
  const commentErrorId = useId();
  const messageId = useId();
  const selectedStatus = (state.values?.status as UsedEquipmentInquiryStatus | undefined) ?? status;
  const selectedAssigneeId = state.values?.assignedManagerId ?? assignedManagerId ?? '';
  const selectedComment = state.values?.internalComment ?? internalComment ?? '';

  useEffect(() => {
    if (state.status === 'success') {
      router.refresh();
    }
  }, [router, state.status]);

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="inquiryId" value={inquiryId} />

      {state.message ? (
        <div
          id={messageId}
          aria-live="polite"
          className={`rounded-md border px-4 py-3 text-sm font-semibold ${
            state.status === 'success' ? 'border-success/25 bg-[#E7F6EC] text-success' : 'border-danger/30 bg-danger/10 text-danger'
          }`}
        >
          {state.message}
        </div>
      ) : null}

      <label className="grid gap-2 text-sm font-semibold text-foreground">
        Статус
        <select
          name="status"
          defaultValue={selectedStatus}
          aria-invalid={Boolean(state.fieldErrors?.status)}
          aria-describedby={state.fieldErrors?.status ? statusErrorId : undefined}
          className={`${fieldClass(state.fieldErrors?.status)} h-11`}
        >
          {USED_EQUIPMENT_INQUIRY_UPDATE_STATUSES.map((value) => (
            <option key={value} value={value}>
              {getUsedEquipmentInquiryStatusLabel(value)}
            </option>
          ))}
        </select>
        <FieldError id={statusErrorId} message={state.fieldErrors?.status} />
      </label>

      <label className="grid gap-2 text-sm font-semibold text-foreground">
        Відповідальний менеджер
        <select
          name="assignedManagerId"
          defaultValue={selectedAssigneeId}
          aria-invalid={Boolean(state.fieldErrors?.assignedManagerId)}
          aria-describedby={state.fieldErrors?.assignedManagerId ? assigneeErrorId : undefined}
          className={`${fieldClass(state.fieldErrors?.assignedManagerId)} h-11`}
        >
          <option value="">Не призначено</option>
          {assignees.map((assignee) => (
            <option key={assignee.id} value={assignee.id}>
              {assigneeLabel(assignee)}
            </option>
          ))}
        </select>
        <FieldError id={assigneeErrorId} message={state.fieldErrors?.assignedManagerId} />
      </label>

      <label className="grid gap-2 text-sm font-semibold text-foreground">
        Внутрішній коментар
        <textarea
          name="internalComment"
          defaultValue={selectedComment}
          rows={8}
          aria-invalid={Boolean(state.fieldErrors?.internalComment)}
          aria-describedby={state.fieldErrors?.internalComment ? commentErrorId : undefined}
          className={`${fieldClass(state.fieldErrors?.internalComment)} min-h-36 py-3`}
        />
        <span className="text-xs font-normal leading-5 text-muted">Внутрішня примітка для менеджерів та адміністраторів.</span>
        <FieldError id={commentErrorId} message={state.fieldErrors?.internalComment} />
      </label>

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-11 items-center justify-center rounded-md bg-accent px-5 text-sm font-bold text-foreground transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? 'Збереження...' : 'Зберегти зміни'}
      </button>
    </form>
  );
}
