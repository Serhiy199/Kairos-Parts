import Link from 'next/link';

import { loginClient } from '../actions';

const errorMessages: Record<string, string> = {
  validation: 'Вкажіть email і пароль.',
  credentials: 'Email або пароль неправильні, або користувач не є CLIENT.',
  database: 'DATABASE_URL не налаштований.'
};

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; registered?: string }>;
}) {
  const params = await searchParams;
  const errorMessage = params.error ? errorMessages[params.error] ?? 'Не вдалося увійти.' : null;

  return (
    <div className="min-h-screen bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-6 shadow-card">
        <p className="text-sm font-bold uppercase text-accent">Кабінет клієнта</p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">Вхід</h1>
        <p className="mt-3 text-sm leading-6 text-muted">Увійдіть як клієнт, щоб бачити свої заявки та створювати нові з автопідстановкою контактів.</p>
        {params.registered ? (
          <div className="mt-5 rounded-md border border-success/30 bg-[#E7F6EC] p-3 text-sm font-semibold text-success">
            Реєстрацію завершено. Тепер можна увійти.
          </div>
        ) : null}
        {errorMessage ? (
          <div className="mt-5 rounded-md border border-danger/30 bg-[#FEF3F2] p-3 text-sm font-semibold text-danger">
            {errorMessage}
          </div>
        ) : null}
        <form action={loginClient} className="mt-6 grid gap-4">
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Email
            <input name="email" type="email" required className="h-11 rounded-md border border-border px-3 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25" />
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
      </div>
    </div>
  );
}
