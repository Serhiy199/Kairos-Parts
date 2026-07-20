import Link from 'next/link';
import { notFound } from 'next/navigation';
import { FaArrowLeft, FaTractor } from 'react-icons/fa';

import { createAdminVehicleForCompany } from '@/app/admin/vehicles/actions';
import { AdminDbBlocker } from '@/components/admin/admin-db-blocker';
import { AdminVehicleForm } from '@/components/vehicles/admin-vehicle-form';
import { requireCrmSession } from '@/lib/admin/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';
import { EMPTY_ADMIN_VEHICLE_FORM_VALUES } from '@/lib/vehicles/admin-validation';
import { getActiveEquipmentTaxonomy } from '@/lib/vehicles/taxonomy';

export const dynamic = 'force-dynamic';

export default async function AdminCompanyVehicleCreatePage({
  params
}: {
  params: Promise<{ id: string }>;
}) {
  await requireCrmSession();
  const { id } = await params;

  if (!hasDatabaseUrl()) {
    return <AdminDbBlocker />;
  }

  const [company, taxonomy] = await Promise.all([
    prisma.company.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
        edrpou: true
      }
    }),
    getActiveEquipmentTaxonomy()
  ]);

  if (!company) {
    notFound();
  }

  const action = createAdminVehicleForCompany.bind(null, company.id);
  const profileHref = `/admin/companies/${company.id}`;

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-border bg-card p-6 shadow-card">
        <Link href={profileHref} className="inline-flex items-center gap-2 text-sm font-semibold text-muted transition hover:text-accent">
          <FaArrowLeft aria-hidden="true" className="size-3" />
          До профілю компанії
        </Link>
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
            <FaTractor aria-hidden="true" className="size-7" />
          </div>
          <div>
            <p className="text-sm font-bold uppercase text-accent">Парк техніки</p>
            <h1 className="mt-2 text-2xl font-bold text-foreground">Додати техніку для компанії</h1>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Заповніть характеристики техніки. Власника визначено сервером із CRM-профілю компанії.
            </p>
          </div>
        </div>
      </section>

      <AdminVehicleForm
        action={action}
        mode="create"
        owner={{
          type: 'company',
          name: company.name,
          meta: company.edrpou ? `ЄДРПОУ: ${company.edrpou}` : 'ЄДРПОУ не вказано'
        }}
        taxonomy={taxonomy}
        initialValues={EMPTY_ADMIN_VEHICLE_FORM_VALUES}
        cancelHref={profileHref}
      />
    </div>
  );
}
