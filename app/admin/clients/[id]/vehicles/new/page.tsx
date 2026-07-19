import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminDbBlocker } from '@/components/admin/admin-db-blocker';
import { requireCrmSession } from '@/lib/admin/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function AdminClientVehicleCreateFoundationPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCrmSession();
  const { id } = await params;

  if (!hasDatabaseUrl()) {
    return <AdminDbBlocker />;
  }

  const client = await prisma.clientProfile.findFirst({
    where: {
      id,
      user: { role: 'CLIENT' }
    },
    select: {
      id: true,
      contactName: true,
      firstName: true,
      lastName: true,
      phone: true,
      email: true,
      user: {
        select: {
          name: true,
          phone: true,
          email: true
        }
      }
    }
  });

  if (!client) {
    notFound();
  }

  const profileName = [client.firstName, client.lastName].filter(Boolean).join(' ');
  const clientName = client.contactName ?? (profileName || client.user.name || 'Клієнт');

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-border bg-card p-6 shadow-card">
        <Link href={`/admin/clients/${client.id}`} className="text-sm font-semibold text-muted transition hover:text-accent">
          ← До профілю клієнта
        </Link>
        <p className="mt-5 text-sm font-bold uppercase text-accent">Парк техніки</p>
        <h1 className="mt-2 text-2xl font-bold text-foreground">Додати техніку для клієнта</h1>
        <p className="mt-3 text-sm leading-6 text-muted">Власника визначено сервером із адреси профілю клієнта.</p>
      </section>

      <section className="rounded-lg border border-border bg-card p-6 shadow-card">
        <p className="text-xs font-bold uppercase text-muted">Ви додаєте техніку для</p>
        <h2 className="mt-2 text-xl font-bold text-foreground">{clientName}</h2>
        <div className="mt-3 grid gap-1 text-sm text-muted">
          <p>Email: {client.email ?? client.user.email ?? 'не вказано'}</p>
          <p>Телефон: {client.phone ?? client.user.phone ?? 'не вказано'}</p>
        </div>
        <div className="mt-6 rounded-md border border-accent/30 bg-[#FFF7E0] p-4 text-sm font-semibold text-[#8A5B24]">
          Форма створення буде реалізована на наступному етапі.
        </div>
      </section>
    </div>
  );
}
