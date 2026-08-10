'use client';

import { useId, useRef, useState, useTransition, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';

import { updateClientProfileUiAction } from '@/app/client/profile/actions';
import { ActionIcon } from '@/components/ui/action-icons';
import {
  clientProfileIdentityChanged,
  clientProfileReadOnlyRows,
  editableClientProfileValues,
  type ClientProfileEditableValues,
  type ClientProfilePresentation
} from '@/lib/client-profile/presentation';
import type { ClientProfileFieldErrors } from '@/lib/client-profile/validation';

type EditableField = Exclude<keyof ClientProfileEditableValues, never>;

type ProfileInputProps = {
  name: EditableField;
  label: string;
  value: string;
  error?: string;
  disabled: boolean;
  required?: boolean;
  readOnly?: boolean;
  type?: 'text' | 'email' | 'tel';
  autoComplete?: string;
  onChange: (value: string) => void;
};

function ProfileInput({
  name,
  label,
  value,
  error,
  disabled,
  required = false,
  readOnly = false,
  type = 'text',
  autoComplete,
  onChange
}: ProfileInputProps) {
  const inputId = useId();
  const errorId = `${inputId}-error`;

  return (
    <label htmlFor={inputId} className="grid min-w-0 gap-2 text-sm font-semibold text-foreground">
      <span>{label}{required ? ' *' : ''}</span>
      <input
        id={inputId}
        name={name}
        type={type}
        value={value}
        required={required}
        readOnly={readOnly}
        disabled={disabled}
        autoComplete={autoComplete}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        onChange={(event) => onChange(event.target.value)}
        className={`h-11 min-w-0 w-full rounded-md border bg-card px-3 text-sm font-semibold text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60 read-only:cursor-default read-only:bg-surface-muted read-only:text-muted ${
          error ? 'border-danger/50' : 'border-border'
        }`}
      />
      {error ? <span id={errorId} className="text-xs font-semibold text-danger">{error}</span> : null}
    </label>
  );
}

export function ClientProfileEditor({ profile }: { profile: ClientProfilePresentation }) {
  const router = useRouter();
  const initialValues = editableClientProfileValues(profile);
  const [values, setValues] = useState<ClientProfileEditableValues>(initialValues);
  const [fieldErrors, setFieldErrors] = useState<ClientProfileFieldErrors>({});
  const [feedback, setFeedback] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [isPending, startTransition] = useTransition();
  const passwordRef = useRef<HTMLInputElement>(null);
  const formErrorId = useId();
  const passwordErrorId = useId();
  const passwordHelpId = useId();
  const identityChanged = clientProfileIdentityChanged(initialValues, values);

  function updateField(field: EditableField, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setFieldErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function beginEditing() {
    setValues(initialValues);
    setFieldErrors({});
    setFeedback(null);
    setEditing(true);
  }

  function cancelEditing() {
    setValues(initialValues);
    setFieldErrors({});
    setEditing(false);
    if (passwordRef.current) passwordRef.current.value = '';
  }

  function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setFeedback(null);

    startTransition(async () => {
      const result = await updateClientProfileUiAction(formData);
      if (!result.ok) {
        setFieldErrors(result.fieldErrors);
        if (passwordRef.current) passwordRef.current.value = '';
        return;
      }

      setFieldErrors({});
      setEditing(false);
      setFeedback('Дані профілю оновлено.');
      if (passwordRef.current) passwordRef.current.value = '';
      router.refresh();
    });
  }

  return (
    <section className="rounded-lg border border-border bg-card p-4 shadow-card sm:p-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-accent">Профіль клієнта</p>
          <h2 className="mt-2 text-2xl font-bold text-foreground">Контактні дані</h2>
        </div>
        {!editing ? (
          <button
            type="button"
            onClick={beginEditing}
            className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-accent px-5 py-2.5 text-sm font-bold text-foreground transition hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 sm:w-auto"
          >
            Редагувати
          </button>
        ) : null}
      </div>

      {feedback ? (
        <div role="status" aria-live="polite" className="mt-5 rounded-md border border-success/30 bg-[#E7F6EC] p-4 text-sm font-semibold text-success">
          {feedback}
        </div>
      ) : null}

      {!editing ? (
        <div className="mt-6 grid gap-3">
          {clientProfileReadOnlyRows(profile).map((row) => (
            <div key={row.label} className="grid gap-1 rounded-md border border-border bg-surface-muted p-4 sm:grid-cols-[220px_1fr] sm:gap-4">
              <p className="text-sm font-semibold text-muted">{row.label}</p>
              <p className="min-w-0 break-words text-sm font-bold text-foreground">{row.value}</p>
            </div>
          ))}
        </div>
      ) : (
        <form onSubmit={submitProfile} className="mt-6 grid min-w-0 gap-5">
          {fieldErrors._form ? (
            <div id={formErrorId} role="alert" className="rounded-md border border-danger/30 bg-danger/10 p-4 text-sm font-semibold text-danger">
              {fieldErrors._form}
            </div>
          ) : null}

          <div className="grid min-w-0 gap-4 md:grid-cols-2">
            {profile.clientType === 'INDIVIDUAL' ? (
              <>
                <ProfileInput name="firstName" label="Імʼя" value={values.firstName} error={fieldErrors.firstName} disabled={isPending} required autoComplete="given-name" onChange={(value) => updateField('firstName', value)} />
                <ProfileInput name="lastName" label="Прізвище" value={values.lastName} error={fieldErrors.lastName} disabled={isPending} required autoComplete="family-name" onChange={(value) => updateField('lastName', value)} />
              </>
            ) : (
              <>
                <ProfileInput name="companyName" label="Назва компанії" value={values.companyName} error={fieldErrors.companyName} disabled={isPending} readOnly={!profile.companyFieldsEditable} required autoComplete="organization" onChange={(value) => updateField('companyName', value)} />
                <ProfileInput name="taxId" label="ЄДРПОУ / ІПН" value={values.taxId} error={fieldErrors.taxId} disabled={isPending} readOnly={!profile.companyFieldsEditable} required onChange={(value) => updateField('taxId', value)} />
                {!profile.companyFieldsEditable ? (
                  <p className="text-xs leading-5 text-muted md:col-span-2">Ці дані може змінювати основна контактна особа компанії.</p>
                ) : null}
                <div className="md:col-span-2">
                  <ProfileInput name="contactName" label="Контактна особа" value={values.contactName} error={fieldErrors.contactName} disabled={isPending} required autoComplete="name" onChange={(value) => updateField('contactName', value)} />
                </div>
              </>
            )}

            <ProfileInput name="email" label="Email" value={values.email} error={fieldErrors.email} disabled={isPending} required type="email" autoComplete="email" onChange={(value) => updateField('email', value)} />
            <ProfileInput name="phone" label="Телефон" value={values.phone} error={fieldErrors.phone} disabled={isPending} required type="tel" autoComplete="tel" onChange={(value) => updateField('phone', value)} />
          </div>

          {identityChanged ? (
            <label className="grid min-w-0 gap-2 text-sm font-semibold text-foreground">
              <span>Поточний пароль *</span>
              <input
                ref={passwordRef}
                name="currentPassword"
                type="password"
                required
                autoComplete="current-password"
                disabled={isPending}
                aria-invalid={Boolean(fieldErrors.currentPassword)}
                aria-describedby={fieldErrors.currentPassword ? `${passwordErrorId} ${passwordHelpId}` : passwordHelpId}
                className={`h-11 min-w-0 w-full rounded-md border bg-card px-3 text-sm font-semibold text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 disabled:cursor-not-allowed disabled:opacity-60 ${
                  fieldErrors.currentPassword ? 'border-danger/50' : 'border-border'
                }`}
              />
              <span id={passwordHelpId} className="text-xs font-normal leading-5 text-muted">Потрібен для підтвердження зміни email або номера телефону.</span>
              {fieldErrors.currentPassword ? <span id={passwordErrorId} className="text-xs font-semibold text-danger">{fieldErrors.currentPassword}</span> : null}
            </label>
          ) : null}

          <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
            <button
              type="button"
              disabled={isPending}
              onClick={cancelEditing}
              className="inline-flex min-h-11 w-full items-center justify-center rounded-md border border-border px-5 py-2.5 text-sm font-bold text-foreground transition hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              Скасувати
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-md bg-accent px-5 py-2.5 text-sm font-bold text-foreground transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
            >
              <ActionIcon name="save" />
              {isPending ? 'Збереження...' : 'Зберегти'}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
