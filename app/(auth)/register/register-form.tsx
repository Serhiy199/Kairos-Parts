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

import { registerClient } from '../actions';

type AccountType = 'BUSINESS' | 'INDIVIDUAL';

const inputClass =
  'h-11 rounded-md border border-border px-3 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25';

export function RegisterForm({ nextPath }: { nextPath?: string }) {
  const [accountType, setAccountType] = useState<AccountType>('BUSINESS');
  const [phone, setPhone] = useState('');
  const phoneRef = useRef<HTMLInputElement>(null);
  const pendingPhoneCaretRef = useRef<number | null>(null);
  const loginHref = nextPath ? `/login?next=${encodeURIComponent(nextPath)}` : '/login';

  useLayoutEffect(() => {
    if (pendingPhoneCaretRef.current === null) return;

    phoneRef.current?.setSelectionRange(pendingPhoneCaretRef.current, pendingPhoneCaretRef.current);
    pendingPhoneCaretRef.current = null;
  }, [phone]);

  function updatePhone(value: string, caret: number) {
    if (!value) {
      setPhone('');
      phoneRef.current?.setCustomValidity('');
      return;
    }

    const parsed = formatPhoneIdentifierInput(value);
    if (!parsed.isPhoneLike) return;

    const localDigitsBeforeCaret = getLocalDigitCountBeforeCaret(value, caret);
    pendingPhoneCaretRef.current = getPhoneCaretPosition(parsed.display, localDigitsBeforeCaret);
    setPhone(parsed.display);
    phoneRef.current?.setCustomValidity('');
  }

  function handlePhoneKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key !== 'Backspace' && event.key !== 'Delete') return;

    const input = event.currentTarget;
    const edit = removeMaskedPhoneDigit(
      phone,
      input.selectionStart ?? phone.length,
      input.selectionEnd ?? phone.length,
      event.key === 'Backspace' ? 'backward' : 'forward'
    );

    if (!edit) return;

    event.preventDefault();
    pendingPhoneCaretRef.current = edit.caret;
    setPhone(edit.display);
    input.setCustomValidity('');
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const parsed = formatPhoneIdentifierInput(phone);
    if (parsed.canonical) return;

    event.preventDefault();
    phoneRef.current?.setCustomValidity('Введіть повний номер телефону.');
    phoneRef.current?.reportValidity();
  }

  return (
    <>
      <div className="mt-6 grid gap-3 sm:grid-cols-2">
        {(['BUSINESS', 'INDIVIDUAL'] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setAccountType(type)}
            className={`rounded-md border px-4 py-4 text-sm font-bold transition ${
              accountType === type
                ? 'border-accent bg-primary text-accent shadow-card'
                : 'border-border bg-white text-foreground hover:border-accent hover:bg-surface-muted'
            }`}
          >
            {type === 'BUSINESS' ? 'ФОП / Юр особа' : 'Фіз особа'}
          </button>
        ))}
      </div>

      <form action={registerClient} onSubmit={handleSubmit} className="mt-6 grid gap-4 md:grid-cols-2">
        <input type="hidden" name="accountType" value={accountType} />
        {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}

        {accountType === 'BUSINESS' ? (
          <>
            <label className="grid gap-2 text-sm font-semibold text-foreground">
              Назва компанії / ФОП *
              <input name="companyName" required className={inputClass} />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-foreground">
              ЄДРПОУ / ІПН *
              <input name="taxId" required className={inputClass} />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-foreground md:col-span-2">
              Контактна особа *
              <input name="contactName" required className={inputClass} />
            </label>
          </>
        ) : (
          <>
            <label className="grid gap-2 text-sm font-semibold text-foreground">
              Імʼя *
              <input name="firstName" required className={inputClass} />
            </label>
            <label className="grid gap-2 text-sm font-semibold text-foreground">
              Прізвище
              <input name="lastName" className={inputClass} />
            </label>
          </>
        )}

        <label className="grid gap-2 text-sm font-semibold text-foreground">
          Телефон *
          <input
            ref={phoneRef}
            name="phone"
            type="tel"
            inputMode="tel"
            autoComplete="tel"
            value={phone}
            onChange={(event) => updatePhone(event.target.value, event.target.selectionStart ?? event.target.value.length)}
            onKeyDown={handlePhoneKeyDown}
            pattern="\+38 \(0\d{2}\) \d{3}-\d{2}-\d{2}"
            title="Введіть повний номер у форматі +38 (0XX) XXX-XX-XX."
            placeholder="+38 (0XX) XXX-XX-XX"
            required
            className={inputClass}
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-foreground">
          Email *
          <input name="email" type="email" required className={inputClass} />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-foreground">
          Пароль *
          <input name="password" type="password" required minLength={8} className={inputClass} />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-foreground">
          Підтвердження пароля *
          <input name="confirmPassword" type="password" required minLength={8} className={inputClass} />
        </label>
        <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover md:col-span-2">
          <ActionIcon name="plus" />
          Зареєструватися
        </button>
      </form>

      <p className="mt-5 text-sm text-muted">
        Вже маєте акаунт?{' '}
        <Link href={loginHref} className="font-bold text-foreground transition hover:text-accent">
          <span className="inline-flex items-center gap-1.5">
            <ActionIcon name="login" />
          Увійти
          </span>
        </Link>
      </p>
    </>
  );
}
