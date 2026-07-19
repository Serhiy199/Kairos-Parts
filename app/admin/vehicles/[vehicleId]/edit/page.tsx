import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FaArrowLeft, FaTractor } from 'react-icons/fa';

import { updateAdminVehicle } from '@/app/admin/vehicles/actions';
import { AdminDbBlocker } from '@/components/admin/admin-db-blocker';
import { AdminVehicleForm } from '@/components/vehicles/admin-vehicle-form';
import { requireCrmSession } from '@/lib/admin/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';
import { getAdminVehicleManufacturerOptions } from '@/lib/vehicles/admin-manufacturers';
import type { AdminVehicleFormValues } from '@/lib/vehicles/admin-validation';
import { isValidVehicleOwnership } from '@/lib/vehicles/ownership';

export const dynamic = 'force-dynamic';

export default async function AdminVehicleEditPage({
  params
}: {
  params: Promise<{ vehicleId: string }>;
}) {
  await requireCrmSession();
  const { vehicleId } = await params;

  if (!hasDatabaseUrl()) {
    return <AdminDbBlocker />;
  }

  const [vehicle, manufacturers] = await Promise.all([
    prisma.vehicle.findUnique({
      where: { id: vehicleId },
      select: {
        id: true,
        clientId: true,
        companyId: true,
        type: true,
        manufacturer: true,
        model: true,
        year: true,
        vinOrSerial: true,
        comment: true,
        client: {
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
                email: true,
                role: true
              }
            }
          }
        },
        company: {
          select: {
            id: true,
            name: true,
            edrpou: true
          }
        }
      }
    }),
    getAdminVehicleManufacturerOptions()
  ]);

  if (!vehicle || !isValidVehicleOwnership(vehicle)) {
    notFound();
  }

  const matchingManufacturer = manufacturers.find(
    (manufacturer) => manufacturer.name.toLocaleLowerCase('uk-UA') === vehicle.manufacturer.toLocaleLowerCase('uk-UA')
  );

  const initialValues: AdminVehicleFormValues = {
    equipmentType: vehicle.type,
    manufacturerId: matchingManufacturer?.value ?? '',
    model: vehicle.model,
    year: vehicle.year ? String(vehicle.year) : '',
    vinOrSerial: vehicle.vinOrSerial ?? '',
    comment: vehicle.comment ?? ''
  };

  let owner: { type: 'company' | 'client'; name: string; meta?: string };
  let profileHref: string;

  if (vehicle.companyId) {
    if (!vehicle.company) {
      notFound();
    }

    owner = {
      type: 'company',
      name: vehicle.company.name,
      meta: vehicle.company.edrpou ? `ЄДРПОУ: ${vehicle.company.edrpou}` : 'ЄДРПОУ не вказано'
    };
    profileHref = `/admin/companies/${vehicle.company.id}`;
  } else {
    if (!vehicle.client || vehicle.client.user.role !== 'CLIENT') {
      notFound();
    }

    const profileName = [vehicle.client.firstName, vehicle.client.lastName].filter(Boolean).join(' ');
    const clientName = vehicle.client.contactName ?? (profileName || vehicle.client.user.name || 'Клієнт');
    const contactMeta = [
      vehicle.client.email ?? vehicle.client.user.email,
      vehicle.client.phone ?? vehicle.client.user.phone
    ].filter(Boolean).join(' · ') || 'Контактні дані не вказано';

    owner = { type: 'client', name: clientName, meta: contactMeta };
    profileHref = `/admin/clients/${vehicle.client.id}`;
  }

  const action = updateAdminVehicle.bind(null, vehicle.id);

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-border bg-card p-6 shadow-card">
        <Link href={`${profileHref}#fleet`} className="inline-flex items-center gap-2 text-sm font-semibold text-muted transition hover:text-accent">
          <FaArrowLeft aria-hidden="true" className="size-3" />
          До парку техніки
        </Link>
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
            <FaTractor aria-hidden="true" className="size-7" />
          </div>
          <div>
            <p className="text-sm font-bold uppercase text-accent">Редагування техніки</p>
            <h1 className="mt-2 text-2xl font-bold text-foreground">
              {vehicle.manufacturer} {vehicle.model}
            </h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Можна змінити лише характеристики. Власник техніки залишається незмінним.
            </p>
          </div>
        </div>
      </section>

      <AdminVehicleForm
        action={action}
        mode="edit"
        owner={owner}
        manufacturers={manufacturers}
        initialValues={initialValues}
        cancelHref={`${profileHref}#fleet`}
      />
    </div>
  );
}
