'use client';

import React, { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { ClientSelectionItemCard } from '@/components/client/client-selection-item-card';
import { useToast } from '@/components/ui/toast-provider';
import type { WorkflowActionResult } from '@/lib/actions/workflow-result';
import type { ClientRequestApprovalReadModel } from '@/lib/request-selection/client-read-model';

type BatchReadModel = Extract<ClientRequestApprovalReadModel, { mode: 'BATCH' }>;

export function clientSelectionStateKey(batchId: string, revision: number) {
  return `${batchId}:${revision}`;
}

export function toggleClientSelection(
  selectedIds: ReadonlySet<string>,
  batchItemId: string,
  checked: boolean
) {
  const next = new Set(selectedIds);
  if (checked) next.add(batchItemId);
  else next.delete(batchItemId);
  return next;
}

export function summarizeClientSelection(
  selectedIds: ReadonlySet<string>,
  eligibleIds: readonly string[]
) {
  const eligibleIdSet = new Set(eligibleIds);
  const selectedCount = [...selectedIds].filter((id) => eligibleIdSet.has(id)).length;
  return {
    selectedCount,
    notSelectedCount: eligibleIds.length - selectedCount
  };
}

function positionLabel(count: number) {
  const mod10 = count % 10;
  const mod100 = count % 100;
  if (mod10 === 1 && mod100 !== 11) return 'позиція';
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return 'позиції';
  return 'позицій';
}

function SelectionConfirmationDialog({
  approvedCount,
  totalCount,
  pending,
  onCancel,
  onConfirm
}: {
  approvedCount: number;
  totalCount: number;
  pending: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  const zeroSelection = approvedCount === 0;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const firstButton = dialog.querySelector<HTMLButtonElement>('button');
    firstButton?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !pending) onCancel();
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [onCancel, pending]);

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/60 p-4">
      <section
        ref={dialogRef}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="selection-confirm-title"
        aria-describedby="selection-confirm-description"
        className="w-full max-w-lg rounded-lg border border-border bg-card p-5 shadow-xl"
      >
        <h2 id="selection-confirm-title" className="text-xl font-bold text-foreground">
          {zeroSelection ? 'Підтвердити відмову від усіх позицій?' : 'Надіслати погодження?'}
        </h2>
        <div
          id="selection-confirm-description"
          className="mt-3 grid gap-3 text-sm leading-6 text-muted"
        >
          {zeroSelection ? (
            <>
              <p>Ви не погодили жодної позиції.</p>
              <p>
                Після підтвердження заявка буде скасована, а рахунок не
                формуватиметься. Для нового підбору потрібно створити нову заявку.
              </p>
            </>
          ) : (
            <>
              <p>
                Ви погодили {approvedCount} із {totalCount}{' '}
                {positionLabel(totalCount)}.
              </p>
              <p>Позиції без галочки будуть позначені як непогоджені.</p>
              <p>
                Після надсилання змінити вибір у цій заявці буде неможливо.
                Для додаткового підбору потрібно створити нову заявку.
              </p>
            </>
          )}
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button
            type="button"
            disabled={pending}
            onClick={onCancel}
            className="min-h-11 rounded-md border border-border px-4 text-sm font-bold text-foreground transition hover:border-accent disabled:opacity-60"
          >
            Повернутися до перегляду
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={onConfirm}
            className={`min-h-11 rounded-md px-4 text-sm font-bold transition disabled:opacity-60 ${
              zeroSelection
                ? 'bg-red-700 text-white hover:bg-red-800'
                : 'bg-accent text-foreground hover:bg-accent-hover'
            }`}
          >
            {pending
              ? 'Надсилаємо погодження…'
              : zeroSelection
                ? 'Підтвердити відмову'
                : 'Підтвердити та надіслати'}
          </button>
        </div>
      </section>
    </div>
  );
}

