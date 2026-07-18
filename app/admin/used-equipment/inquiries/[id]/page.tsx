import type { UsedEquipmentInquiryStatus, UsedEquipmentStatus } from '@prisma/client';
import Image from 'next/image';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import type { ReactNode } from 'react';
import { FaExternalLinkAlt, FaPen, FaPhoneAlt } from 'react-icons/fa';
import { TbPhotoOff } from 'react-icons/tb';

import { AdminDbBlocker } from '@/components/admin/admin-db-blocker';
import { AdminUsedEquipmentInquiryForm } from '@/components/used-equipment/admin-used-equipment-inquiry-form';
import { requireCrmSession } from '@/lib/admin/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { getAdminUsedEquipmentInquiryById, getUsedEquipmentInquiryAssignees } from '@/lib/used-equipment/queries';
import {
  getUsedEquipmentInquirySourceLabel,
  getUsedEquipmentInquiryStatusLabel,
  getUsedEquipmentStatusLabel
} from '@/lib/used-equipment/status';
import { getEquipmentTypeLabel } from '@/lib/vehicles/equipment-types';

export const dynamic = 'force-dynamic';

type PageParams = {
  id: string;
};

type PageProps = {
  params: Promise<PageParams>;
};

type InquiryDetail = NonNullable<Awaited<ReturnType<typeof getAdminUsedEquipmentInquiryById>>>;

const inquiryStatusTone: Record<UsedEquipmentInquiryStatus, string> = {
  NEW: 'border-accent/30 bg-accent/10 text-[#8A5B24]',
  IN_PROGRESS: 'border-blue-200 bg-blue-50 text-blue-700',
  COMPLETED: 'border-success/20 bg-[#E7F6EC] text-success',
  CANCELLED: 'border-border bg-surface-muted text-muted'
};

const equipmentStatusTone: Record<UsedEquipmentStatus, string> = {
  DRAFT: 'border-border bg-surface-muted text-muted',
  PUBLISHED: 'border-success/20 bg-[#E7F6EC] text-success',
  ARCHIVED: 'border-border bg-muted/10 text-muted'
};

function dateTimeLabel(value: Date | null) {
  return value ? value.toLocaleString('uk-UA') : '—';
}

function assigneeLabel(assignee: InquiryDetail['assignedManager']) {
  return assignee?.name || assignee?.email || 'Не призначено';
}

