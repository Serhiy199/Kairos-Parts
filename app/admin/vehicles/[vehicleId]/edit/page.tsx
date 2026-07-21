import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FaArrowLeft, FaTractor } from 'react-icons/fa';

import { updateAdminVehicle } from '@/app/admin/vehicles/actions';
import { deleteAdminVehicleImage, reorderAdminVehicleImages, setPrimaryVehicleImage, uploadAdminVehicleImages } from '@/app/admin/vehicles/image-actions';
import { AdminDbBlocker } from '@/components/admin/admin-db-blocker';
import { AdminVehicleForm } from '@/components/vehicles/admin-vehicle-form';
import { VehicleDocumentManager } from '@/components/vehicles/vehicle-document-manager';
import { VehicleImageManager } from '@/components/vehicles/vehicle-image-manager';
import { requireCrmSession } from '@/lib/admin/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { EQUIPMENT_TAXONOMY_VEHICLE_FIELDS_ENABLED } from '@/lib/features/equipment-taxonomy';
import { prisma } from '@/lib/prisma';
import type { AdminVehicleFormValues } from '@/lib/vehicles/admin-validation';
import { isValidVehicleOwnership } from '@/lib/vehicles/ownership';
import { getActiveEquipmentTaxonomy } from '@/lib/vehicles/taxonomy';

export const dynamic = 'force-dynamic';

export default async function AdminVehicleEditPage({
  params,
  searchParams
}: {
  params: Promise<{ vehicleId: string }>;
  searchParams: Promise<{ created?: string }>;
}) {
  await requireCrmSession();
  const { vehicleId } = await params;
  const query = await searchParams;

  if (!hasDatabaseUrl()) {
    return <AdminDbBlocker />;
  }

  const vehicle = await prisma.vehicle.findUnique({
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
        images: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: { id: true, secureUrl: true, width: true, height: true, sortOrder: true, isPrimary: true }
        },
        documents: {
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            fileName: true,
            mimeType: true,
            size: true,
            visibleToClient: true,
            createdAt: true,
            uploadedBy: { select: { name: true, email: true } }
          }
        },
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
    });

  if (!vehicle || !isValidVehicleOwnership(vehicle)) {
    notFound();
  }

  const taxonomy = EQUIPMENT_TAXONOMY_VEHICLE_FIELDS_ENABLED
    ? await getActiveEquipmentTaxonomy({
        equipmentType: vehicle.type,
        manufacturer: vehicle.manufacturer
      })
    : [];
  const matchingManufacturer = taxonomy
    .flatMap((type) => type.manufacturers)
    .find((manufacturer) => manufacturer.name.toLocaleLowerCase('uk-UA') === vehicle.manufacturer.toLocaleLowerCase('uk-UA'));

  const initialValues: AdminVehicleFormValues = {
    equipmentType: vehicle.type,
    manufacturerId: matchingManufacturer?.id ?? '',
    manufacturer: vehicle.manufacturer,
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
  const uploadAction = uploadAdminVehicleImages.bind(null, vehicle.id);
  const setPrimaryAction = setPrimaryVehicleImage.bind(null, vehicle.id);
  const reorderAction = reorderAdminVehicleImages.bind(null, vehicle.id);
  const deleteAction = deleteAdminVehicleImage.bind(null, vehicle.id);

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

      {query.created === '1' ? (
        <div className="rounded-md border border-success/30 bg-[#E7F6EC] px-4 py-3 text-sm font-semibold text-success" aria-live="polite">
          Техніку створено. Тепер додайте фотографії.
        </div>
      ) : null}

      <AdminVehicleForm
        action={action}
        mode="edit"
        owner={owner}
        taxonomy={taxonomy}
        initialValues={initialValues}
        cancelHref={`${profileHref}#fleet`}
      />

      <div id="photos" className="scroll-mt-6">
        <VehicleImageManager
          vehicleId={vehicle.id}
          vehicleLabel={`${vehicle.manufacturer} ${vehicle.model}`}
          images={vehicle.images}
          uploadAction={uploadAction}
          setPrimaryAction={setPrimaryAction}
          reorderAction={reorderAction}
          deleteAction={deleteAction}
        />
      </div>

      {query.created === '1' ? (
        <div className="flex justify-end">
          <Link href={`${profileHref}#fleet`} className="inline-flex min-h-11 items-center justify-center rounded-md border border-border px-5 py-3 text-sm font-bold text-foreground transition hover:border-accent hover:bg-surface-muted">
            Завершити
          </Link>
        </div>
      ) : null}

      <VehicleDocumentManager vehicleId={vehicle.id} documents={vehicle.documents} />
    </div>
  );
}
