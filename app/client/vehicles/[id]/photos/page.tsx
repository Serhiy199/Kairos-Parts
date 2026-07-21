import Link from 'next/link';
import { notFound } from 'next/navigation';
import { LuArrowRight, LuImages } from 'react-icons/lu';

import { deleteClientVehicleImage, reorderClientVehicleImages, setPrimaryClientVehicleImage, uploadClientVehicleImages } from '@/app/client/vehicles/image-actions';
import { VehicleImageManager } from '@/components/vehicles/vehicle-image-manager';
import { getClientAccessContext, requireClientSession, vehicleAccessWhere } from '@/lib/client/access';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

export default async function ClientVehiclePhotosPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ upload?: string }>;
}) {
  const session = await requireClientSession();
  const access = await getClientAccessContext(session.user.id);
  if (!access) notFound();
  const { id } = await params;
  const vehicle = await prisma.vehicle.findFirst({
    where: { id, AND: [vehicleAccessWhere(access)] },
    select: {
      id: true, manufacturer: true, model: true,
      images: { orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], select: { id: true, secureUrl: true, width: true, height: true, sortOrder: true, isPrimary: true } }
    }
  });
  if (!vehicle) notFound();
  const query = await searchParams;

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-border bg-card p-6 shadow-card">
        <div className="flex size-12 items-center justify-center rounded-md bg-accent/10 text-accent"><LuImages aria-hidden="true" className="size-6" /></div>
        <p className="mt-5 text-sm font-bold uppercase text-accent">Техніку створено</p>
        <h1 className="mt-2 text-2xl font-bold text-foreground">Додайте фотографії</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">Додайте фотографії, щоб техніку було легше ідентифікувати в парку та заявках. Цей крок можна пропустити.</p>
      </section>

      {query.upload === 'failed' ? (
        <div role="alert" className="rounded-md border border-danger/30 bg-[#FEF3F2] p-4 text-sm font-semibold text-danger">
          Техніку створено, але фотографії не вдалося завантажити. Виберіть файли ще раз і повторіть завантаження.
        </div>
      ) : null}

      <VehicleImageManager
        vehicleId={vehicle.id}
        vehicleLabel={`${vehicle.manufacturer} ${vehicle.model}`}
        images={vehicle.images}
        uploadAction={uploadClientVehicleImages.bind(null, vehicle.id)}
        setPrimaryAction={setPrimaryClientVehicleImage.bind(null, vehicle.id)}
        reorderAction={reorderClientVehicleImages.bind(null, vehicle.id)}
        deleteAction={deleteClientVehicleImage.bind(null, vehicle.id)}
      />

      <div className="flex justify-end">
        <Link href={`/client/vehicles/${vehicle.id}`} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md border border-border px-5 py-3 text-sm font-bold text-foreground transition hover:border-accent hover:bg-surface-muted">
          Пропустити й перейти до техніки <LuArrowRight aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
