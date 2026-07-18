'use client';

import { useActionState } from 'react';

import {
  updateContactMessageStatus,
  type ContactMessageStatusActionState
} from '../actions';
import {
  CONTACT_MESSAGE_STATUSES,
  CONTACT_MESSAGE_STATUS_LABELS,
  type ContactMessageStatusValue
} from '@/lib/contact-messages';

const initialState: ContactMessageStatusActionState = {
  status: 'idle',
  message: '',
  submissionId: 0
};

export function ContactMessageStatusForm({
  contactMessageId,
  currentStatus
}: {
  contactMessageId: string;
  currentStatus: ContactMessageStatusValue;
}) {
  const [state, formAction, isPending] = useActionState(updateContactMessageStatus, initialState);

  return (
    <form action={formAction} className="grid gap-3 sm:grid-cols-[minmax(0,240px)_auto] sm:items-end">
      <input type="hidden" name="contactMessageId" value={contactMessageId} />
      <label className="grid gap-2 text-sm font-semibold text-foreground">
        Статус звернення
        <select
          name="status"
          defaultValue={currentStatus}
          disabled={isPending}
          className="h-11 rounded-md border border-border bg-card px-3 text-sm outline-none focus:border-accent focus:ring-2 focus:ring-accent/25 disabled:cursor-not-allowed disabled:opacity-65"
        >
          {CONTACT_MESSAGE_STATUSES.map((status) => (
            <option key={status} value={status}>
              {CONTACT_MESSAGE_STATUS_LABELS[status]}
            </option>
          ))}
        </select>
      </label>
      <button
        type="submit"
        disabled={isPending}
        className="inline-flex h-11 items-center justify-center rounded-md bg-accent px-5 text-sm font-bold text-foreground transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-65"
      >
        {isPending ? 'Зберігаємо…' : 'Зберегти статус'}
      </button>
      <div aria-live="polite" className="sm:col-span-2">
        {state.message ? (
          <p
            role={state.status === 'error' ? 'alert' : 'status'}
            className={`text-sm font-semibold ${state.status === 'success' ? 'text-success' : 'text-danger'}`}
          >
            {state.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
