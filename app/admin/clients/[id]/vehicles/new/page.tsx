import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FaArrowLeft, FaTractor } from 'react-icons/fa';

import { createAdminVehicleForClient } from '@/app/admin/vehicles/actions';
import { AdminDbBlocker } from '@/components/admin/admin-db-blocker';
import { AdminVehicleForm } from '@/components/vehicles/admin-vehicle-form';
import { requireCrmSession } from '@/lib/admin/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';
import { EMPTY_ADMIN_VEHICLE_FORM_VALUES } from '@/lib/vehicles/admin-validation';
import { getActiveEquipmentTaxonomy } from '@/lib/vehicles/taxonomy';

export const dynamic = 'force-dynamic';

export default async function AdminClientVehicleCreatePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCrmSession();
  const { id } = await params;

  if (!hasDatabaseUrl()) {
    return <AdminDbBlocker />;
  }

  const [client, taxonomy] = await Promise.all([
    prisma.clientProfile.findFirst({
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
    }),
    getActiveEquipmentTaxonomy()
  ]);

  if (!client) {
    notFound();
  }

  const profileName = [client.firstName, client.lastName].filter(Boolean).join(' ');
  const clientName = client.contactName ?? (profileName || client.user.name || 'Клієнт');
  const profileHref = `/admin/clients/${client.id}`;
  const action = createAdminVehicleForClient.bind(null, client.id);
  const contactMeta = [
    client.email ?? client.user.email,
    client.phone ?? client.user.phone
  ].filter(Boolean).join(' · ') || 'Контактні дані не вказано';

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-border bg-card p-6 shadow-card">
        <Link href={profileHref} className="inline-flex items-center gap-2 text-sm font-semibold text-muted transition hover:text-accent">
          <FaArrowLeft aria-hidden="true" className="size-3" />
          До профілю клієнта
        </Link>
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
            <FaTractor aria-hidden="true" className="size-7" />
          </div>
          <div>
            <p className="text-sm font-bold uppercase text-accent">Парк техніки</p>
            <h1 className="mt-2 text-2xl font-bold text-foreground">Додати техніку для клієнта</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Заповніть характеристики техніки. Власника визначено сервером із CRM-профілю клієнта.
            </p>
          </div>
        </div>
      </section>

      <AdminVehicleForm
        action={action}
        mode="create"
        owner={{ type: 'client', name: clientName, meta: contactMeta }}
        taxonomy={taxonomy}
        initialValues={EMPTY_ADMIN_VEHICLE_FORM_VALUES}
        cancelHref={profileHref}
      />
    </div>
  );
}