function ClientSelectionCheckboxListState({
  model,
  submitAction
}: {
  model: BatchReadModel;
  submitAction: (formData: FormData) => Promise<WorkflowActionResult>;
}) {
  const { activeBatch } = model;
  const router = useRouter();
  const { showToast } = useToast();
  const [selectedIds, setSelectedIds] = useState<ReadonlySet<string>>(
    () => new Set<string>()
  );
  const [confirmationOpen, setConfirmationOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const eligibleItems = activeBatch.status === 'SENT'
    ? activeBatch.items.filter((item) => item.status === 'PENDING')
    : [];
  const eligibleIds = eligibleItems.map((item) => item.id);
  const { selectedCount, notSelectedCount } = summarizeClientSelection(
    selectedIds,
    eligibleIds
  );

  function submitSelection() {
    if (pending) return;
    startTransition(async () => {
      const formData = new FormData();
      formData.set('requestId', model.request.id);
      formData.set('batchId', activeBatch.id);
      formData.set('revision', String(activeBatch.revision));
      for (const id of selectedIds) {
        if (eligibleIds.includes(id)) {
          formData.append('approvedBatchItemIds', id);
        }
      }
      try {
        const result = await submitAction(formData);
        showToast(result.feedback);
        if (result.ok || result.refresh) setConfirmationOpen(false);
        if (result.refresh !== false) router.refresh();
      } catch {
        setConfirmationOpen(false);
        showToast({
          code: 'selection-submit-network-error',
          tone: 'error',
          message: 'Не вдалося надіслати погодження. Ваш локальний вибір збережено — перевірте з’єднання та спробуйте ще раз.'
        });
      }
    });
  }

  return (
    <>
      <div className="mt-5 grid min-w-0 gap-3">
        {activeBatch.items.map((item) => {
          const isPendingDecision =
            activeBatch.status === 'SENT' && item.status === 'PENDING';
          const checkboxId = `selection-${activeBatch.id}-${activeBatch.revision}-${item.id}`;

          return (
            <ClientSelectionItemCard
              key={item.id}
              item={item}
              decisionControl={isPendingDecision ? (
                    <span className="flex min-w-0 items-center gap-2 rounded-md border border-border bg-card px-3 py-2">
                      <input
                        id={checkboxId}
                        type="checkbox"
                        disabled={pending}
                        checked={selectedIds.has(item.id)}
                        onChange={(event) => {
                          setSelectedIds((current) =>
                            toggleClientSelection(current, item.id, event.target.checked)
                          );
                        }}
                        className="size-4 shrink-0 accent-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed"
                      />
                      <label
                        htmlFor={checkboxId}
                        className="min-w-0 cursor-pointer break-words text-sm font-semibold leading-5 text-foreground"
                      >
                        Погоджую позицію
                      </label>
                    </span>
                  ) : undefined}
              decisionMessage={!isPendingDecision ? (
                item.status === 'APPROVED' ? (
                    <p className="text-sm font-semibold text-success">
                      Ви погодили цю позицію.
                    </p>
                ) : item.status === 'REJECTED' ? (
                    <p className="text-sm font-semibold text-red-700">
                      Позицію відхилено.
                    </p>
                ) : (
                    <p className="text-sm font-semibold text-muted">
                      Рішення для цієї версії більше не приймаються.
                    </p>
                )
              ) : undefined}
            />
          );
        })}

        {activeBatch.items.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-5 text-sm text-muted">
            У цій версії підбору немає позицій.
          </p>
        ) : null}
      </div>

      {eligibleItems.length > 0 ? (
        <section
          aria-live="polite"
          className="mt-5 rounded-md border border-accent/40 bg-surface-muted p-4"
        >
          <h4 className="font-bold text-foreground">Підсумок вибору</h4>
          <div className="mt-3 grid gap-1 text-sm leading-6">
            <p className="font-semibold text-success">
              Погоджено: {selectedCount} із {eligibleItems.length}{' '}
              {positionLabel(eligibleItems.length)}
            </p>
            <p className="font-semibold text-muted">
              Не погоджено: {notSelectedCount} {positionLabel(notSelectedCount)}
            </p>
          </div>
          <p className="mt-3 text-xs leading-5 text-muted">
            Після надсилання змінити вибір буде неможливо. Позиції без галочки
            будуть позначені як непогоджені.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() => setConfirmationOpen(true)}
            className="mt-4 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-accent px-5 text-sm font-bold text-foreground transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {pending ? 'Надсилаємо погодження…' : 'Надіслати погодження'}
          </button>
        </section>
      ) : null}
      {confirmationOpen ? (
        <SelectionConfirmationDialog
          approvedCount={selectedCount}
          totalCount={eligibleItems.length}
          pending={pending}
          onCancel={() => setConfirmationOpen(false)}
          onConfirm={submitSelection}
        />
      ) : null}
    </>
  );
}

export function ClientSelectionCheckboxList({
  model,
  submitAction
}: {
  model: BatchReadModel;
  submitAction: (formData: FormData) => Promise<WorkflowActionResult>;
}) {
  return (
    <ClientSelectionCheckboxListState
      key={clientSelectionStateKey(model.activeBatch.id, model.activeBatch.revision)}
      model={model}
      submitAction={submitAction}
    />
  );
}
