'use client';

import Link from 'next/link';
import { FormEvent, KeyboardEvent, useLayoutEffect, useRef, useState } from 'react';

import { ActionIcon } from '@/components/ui/action-icons';
import {
  formatPhoneIdentifierInput,
  getLocalDigitCountBeforeCaret,
  getPhoneCaretPosition,
  removeMaskedPhoneDigit
} from '@/lib/phone/client-format';

import { loginClient } from '../actions';

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const [identifier, setIdentifier] = useState('');
  const identifierRef = useRef<HTMLInputElement>(null);
  const pendingCaretRef = useRef<number | null>(null);
  const registerHref = nextPath ? `/register?next=${encodeURIComponent(nextPath)}` : '/register';

  useLayoutEffect(() => {
    if (pendingCaretRef.current === null) {
      return;
    }

    identifierRef.current?.setSelectionRange(pendingCaretRef.current, pendingCaretRef.current);
    pendingCaretRef.current = null;
  }, [identifier]);

  function updateIdentifier(value: string, caret: number) {
    const parsed = formatPhoneIdentifierInput(value);

    if (!parsed.isPhoneLike) {
      setIdentifier(value);
      identifierRef.current?.setCustomValidity('');
      return;
    }

    const localDigitsBeforeCaret = getLocalDigitCountBeforeCaret(value, caret);
    pendingCaretRef.current = getPhoneCaretPosition(parsed.display, localDigitsBeforeCaret);
    setIdentifier(parsed.display);
    identifierRef.current?.setCustomValidity('');
  }

  function handleIdentifierKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Backspace' && event.key !== 'Delete') {
      return;
    }

    const input = event.currentTarget;
    const edit = removeMaskedPhoneDigit(
      identifier,
      input.selectionStart ?? identifier.length,
      input.selectionEnd ?? identifier.length,
      event.key === 'Backspace' ? 'backward' : 'forward'
    );

    if (!edit) {
      return;
    }

    event.preventDefault();
    pendingCaretRef.current = edit.caret;
    setIdentifier(edit.display);
    input.setCustomValidity('');
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const parsed = formatPhoneIdentifierInput(identifier);

    if (parsed.isPhoneLike && !parsed.canonical) {
      event.preventDefault();
      identifierRef.current?.setCustomValidity('Введіть повний номер телефону.');
      identifierRef.current?.reportValidity();
    }
  }

  const identifierState = formatPhoneIdentifierInput(identifier);

  return (
    <>
      <form action={loginClient} onSubmit={handleSubmit} className="mt-6 grid gap-4">
        {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
        <label className="grid gap-2 text-sm font-semibold text-foreground">
          Email або номер телефону
          <input
            ref={identifierRef}
            name="identifier"
            type="text"
            value={identifier}
            onChange={(event) => updateIdentifier(event.target.value, event.target.selectionStart ?? event.target.value.length)}
            onKeyDown={handleIdentifierKeyDown}
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            required
            pattern={identifierState.isPhoneLike ? '\\+38 \\(0\\d{2}\\) \\d{3}-\\d{2}-\\d{2}' : undefined}
            title={identifierState.isPhoneLike ? 'Введіть повний номер у форматі +38 (0XX) XXX-XX-XX.' : undefined}
            placeholder="name@example.com або +38 (0XX) XXX-XX-XX"
            className="h-11 rounded-md border border-border px-3 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-foreground">
          Пароль
          <input name="password" type="password" required className="h-11 rounded-md border border-border px-3 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25" />
        </label>
        <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover">
          <ActionIcon name="login" />
          Увійти
        </button>
      </form>
      <p className="mt-5 text-sm text-muted">
        Ще немає акаунта?{' '}
        <Link href={registerHref} className="font-bold text-foreground transition hover:text-accent">
          Зареєструватися
        </Link>
      </p>
    </>
  );
}
