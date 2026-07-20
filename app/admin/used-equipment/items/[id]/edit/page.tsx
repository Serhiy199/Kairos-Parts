import { notFound } from 'next/navigation';
import Link from 'next/link';
import { FaArrowLeft, FaTractor } from 'react-icons/fa';

import { updateUsedEquipment } from '@/app/admin/used-equipment/items/actions';
import { AdminDbBlocker } from '@/components/admin/admin-db-blocker';
import { SafeRichText } from '@/components/ui/safe-rich-text';
import { UsedEquipmentForm } from '@/components/used-equipment/used-equipment-form';
import { requireCrmSession } from '@/lib/admin/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';
import { normalizeUsedEquipmentDescriptionForEditor } from '@/lib/used-equipment/description';
import { getUsedEquipmentStatusLabel } from '@/lib/used-equipment/status';
import type { UsedEquipmentFormValues } from '@/lib/used-equipment/validation';
import { getActiveEquipmentTaxonomy } from '@/lib/vehicles/taxonomy';

export const dynamic = 'force-dynamic';

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function AdminUsedEquipmentEditPage({ params }: PageProps) {
  await requireCrmSession();
  const { id } = await params;

  if (!hasDatabaseUrl()) {
    return <AdminDbBlocker />;
  }

  const item = await prisma.usedEquipment.findUnique({
      where: { id },
      select: {
        id: true,
        slug: true,
        title: true,
        equipmentType: true,
        manufacturerId: true,
        manufacturerName: true,
        year: true,
        description: true,
        internalComment: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        images: {
          orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }],
          select: {
            id: true,
            url: true,
            alt: true,
            width: true,
            height: true,
            isPrimary: true,
            sortOrder: true
          }
        },
        _count: {
          select: {
            images: true,
            inquiries: true
          }
        }
      }
    });

  if (!item) {
    notFound();
  }

  const taxonomy = await getActiveEquipmentTaxonomy({
    equipmentType: item.equipmentType,
    manufacturer: item.manufacturerName
  });

  const initialValues: UsedEquipmentFormValues = {
    title: item.title,
    equipmentType: item.equipmentType,
    manufacturerId: item.manufacturerId ?? '',
    year: item.year ? String(item.year) : '',
    description: normalizeUsedEquipmentDescriptionForEditor(item.description),
    internalComment: item.internalComment ?? '',
    status: item.status
  };

  const action = updateUsedEquipment.bind(null, item.id);

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-border bg-card p-6 shadow-card">
        <Link href="/admin/used-equipment/items" className="inline-flex items-center gap-2 text-sm font-semibold text-muted transition hover:text-accent">
          <FaArrowLeft aria-hidden="true" className="size-3" />
          До списку БВ техніки
        </Link>
        <div className="mt-6 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="flex size-14 shrink-0 items-center justify-center rounded-full bg-accent/10 text-accent">
              <FaTractor aria-hidden="true" className="size-7" />
            </div>
            <div>
              <p className="text-sm font-bold uppercase text-accent">Редагування БВ техніки</p>
              <h2 className="mt-2 text-2xl font-bold text-foreground">{item.title}</h2>
              <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
                Slug: <span className="font-semibold text-foreground">{item.slug}</span>. Статус: {getUsedEquipmentStatusLabel(item.status)}.
              </p>
            </div>
          </div>
          <div className="grid gap-2 rounded-md border border-border bg-surface-muted px-4 py-3 text-sm text-muted">
            <p>
              Фото: <span className="font-bold text-foreground">{item._count.images}</span>
            </p>
            <p>
              Заявки: <span className="font-bold text-foreground">{item._count.inquiries}</span>
            </p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-card p-6 shadow-card">
        <p className="text-sm font-bold uppercase text-accent">Попередній перегляд опису</p>
        <div className="mt-4 rounded-md border border-border bg-surface-muted p-4">
          <SafeRichText html={item.description} />
        </div>
      </section>

      <UsedEquipmentForm
        action={action}
        mode="edit"
        taxonomy={taxonomy}
        initialValues={initialValues}
        hasImages={item.images.length > 0}
        existingImages={item.images}
      />
    </div>
  );
}
