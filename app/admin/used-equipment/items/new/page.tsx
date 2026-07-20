import Link from 'next/link';
import { FaArrowLeft, FaTractor } from 'react-icons/fa';

import { AdminDbBlocker } from '@/components/admin/admin-db-blocker';
import { UsedEquipmentForm } from '@/components/used-equipment/used-equipment-form';
import { requireCrmSession } from '@/lib/admin/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { createUsedEquipment } from '@/app/admin/used-equipment/items/actions';
import type { UsedEquipmentFormValues } from '@/lib/used-equipment/validation';
import { getActiveEquipmentTaxonomy } from '@/lib/vehicles/taxonomy';

export const dynamic = 'force-dynamic';

const initialValues: UsedEquipmentFormValues = {
  title: '',
  equipmentType: '',
  manufacturerId: '',
  year: '',
  description: '',
  internalComment: '',
  status: 'DRAFT'
};

export default async function AdminUsedEquipmentNewPage() {
  await requireCrmSession();

  if (!hasDatabaseUrl()) {
    return <AdminDbBlocker />;
  }

  const taxonomy = await getActiveEquipmentTaxonomy();

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-border bg-card p-6 shadow-card">
        <Link href="/admin/used-equipment/items" className="inline-flex items-center gap-2 text-sm font-semibold text-muted transition hover:text-accent">
          <FaArrowLeft aria-hidden="true" className="size-3" />
          До списку БВ техніки
        </Link>
        <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-start">
          <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
            <FaTractor aria-hidden="true" className="size-7" />
          </div>
          <div>
            <p className="text-sm font-bold uppercase text-accent">Майданчик БВ техніки</p>
            <h2 className="mt-2 text-2xl font-bold text-foreground">Додати БВ техніку</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
              Заповніть базові дані. Запис буде створено як чернетку, а публікація стане доступною після додавання фото.
            </p>
          </div>
        </div>
      </section>

      <UsedEquipmentForm action={createUsedEquipment} mode="create" taxonomy={taxonomy} initialValues={initialValues} />
    </div>
  );
}
