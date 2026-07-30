'use client';

import React, { useEffect, useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';

import { useToast } from '@/components/ui/toast-provider';
import type { WorkflowActionResult } from '@/lib/actions/workflow-result';
import {
  formatClientSelectionPrice,
  formatClientSelectionQuantity
} from '@/lib/request-selection/client-presentation';
import type { ClientRequestApprovalReadModel } from '@/lib/request-selection/client-read-model';
import {
  REQUEST_SELECTION_BATCH_ITEM_STATUS_LABELS
} from '@/lib/request-selection/presentation';

type BatchReadModel = Extract<ClientRequestApprovalReadModel, { mode: 'BATCH' }>;

const itemStatusClasses = {
  PENDING: 'bg-[#FFF7E0] text-[#8A5B24]',
  APPROVED: 'bg-[#E7F6EC] text-success',
  REJECTED: 'bg-red-50 text-red-700'
} as const;

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
            <article key={item.id} className="min-w-0 rounded-md border border-border p-4">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase text-muted">
                    Позиція {item.position}
                  </p>
                  <h4 className="mt-2 break-words font-bold text-foreground">
                    {item.itemName}
                  </h4>
                  <p className="mt-1 break-words text-xs text-muted">
                    {item.brand ?? 'Виробник уточнюється'}
                    {item.equipmentType ? ` · ${item.equipmentType}` : ''}
                  </p>
                </div>
                <div className="flex min-w-0 shrink-0 flex-wrap items-center gap-2 sm:max-w-[48%] sm:justify-end">
                  <span
                    className={`w-fit rounded-full px-2.5 py-1 text-xs font-bold ${itemStatusClasses[item.status]}`}
                  >
                    {REQUEST_SELECTION_BATCH_ITEM_STATUS_LABELS[item.status]}
                  </span>
                  {isPendingDecision ? (
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
                  ) : null}
                </div>
              </div>

              <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase text-muted">Каталожні номери</p>
                  <p className="mt-2 break-words text-sm text-foreground [overflow-wrap:anywhere]">
                    Каталог: {item.catalogNumber ?? '—'}
                  </p>
                  <p className="mt-1 break-words text-sm text-muted [overflow-wrap:anywhere]">
                    Аналог: {item.analogNumber ?? '—'}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase text-muted">Кількість</p>
                  <p className="mt-2 break-words text-sm font-semibold text-foreground">
                    {formatClientSelectionQuantity(item.quantity, item.unit)}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase text-muted">Наявність і доставка</p>
                  <p className="mt-2 break-words text-sm text-foreground">
                    {item.availability ?? 'Уточнюється'}
                  </p>
                  <p className="mt-1 break-words text-sm text-muted">
                    {item.deliveryTime ?? 'Термін уточнюється'}
                  </p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-bold uppercase text-muted">Ціна без ПДВ</p>
                  <p className="mt-2 break-words text-sm font-semibold text-foreground">
                    {formatClientSelectionPrice(item.unitPrice, item.currency)}
                  </p>
                </div>
              </div>

              {item.vehicle ? (
                <div className="mt-4 min-w-0 rounded-md bg-surface-muted p-3 text-sm">
                  <p className="text-xs font-bold uppercase text-muted">Техніка</p>
                  <p className="mt-2 break-words font-semibold text-foreground">
                    {item.vehicle.displayName
                      ?? ([item.vehicle.brand, item.vehicle.model, item.vehicle.year]
                        .filter(Boolean)
                        .join(' ') || 'Техніка не уточнена')}
                  </p>
                  {item.vehicle.displayName ? (
                    <p className="mt-1 break-words text-xs text-muted">
                      {[item.vehicle.brand, item.vehicle.model, item.vehicle.year]
                        .filter(Boolean)
                        .join(' ') || 'Додаткові дані не вказані'}
                    </p>
                  ) : null}
                </div>
              ) : null}

              {item.managerComment ? (
                <div className="mt-4 min-w-0 border-t border-border pt-4">
                  <p className="text-xs font-bold uppercase text-muted">Коментар менеджера</p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-foreground">
                    {item.managerComment}
                  </p>
                </div>
              ) : null}

              {item.clientComment ? (
                <div className="mt-4 min-w-0 rounded-md bg-red-50 p-3">
                  <p className="text-xs font-bold uppercase text-red-700">Ваш коментар</p>
                  <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-red-700">
                    {item.clientComment}
                  </p>
                </div>
              ) : null}

              {!isPendingDecision ? (
                <div className="mt-4 border-t border-border pt-4">
                  {item.status === 'APPROVED' ? (
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
                  )}
                </div>
              ) : null}
            </article>
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
