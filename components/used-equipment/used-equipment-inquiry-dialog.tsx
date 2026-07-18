'use client';

import { useActionState, useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { FaPaperPlane, FaTimes } from 'react-icons/fa';

import { createUsedEquipmentInquiry, type UsedEquipmentInquiryFormState } from '@/app/(public)/used-equipment/actions';
import type { UsedEquipmentInquirySource } from '@/lib/used-equipment/inquiry-validation';

type UsedEquipmentInquiryDialogProps = {
  usedEquipmentId: string;
  equipmentTitle: string;
  source: UsedEquipmentInquirySource;
  trigger: ReactNode;
  triggerClassName?: string;
};

const INITIAL_STATE: UsedEquipmentInquiryFormState = {
  status: 'idle'
};

const focusableSelector = [
  'a[href]',
  'button:not([disabled])',
  'textarea:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

function fieldClass(error?: string) {
  return `h-11 rounded-md border bg-card px-3 text-sm font-semibold text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 ${
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

function InquiryForm({
  usedEquipmentId,
  equipmentTitle,
  source,
  onClose
}: {
  usedEquipmentId: string;
  equipmentTitle: string;
  source: UsedEquipmentInquirySource;
  onClose: () => void;
}) {
  const [state, formAction, isPending] = useActionState(createUsedEquipmentInquiry, INITIAL_STATE);
  const nameErrorId = useId();
  const phoneErrorId = useId();
  const messageId = useId();
  const isSuccess = state.status === 'success';

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="usedEquipmentId" value={usedEquipmentId} />
      <input type="hidden" name="source" value={source} />
      <div className="hidden" aria-hidden="true">
        <label>
          Website
          <input name="website" tabIndex={-1} autoComplete="off" />
        </label>
      </div>

      {state.message ? (
        <div
          id={messageId}
          aria-live="polite"
          className={`rounded-md border px-4 py-3 text-sm font-semibold ${
            isSuccess ? 'border-success/25 bg-[#E7F6EC] text-success' : 'border-danger/30 bg-danger/10 text-danger'
          }`}
        >
          {state.message}
        </div>
      ) : null}

      {!isSuccess ? (
        <>
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Ім’я *
            <input
              name="name"
              type="text"
              autoComplete="name"
              defaultValue={state.values?.name ?? ''}
              aria-invalid={Boolean(state.fieldErrors?.name)}
              aria-describedby={state.fieldErrors?.name ? nameErrorId : undefined}
              className={fieldClass(state.fieldErrors?.name)}
            />
            <FieldError id={nameErrorId} message={state.fieldErrors?.name} />
          </label>

          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Телефон *
            <input
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              defaultValue={state.values?.phone ?? ''}
              aria-invalid={Boolean(state.fieldErrors?.phone)}
              aria-describedby={state.fieldErrors?.phone ? phoneErrorId : undefined}
              className={fieldClass(state.fieldErrors?.phone)}
            />
            <FieldError id={phoneErrorId} message={state.fieldErrors?.phone} />
          </label>

          <p className="text-xs leading-5 text-public-muted">
            Надсилаючи форму, ви погоджуєтесь на обробку персональних даних для зв’язку щодо цього запиту.
          </p>

          <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:justify-end">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex h-11 items-center justify-center rounded-md border border-public-border px-5 text-sm font-bold text-public-primary transition hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Скасувати
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-accent px-5 text-sm font-bold text-foreground transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
            >
              <FaPaperPlane aria-hidden="true" className="size-3" />
              {isPending ? 'Надсилання...' : 'Надіслати запит'}
            </button>
          </div>
        </>
      ) : (
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-11 items-center justify-center rounded-md bg-accent px-5 text-sm font-bold text-foreground transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Закрити
          </button>
        </div>
      )}

      <span className="sr-only" aria-live="polite">
        {isPending ? `Надсилаємо запит щодо ${equipmentTitle}` : ''}
      </span>
    </form>
  );
}

export function UsedEquipmentInquiryDialog({
  usedEquipmentId,
  equipmentTitle,
  source,
  trigger,
  triggerClassName
}: UsedEquipmentInquiryDialogProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [formKey, setFormKey] = useState(0);
  const titleId = useId();
  const descriptionId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  function openDialog() {
    setFormKey((current) => current + 1);
    setIsOpen(true);
  }

  function closeDialog() {
    setIsOpen(false);
  }

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const triggerElement = triggerRef.current;
    document.body.style.overflow = 'hidden';

    const firstFocusable = dialogRef.current?.querySelector<HTMLElement>(focusableSelector);
    firstFocusable?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeDialog();
        return;
      }

      if (event.key !== 'Tab') {
        return;
      }

      const focusable = Array.from(dialogRef.current?.querySelectorAll<HTMLElement>(focusableSelector) ?? []).filter(
        (element) => element.offsetParent !== null
      );

      if (focusable.length === 0) {
        event.preventDefault();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
      triggerElement?.focus();
    };
  }, [isOpen]);

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openDialog}
        className={
          triggerClassName ??
          'inline-flex h-10 items-center justify-center rounded-md bg-accent px-4 text-sm font-bold text-foreground transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent'
        }
      >
        {trigger}
      </button>

      {isOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-3 py-6 sm:px-4" role="presentation">
          <button
            type="button"
            aria-label="Закрити форму"
            className="absolute inset-0 cursor-default bg-black/65"
            onClick={closeDialog}
          />
          <div
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            aria-describedby={descriptionId}
            className="relative max-h-[calc(100vh-48px)] w-full max-w-lg overflow-y-auto rounded-lg border border-public-border bg-card p-5 shadow-2xl outline-none sm:p-6"
            tabIndex={-1}
          >
            <button
              type="button"
              onClick={closeDialog}
              aria-label="Закрити форму"
              className="absolute right-4 top-4 inline-flex size-9 items-center justify-center rounded-md border border-public-border text-public-muted transition hover:border-accent hover:text-accent focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <FaTimes aria-hidden="true" className="size-3" />
            </button>

            <div className="pr-10">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">БВ техніка</p>
              <h2 id={titleId} className="mt-2 text-2xl font-bold text-public-primary">
                Запит на перегляд техніки
              </h2>
              <p className="mt-2 text-sm font-bold text-public-secondary">{equipmentTitle}</p>
              <p id={descriptionId} className="mt-3 text-sm leading-6 text-public-muted">
                Залиште ім’я та номер телефону. Менеджер зв’яжеться з вами, щоб уточнити деталі.
              </p>
            </div>

            <div className="mt-5">
              <InquiryForm
                key={formKey}
                usedEquipmentId={usedEquipmentId}
                equipmentTitle={equipmentTitle}
                source={source}
                onClose={closeDialog}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