function InquiryStatusBadge({ status }: { status: UsedEquipmentInquiryStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${inquiryStatusTone[status]}`}>
      {getUsedEquipmentInquiryStatusLabel(status)}
    </span>
  );
}

function EquipmentStatusBadge({ status }: { status: UsedEquipmentStatus }) {
  return (
    <span className={`inline-flex rounded-full border px-3 py-1 text-xs font-bold ${equipmentStatusTone[status]}`}>
      {getUsedEquipmentStatusLabel(status)}
    </span>
  );
}

function Thumbnail({ inquiry }: { inquiry: InquiryDetail }) {
  const image = inquiry.usedEquipment.images[0];

  if (!image) {
    return (
      <div className="flex aspect-[4/3] w-full items-center justify-center rounded-lg border border-dashed border-border bg-surface-muted text-muted">
        <TbPhotoOff aria-hidden="true" className="size-10" />
        <span className="sr-only">Фото відсутнє</span>
      </div>
    );
  }

  return (
    <Image
      src={image.url}
      alt={image.alt ?? inquiry.equipmentTitle}
      width={image.width ?? 640}
      height={image.height ?? 480}
      sizes="(min-width: 1024px) 360px, 100vw"
      unoptimized
      className="aspect-[4/3] w-full rounded-lg object-cover"
    />
  );
}

function DetailRow({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="rounded-md border border-border p-3">
      <dt className="text-xs font-bold uppercase text-muted">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold text-foreground">{value}</dd>
    </div>
  );
}

function ModuleNav() {
  return (
    <div className="flex flex-wrap gap-2">
      <Link
        href="/admin/used-equipment/items"
        className="rounded-md border border-border bg-card px-4 py-2 text-sm font-bold text-foreground transition hover:border-accent hover:text-accent"
      >
        Техніка
      </Link>
      <Link href="/admin/used-equipment/inquiries" className="rounded-md bg-accent px-4 py-2 text-sm font-bold text-foreground">
        Заявки на перегляд
      </Link>
    </div>
  );
}

export default async function AdminUsedEquipmentInquiryDetailPage({ params }: PageProps) {
  await requireCrmSession();
  const { id } = await params;

  if (!hasDatabaseUrl()) {
    return <AdminDbBlocker />;
  }

  const [inquiry, assignees] = await Promise.all([getAdminUsedEquipmentInquiryById(id), getUsedEquipmentInquiryAssignees()]);

  if (!inquiry) {
    notFound();
  }

  const currentTitleChanged = inquiry.usedEquipment.title !== inquiry.equipmentTitle;
  const publicLinkAvailable = inquiry.usedEquipment.status === 'PUBLISHED';

  return (
    <div className="grid gap-6">
      <section className="rounded-lg border border-border bg-card p-6 shadow-card">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <Link href="/admin/used-equipment/inquiries" className="text-sm font-bold text-muted transition hover:text-accent">
              ← Повернутися до заявок
            </Link>
            <p className="mt-4 text-sm font-bold uppercase text-accent">Заявка на перегляд техніки</p>
            <h2 className="mt-2 text-2xl font-bold text-foreground">{inquiry.equipmentTitle}</h2>
            <p className="mt-2 text-sm leading-6 text-muted">Створено: {dateTimeLabel(inquiry.createdAt)}</p>
          </div>
          <div className="grid gap-3 sm:min-w-72">
            <div className="rounded-md border border-border p-4">
              <p className="text-xs font-bold uppercase text-muted">Статус звернення</p>
              <div className="mt-2">
                <InquiryStatusBadge status={inquiry.status} />
              </div>
            </div>
            <div className="rounded-md border border-border p-4">
              <p className="text-xs font-bold uppercase text-muted">Відповідальний</p>
              <p className="mt-2 text-sm font-bold text-foreground">{assigneeLabel(inquiry.assignedManager)}</p>
            </div>
          </div>
        </div>
      </section>

      <ModuleNav />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px] xl:items-start">
        <div className="grid gap-6">
          <section className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
            <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
              <Thumbnail inquiry={inquiry} />
              <div>
                <div className="flex flex-wrap gap-2">
                  <EquipmentStatusBadge status={inquiry.usedEquipment.status} />
                  <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-bold text-muted">
                    {getEquipmentTypeLabel(inquiry.usedEquipment.equipmentType)}
                  </span>
                </div>
                <h3 className="mt-4 text-xl font-bold text-foreground">{inquiry.equipmentTitle}</h3>
                {currentTitleChanged ? (
                  <p className="mt-2 text-sm leading-6 text-muted">Поточна картка: {inquiry.usedEquipment.title}</p>
                ) : null}

                <dl className="mt-5 grid gap-3 sm:grid-cols-2">
                  <DetailRow label="Виробник" value={inquiry.usedEquipment.manufacturerName} />
                  <DetailRow label="Рік" value={inquiry.usedEquipment.year ?? '—'} />
                  <DetailRow label="Статус техніки" value={getUsedEquipmentStatusLabel(inquiry.usedEquipment.status)} />
                  <DetailRow label="Тип техніки" value={getEquipmentTypeLabel(inquiry.usedEquipment.equipmentType)} />
                </dl>

                {inquiry.usedEquipment.internalComment ? (
                  <div className="mt-4 rounded-md border border-border bg-surface-muted p-3">
                    <p className="text-xs font-bold uppercase text-muted">Внутрішній коментар техніки</p>
                    <p className="mt-2 whitespace-pre-wrap text-sm leading-6 text-foreground">{inquiry.usedEquipment.internalComment}</p>
                  </div>
                ) : null}

                <div className="mt-5 flex flex-col gap-2 sm:flex-row">
                  <Link
                    href={`/admin/used-equipment/items/${inquiry.usedEquipment.id}/edit`}
                    className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border px-4 text-sm font-bold text-foreground transition hover:border-accent hover:text-accent"
                  >
                    <FaPen aria-hidden="true" className="size-3" />
                    Редагувати техніку
                  </Link>
                  {publicLinkAvailable ? (
                    <Link
                      href={`/used-equipment/${inquiry.usedEquipment.slug}`}
                      className="inline-flex h-10 items-center justify-center gap-2 rounded-md border border-border px-4 text-sm font-bold text-foreground transition hover:border-accent hover:text-accent"
                    >
                      <FaExternalLinkAlt aria-hidden="true" className="size-3" />
                      Публічна сторінка
                    </Link>
                  ) : null}
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
            <p className="text-sm font-bold uppercase text-accent">Контакт клієнта</p>
            <h3 className="mt-2 text-xl font-bold text-foreground">{inquiry.name}</h3>
            <dl className="mt-5 grid gap-3 sm:grid-cols-2">
              <DetailRow label="Ім’я" value={inquiry.name} />
              <DetailRow
                label="Телефон"
                value={
                  <a href={`tel:${inquiry.phone}`} className="inline-flex items-center gap-2 transition hover:text-accent" aria-label={`Подзвонити ${inquiry.phone}`}>
                    <FaPhoneAlt aria-hidden="true" className="size-3" />
                    {inquiry.phone}
                  </a>
                }
              />
              <DetailRow label="Джерело" value={getUsedEquipmentInquirySourceLabel(inquiry.source)} />
              <DetailRow label="Дата створення" value={dateTimeLabel(inquiry.createdAt)} />
              <DetailRow label="Дата оновлення" value={dateTimeLabel(inquiry.updatedAt)} />
              <DetailRow label="Дата обробки" value={dateTimeLabel(inquiry.processedAt)} />
            </dl>
          </section>
        </div>

        <aside className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
          <p className="text-sm font-bold uppercase text-accent">Обробка звернення</p>
          <h3 className="mt-2 text-xl font-bold text-foreground">CRM-дії</h3>
          <p className="mt-2 text-sm leading-6 text-muted">
            Змінюйте статус, відповідального та внутрішній коментар. Історичні дані звернення не редагуються.
          </p>
          <div className="mt-5">
            <AdminUsedEquipmentInquiryForm
              inquiryId={inquiry.id}
              status={inquiry.status}
              assignedManagerId={inquiry.assignedManagerId}
              internalComment={inquiry.internalComment}
              assignees={assignees}
            />
          </div>
        </aside>
      </div>
    </div>
  );
}
