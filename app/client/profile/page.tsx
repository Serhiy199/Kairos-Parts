import { ClientDbBlocker } from '@/components/client/client-db-blocker';
import { getClientProfileForSession, requireClientSession } from '@/lib/client/access';
import { hasDatabaseUrl } from '@/lib/env/database';

export const dynamic = 'force-dynamic';

export default async function ClientProfilePage() {
  const session = await requireClientSession();

  if (!hasDatabaseUrl()) {
    return <ClientDbBlocker />;
  }

  const profile = await getClientProfileForSession(session.user.id);

  if (!profile) {
    return <ClientDbBlocker />;
  }

  const rows = [
    ['Тип клієнта', profile.clientType === 'BUSINESS' ? 'ФОП / Юр особа' : 'Фіз особа'],
    ['Контактна особа', profile.contactName ?? profile.user.name ?? '—'],
    ['Імʼя', profile.firstName ?? '—'],
    ['Прізвище', profile.lastName ?? '—'],
    ['Email', profile.email ?? profile.user.email ?? '—'],
    ['Телефон', profile.phone ?? profile.user.phone ?? '—'],
    ['Назва компанії', profile.companyName ?? '—'],
    ['ЄДРПОУ / ІПН', profile.taxId ?? '—'],
    ['Дата створення профілю', profile.createdAt.toLocaleDateString('uk-UA')]
  ];

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-card">
      <p className="text-sm font-bold uppercase text-accent">Профіль клієнта</p>
      <h2 className="mt-2 text-2xl font-bold text-foreground">Контактні дані</h2>
      <div className="mt-6 grid gap-3">
        {rows.map(([label, value]) => (
          <div key={label} className="grid gap-1 rounded-md border border-border bg-surface-muted p-4 sm:grid-cols-[220px_1fr] sm:gap-4">
            <p className="text-sm font-semibold text-muted">{label}</p>
            <p className="text-sm font-bold text-foreground">{value}</p>
          </div>
        ))}
      </div>
      <p className="mt-5 text-sm leading-6 text-muted">Редагування профілю навмисно залишено за межами Day 7, щоб не роздувати scope.</p>
    </div>
  );
}
