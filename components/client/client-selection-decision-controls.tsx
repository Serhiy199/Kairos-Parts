'use client';

import { useState } from 'react';

import { decideClientSelectionItemAction } from '@/app/client/actions';
import {
  ReactiveActionForm,
  ReactiveSubmitButton
} from '@/components/workflow/reactive-action-form';

type DecisionTarget = {
  requestId: string;
  batchId: string;
  batchItemId: string;
  revision: number;
};

function DecisionFields({
  target,
  decision
}: {
  target: DecisionTarget;
  decision: 'APPROVE' | 'REJECT';
}) {
  return (
    <>
      <input type="hidden" name="requestId" value={target.requestId} />
      <input type="hidden" name="batchId" value={target.batchId} />
      <input type="hidden" name="batchItemId" value={target.batchItemId} />
      <input type="hidden" name="revision" value={target.revision} />
      <input type="hidden" name="decision" value={decision} />
    </>
  );
}

export function ClientSelectionDecisionControls({
  target
}: {
  target: DecisionTarget;
}) {
  const [rejecting, setRejecting] = useState(false);

  if (rejecting) {
    return (
      <ReactiveActionForm action={decideClientSelectionItemAction} className="grid gap-3">
        <DecisionFields target={target} decision="REJECT" />
        <label className="grid gap-2 text-sm font-semibold text-foreground">
          Причина відхилення
          <textarea
            name="clientComment"
            autoFocus
            required
            minLength={3}
            maxLength={500}
            rows={3}
            placeholder="Вкажіть, що саме не підходить або потребує уточнення."
            className="min-h-24 resize-y rounded-md border border-border bg-card px-3 py-2 text-sm font-normal outline-none transition focus:border-accent"
          />
        </label>
        <div className="flex flex-wrap gap-2">
          <ReactiveSubmitButton pendingLabel="Відхиляємо…" className="rounded-md bg-red-700 px-4 py-2 text-sm font-bold text-white transition hover:bg-red-800 disabled:opacity-60">
            Підтвердити відхилення
          </ReactiveSubmitButton>
          <button
            type="button"
            onClick={() => setRejecting(false)}
            className="rounded-md border border-border px-4 py-2 text-sm font-bold text-foreground transition hover:border-accent"
          >
            Скасувати
          </button>
        </div>
      </ReactiveActionForm>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      <ReactiveActionForm action={decideClientSelectionItemAction}>
        <DecisionFields target={target} decision="APPROVE" />
        <ReactiveSubmitButton pendingLabel="Погоджуємо…" className="rounded-md bg-accent px-4 py-2 text-sm font-bold text-foreground transition hover:bg-accent-hover disabled:opacity-60">
          Погодити
        </ReactiveSubmitButton>
      </ReactiveActionForm>
      <button
        type="button"
        onClick={() => setRejecting(true)}
        className="rounded-md border border-red-300 px-4 py-2 text-sm font-bold text-red-700 transition hover:bg-red-50"
      >
        Відхилити
      </button>
    </div>
  );
}
