'use client';

import { useActionState } from 'react';

import { INITIAL_MANAGER_PASSWORD_SETUP_STATE } from '../action-state';
import { setManagerPassword } from '../actions';

const inputClass =
  'h-11 rounded-md border border-border bg-white px-3 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25';

export function ManagerPasswordForm({
  token,
  manager
}: {
  token: string;
  manager: { name: string; email: string };
}) {
  const [state, formAction, isPending] = useActionState(
    setManagerPassword,
    INITIAL_MANAGER_PASSWORD_SETUP_STATE
  );

  return (
    <form action={formAction} className="mt-6 grid gap-4">
      <input type="hidden" name="token" value={token} />

      <label className="grid gap-2 text-sm font-semibold text-foreground">
        Імʼя
        <input value={manager.name} readOnly className={`${inputClass} bg-surface-muted text-muted`} />
      </label>

      <label className="grid gap-2 text-sm font-semibold text-foreground">
        Email
        <input
          value={manager.email}
          type="email"
          readOnly
          autoComplete="username"
          className={`${inputClass} bg-surface-muted text-muted`}
        />
      </label>

      <label className="grid gap-2 text-sm font-semibold text-foreground">
        Новий пароль
        <input
          name="password"
          type="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          aria-invalid={state.status === 'error'}
          className={inputClass}
        />
      </label>

      <label className="grid gap-2 text-sm font-semibold text-foreground">
        Підтвердження пароля
        <input
          name="confirmPassword"
          type="password"
          required
          minLength={8}
          maxLength={128}
          autoComplete="new-password"
          aria-invalid={state.status === 'error'}
          className={inputClass}
        />
      </label>

      {state.status === 'error' ? (
        <p
          role="alert"
          aria-live="polite"
          className="rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger"
        >
          {state.message}
        </p>
      ) : null}

      <button
        type="submit"
        disabled={isPending}
        className="inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? 'Активуємо акаунт...' : 'Встановити пароль'}
      </button>
    </form>
  );
}
