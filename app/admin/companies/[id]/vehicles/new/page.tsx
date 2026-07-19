import Link from 'next/link';
import { notFound } from 'next/navigation';

import { AdminDbBlocker } from '@/components/admin/admin-db-blocker';
import { requireCrmSession } from '@/lib/admin/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function AdminCompanyVehicleCreateFoundationPage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCrmSession();
  const { id } = await params;

  if (!hasDatabaseUrl()) {
    return <AdminDbBlocker />;
  }

  const company = await prisma.company.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      edrpou: true
    }
  });

  if (!company) {
    notFound();
  }

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-border bg-card p-6 shadow-card">
        <Link href={`/admin/companies/${company.id}`} className="text-sm font-semibold text-muted transition hover:text-accent">
          ← До профілю компанії
        </Link>
        <p className="mt-5 text-sm font-bold uppercase text-accent">Парк техніки</p>
        <h1 className="mt-2 text-2xl font-bold text-foreground">Додати техніку для компанії</h1>
        <p className="mt-3 text-sm leading-6 text-muted">Власника визначено сервером із адреси профілю компанії.</p>
      </section>

      <section className="rounded-lg border border-border bg-card p-6 shadow-card">
        <p className="text-xs font-bold uppercase text-muted">Ви додаєте техніку для</p>
        <h2 className="mt-2 text-xl font-bold text-foreground">{company.name}</h2>
        <p className="mt-2 text-sm text-muted">{company.edrpou ? `ЄДРПОУ: ${company.edrpou}` : 'ЄДРПОУ не вказано'}</p>
        <div className="mt-6 rounded-md border border-accent/30 bg-[#FFF7E0] p-4 text-sm font-semibold text-[#8A5B24]">
          Форма створення буде реалізована на наступному етапі.
        </div>
      </section>
    </div>
  );
}
