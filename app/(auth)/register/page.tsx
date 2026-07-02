import Link from 'next/link';

import { registerClient } from '../actions';

const errorMessages: Record<string, string> = {
  validation: 'Перевірте обовʼязкові поля. Пароль має містити щонайменше 8 символів і збігатися з підтвердженням.',
  exists: 'Користувач з таким email або телефоном уже існує.',
  database: 'DATABASE_URL не налаштований.'
};

export default async function RegisterPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;
  const errorMessage = params.error ? errorMessages[params.error] ?? 'Не вдалося зареєструвати клієнта.' : null;

  return (
    <div className="min-h-screen bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl rounded-lg border border-border bg-card p-6 shadow-card">
        <p className="text-sm font-bold uppercase text-accent">Новий клієнт</p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">Реєстрація</h1>
        <p className="mt-3 text-sm leading-6 text-muted">Створіть CLIENT-акаунт для перегляду історії заявок і швидкого створення нових запитів.</p>
        {errorMessage ? (
          <div className="mt-5 rounded-md border border-danger/30 bg-[#FEF3F2] p-3 text-sm font-semibold text-danger">
            {errorMessage}
          </div>
        ) : null}
        <form action={registerClient} className="mt-6 grid gap-4 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Імʼя / контактна особа *
            <input name="contactName" required className="h-11 rounded-md border border-border px-3 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Назва компанії
            <input name="companyName" className="h-11 rounded-md border border-border px-3 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Email *
            <input name="email" type="email" required className="h-11 rounded-md border border-border px-3 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Телефон *
            <input name="phone" required className="h-11 rounded-md border border-border px-3 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Пароль *
            <input name="password" type="password" required minLength={8} className="h-11 rounded-md border border-border px-3 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Підтвердження пароля *
            <input name="confirmPassword" type="password" required minLength={8} className="h-11 rounded-md border border-border px-3 outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25" />
          </label>
          <button type="submit" className="rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-[#DFA600] md:col-span-2">
            Зареєструватися
          </button>
        </form>
        <p className="mt-5 text-sm text-muted">
          Уже маєте акаунт?{' '}
          <Link href="/login" className="font-bold text-foreground transition hover:text-accent">
            Увійти
          </Link>
        </p>
      </div>
    </div>
  );
}
