import type { Metadata } from 'next';
import Link from 'next/link';
import { unstable_noStore as noStore } from 'next/cache';

import { validateManagerInvitationToken } from '@/lib/users/manager-invitations';

import { ManagerPasswordForm } from './manager-password-form';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export const metadata: Metadata = {
  title: 'Активація акаунта менеджера | Kairos Parts',
  robots: { index: false, follow: false },
  referrer: 'no-referrer'
};

const stateCopy = {
  invalid: {
    title: 'Посилання недійсне',
    description: 'Перевірте адресу посилання або зверніться до адміністратора.'
  },
  expired: {
    title: 'Строк дії посилання завершився',
    description: 'Попросіть адміністратора створити нове запрошення.'
  },
  used: {
    title: 'Посилання вже використано',
    description: 'Якщо акаунт активовано, перейдіть до службового входу.'
  },
  revoked: {
    title: 'Посилання відкликано',
    description: 'Попросіть адміністратора надати актуальне запрошення.'
  },
  account_active: {
    title: 'Акаунт уже активовано',
    description: 'Використайте службовий вхід, щоб перейти до CRM.'
  },
  account_disabled: {
    title: 'Доступ до акаунта вимкнено',
    description: 'Зверніться до адміністратора Kairos Parts.'
  }
} as const;

export default async function ManagerInvitationPage({
  params
}: {
  params: Promise<{ token: string }>;
}) {
  noStore();
  const { token } = await params;
  const invitation = await validateManagerInvitationToken(token);

  if (invitation.state !== 'active') {
    const copy = stateCopy[invitation.state];

    return (
      <InvitationCard title={copy.title} description={copy.description}>
        {invitation.state === 'account_active' || invitation.state === 'used' ? (
          <Link
            href="/admin/login"
            className="mt-6 inline-flex min-h-11 items-center justify-center rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover"
          >
            Перейти до службового входу
          </Link>
        ) : null}
      </InvitationCard>
    );
  }

  return (
    <InvitationCard
      title="Активуйте акаунт менеджера"
      description="Встановіть пароль для службового входу до CRM Kairos Parts. Посилання одноразове."
    >
      <ManagerPasswordForm token={token} manager={invitation.manager} />
    </InvitationCard>
  );
}

function InvitationCard({
  title,
  description,
  children
}: {
  title: string;
  description: string;
  children?: React.ReactNode;
}) {
  return (
    <main className="min-h-[70vh] bg-background px-4 py-12 sm:px-6 lg:px-8">
      <section className="mx-auto max-w-md rounded-lg border border-border bg-card p-6 shadow-card">
        <p className="text-sm font-bold uppercase text-accent">CRM Kairos Parts</p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-muted">{description}</p>
        {children}
      </section>
    </main>
  );
}
