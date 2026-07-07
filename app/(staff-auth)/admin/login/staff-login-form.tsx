'use client';

import { loginStaff } from '@/app/(auth)/actions';
import { ActionIcon } from '@/components/ui/action-icons';

export function StaffLoginForm({ nextPath }: { nextPath?: string }) {
  return (
    <form action={loginStaff} className="mt-6 grid gap-4">
      {nextPath ? <input type="hidden" name="next" value={nextPath} /> : null}
      <label className="grid gap-2 text-sm font-semibold text-foreground">
        Email
        <input
          name="email"
          type="email"
          required
          className="h-11 rounded-md border border-border px-3 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25"
        />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-foreground">
        Пароль
        <input
          name="password"
          type="password"
          required
          className="h-11 rounded-md border border-border px-3 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25"
        />
      </label>
      <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover">
        <ActionIcon name="login" />
        Увійти до CRM
      </button>
    </form>
  );
}
