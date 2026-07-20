import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Акаунт менеджера активовано | Kairos Parts',
  robots: { index: false, follow: false }
};

export default function ManagerInvitationCompletePage() {
  return (
    <main className="min-h-[70vh] bg-background px-4 py-12 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-md rounded-lg border border-border bg-card p-6 shadow-card">
        <p className="text-sm font-bold uppercase text-accent">CRM Kairos Parts</p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">Акаунт активовано</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Пароль встановлено. Тепер ви можете увійти до CRM як менеджер.
        </p>
        <Link
          href="/admin/login"
          className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover"
        >
          Перейти до службового входу
        </Link>
      </section>
    </main>
  );
}
