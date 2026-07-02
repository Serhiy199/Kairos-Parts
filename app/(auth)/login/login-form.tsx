'use client';

import Link from 'next/link';
import { useState } from 'react';

import { loginClient } from '../actions';

type AccountType = 'BUSINESS' | 'INDIVIDUAL';

export function LoginForm({ nextPath }: { nextPath?: string }) {
  const [accountType, setAccountType] = useState<AccountType>('BUSINESS');

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

      <form action={loginClient} className="mt-6 grid gap-4">
        {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
        <label className="grid gap-2 text-sm font-semibold text-foreground">
          {accountType === 'BUSINESS' ? 'Email / ЄДРПОУ / телефон' : 'Email / телефон'}
          <input
            name="email"
            type="text"
            required
            placeholder="На Day 7 фактичний вхід працює через email"
            className="h-11 rounded-md border border-border px-3 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-foreground">
          Пароль
          <input name="password" type="password" required className="h-11 rounded-md border border-border px-3 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25" />
        </label>
        <button type="submit" className="rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-[#DFA600]">
          Увійти
        </button>
      </form>
      <p className="mt-5 text-sm text-muted">
        Ще немає акаунта?{' '}
        <Link href="/register" className="font-bold text-foreground transition hover:text-accent">
          Зареєструватися
        </Link>
      </p>
    </>
  );
}
