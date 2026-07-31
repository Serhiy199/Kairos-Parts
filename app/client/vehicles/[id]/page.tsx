import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TbArrowLeft, TbBuilding, TbUser } from 'react-icons/tb';

import { ContextualChangeRequestForm } from '@/app/client/change-requests/contextual-change-request-form';
import { updateClientVehicle } from '@/app/client/vehicles/actions';
import { deleteClientVehicleDocument } from '@/app/client/vehicles/document-actions';
import {
  deleteClientVehicleImage,
  reorderClientVehicleImages,
  setPrimaryClientVehicleImage,
  uploadClientVehicleImages
} from '@/app/client/vehicles/image-actions';
import { VehicleForm } from '@/app/client/vehicles/vehicle-form';
import { ClientDbBlocker } from '@/components/client/client-db-blocker';
import { StatusBadge } from '@/components/client/status-badge';
import { ClientVehicleDocumentManager } from '@/components/vehicles/client-vehicle-document-manager';
import { ClientVehicleGallery } from '@/components/vehicles/client-vehicle-gallery';
import { VehicleImageManager } from '@/components/vehicles/vehicle-image-manager';
import { getClientAccessContext, requireClientSession } from '@/lib/client/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { EQUIPMENT_TAXONOMY_VEHICLE_FIELDS_ENABLED } from '@/lib/features/equipment-taxonomy';
import { getClientVehicleDetail } from '@/lib/vehicles/client-queries';
import { getVehicleDisplay } from '@/lib/vehicles/name';
import { getActiveEquipmentTaxonomy } from '@/lib/vehicles/taxonomy';

export const dynamic = 'force-dynamic';

const CHANGE_RESULT_MESSAGES: Record<string, { tone: 'success' | 'error'; text: string }> = {
  created: { tone: 'success', text: 'Уточнення відправлено менеджеру.' },
  database: { tone: 'error', text: 'Сервіс тимчасово недоступний. Спробуйте пізніше.' },
  'invalid-entity-type': { tone: 'error', text: 'Некоректний тип об’єкта.' },
  'entity-id-required': { tone: 'error', text: 'Не вдалося визначити техніку.' },
  'invalid-action': { tone: 'error', text: 'Некоректна дія.' },
  'change-details-required': { tone: 'error', text: 'Вкажіть нове значення або причину зміни.' },
  'entity-not-found-or-forbidden': { tone: 'error', text: 'Техніку не знайдено або вона недоступна.' },
  'change-request-field-not-allowed': { tone: 'error', text: 'Це поле не можна змінити через запит.' },
  'change-request-invalid-value': { tone: 'error', text: 'Нове значення має некоректний формат.' },
  'change-request-no-changes': { tone: 'error', text: 'Зміни відсутні.' },
  'change-request-already-pending': { tone: 'error', text: 'Для цього поля вже є запит, який очікує погодження.' }
};

export default async function ClientVehicleDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ created?: string; updated?: string; assets?: string; cleanup?: string; error?: string; result?: string }>;
}) {
  const session = await requireClientSession();
  const { id } = await params;
  const query = await searchParams;

  if (!hasDatabaseUrl()) return <ClientDbBlocker />;

  const access = await getClientAccessContext(session.user.id);
  if (!access) return <ClientDbBlocker />;

  const vehicle = await getClientVehicleDetail(id, access);
  if (!vehicle) notFound();
  const taxonomy = EQUIPMENT_TAXONOMY_VEHICLE_FIELDS_ENABLED
    ? await getActiveEquipmentTaxonomy({ equipmentType: vehicle.type, manufacturer: vehicle.manufacturer })
    : [];

  const vehicleDisplay = getVehicleDisplay(vehicle);
  const vehicleLabel = vehicleDisplay.title;
  const isCompanyVehicle = vehicle.companyId !== null;
  const ownerLabel = isCompanyVehicle ? 'Техніка компанії' : 'Особиста техніка';
  const currentPath = `/client/vehicles/${vehicle.id}`;
  const changeMessage = query.result ? CHANGE_RESULT_MESSAGES[query.result] : null;

  return (
    <div className="grid min-w-0 gap-6">
      <nav aria-label="Навігація сторінки техніки">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link href="/client/vehicles" className="inline-flex items-center gap-2 text-sm font-semibold text-muted transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <TbArrowLeft aria-hidden="true" className="size-4" />
            Назад до парку техніки
          </Link>
        </div>
      </nav>

      {query.created ? (
        <div role="status" className="rounded-md border border-success/30 bg-[#E7F6EC] p-4 text-sm font-semibold text-success">Техніку та вибрані файли збережено.</div>
      ) : null}
      {query.updated ? (
        <div role="status" className="rounded-md border border-success/30 bg-[#E7F6EC] p-4 text-sm font-semibold text-success">Дані техніки та вибрані файли збережено.</div>
      ) : null}
      {query.assets === 'partial' ? (
        <div role="alert" className="rounded-md border border-warning/30 bg-[#FFF7E0] p-4 text-sm font-semibold text-[#8A5B24]">
          Основні дані збережено, але не всі вибрані файли вдалося додати. Перевірте списки нижче та повторіть завантаження за потреби.
        </div>
      ) : null}
      {query.cleanup === 'failed' ? (
        <div role="alert" className="rounded-md border border-danger/30 bg-danger/10 p-4 text-sm font-semibold text-danger">
          Частину тимчасово завантажених файлів не вдалося автоматично очистити. Подію зафіксовано для технічної перевірки.
        </div>
      ) : null}
      {query.error ? (
        <div role="alert" className="rounded-md border border-danger/30 bg-[#FEF3F2] p-4 text-sm font-semibold text-danger">
          {query.error === 'duplicate' ? 'Техніка з таким VIN або серійним номером уже є у доступному парку.' : 'Перевірте обов’язкові поля.'}
        </div>
      ) : null}
      {changeMessage ? (
        <div
          role={changeMessage.tone === 'error' ? 'alert' : 'status'}
          className={`rounded-md border p-4 text-sm font-semibold ${
            changeMessage.tone === 'error'
              ? 'border-danger/30 bg-[#FEF3F2] text-danger'
              : 'border-success/30 bg-[#E7F6EC] text-success'
          }`}
        >
          {changeMessage.text}
        </div>
      ) : null}

      <div className="grid min-w-0 gap-6 xl:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <ClientVehicleGallery vehicleLabel={vehicleLabel} images={vehicle.images} />

        <section aria-labelledby="vehicle-title" className="min-w-0 rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full bg-accent/15 px-3 py-1 text-xs font-bold text-accent-hover">
              {isCompanyVehicle ? <TbBuilding aria-hidden="true" /> : <TbUser aria-hidden="true" />}
              {ownerLabel}
            </span>
            {vehicle.archivedAt ? <span className="rounded-full bg-surface-muted px-3 py-1 text-xs font-bold text-muted">Архів</span> : null}
          </div>

          <h1 id="vehicle-title" className="mt-4 break-words text-2xl font-bold text-foreground sm:text-3xl">{vehicleLabel}</h1>
          {vehicleDisplay.secondary ? <p className="mt-2 text-sm font-semibold text-muted">{vehicleDisplay.secondary}</p> : null}
          <p className="mt-2 text-base font-semibold text-muted">{vehicle.type}</p>
          {isCompanyVehicle && vehicle.company?.name ? (
            <p className="mt-3 break-words text-sm font-semibold text-foreground">{vehicle.company.name}</p>
          ) : null}

          <dl className="mt-6 grid gap-4 border-t border-border pt-5">
            <VehicleFact label="Виробник" value={vehicle.manufacturer} />
            <VehicleFact label="Модель" value={vehicle.model} />
            <VehicleFact label="Рік" value={vehicle.year?.toString() ?? 'Не вказано'} />
            <VehicleFact label="VIN / серійний номер" value={vehicle.vinOrSerial ?? 'Не вказано'} breakWords />
          </dl>

          {!vehicle.archivedAt ? (
            <Link
              href={`/request?source=client&vehicleId=${vehicle.id}`}
              className="mt-6 inline-flex min-h-11 w-full items-center justify-center rounded-md bg-accent px-5 py-3 text-center text-sm font-bold text-foreground transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              Створити заявку по цій техніці
            </Link>
          ) : null}
        </section>
      </div>

      {vehicle.comment ? (
        <section aria-labelledby="vehicle-note-heading" className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
          <h2 id="vehicle-note-heading" className="text-xl font-bold text-foreground">Примітка</h2>
          <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6 text-muted">{vehicle.comment}</p>
        </section>
      ) : null}

      <section aria-labelledby="vehicle-edit-heading" className="grid gap-4">
        <div>
          <h2 id="vehicle-edit-heading" className="text-xl font-bold text-foreground">Редагувати техніку</h2>
          <p className="mt-2 text-sm leading-6 text-muted">Оновіть характеристики та додайте нові фото або документи одним збереженням.</p>
        </div>
        <VehicleForm
          action={updateClientVehicle.bind(null, vehicle.id)}
          submitLabel="Зберегти зміни"
          taxonomy={taxonomy}
          vehicle={vehicle}
          existingImageCount={vehicle.images.length}
          existingDocumentCount={vehicle.documents.length}
          existingDocumentBytes={vehicle.documents.reduce((total, document) => total + document.size, 0)}
        />
      </section>

      <VehicleImageManager
        vehicleId={vehicle.id}
        vehicleLabel={vehicleLabel}
        images={vehicle.images}
        uploadAction={uploadClientVehicleImages.bind(null, vehicle.id)}
        setPrimaryAction={setPrimaryClientVehicleImage.bind(null, vehicle.id)}
        reorderAction={reorderClientVehicleImages.bind(null, vehicle.id)}
        deleteAction={deleteClientVehicleImage.bind(null, vehicle.id)}
        showUpload={false}
      />

      <ClientVehicleDocumentManager
        documents={vehicle.documents.map((document) => ({
          id: document.id,
          fileName: document.fileName,
          mimeType: document.mimeType,
          size: document.size,
          source: document.source,
          createdAt: document.createdAt.toISOString(),
          canDelete: document.source === 'CLIENT' && document.uploadedById === session.user.id
        }))}
        deleteAction={deleteClientVehicleDocument.bind(null, vehicle.id)}
      />

      <div className="grid gap-4">
        {!vehicle.archivedAt ? (
          <ContextualChangeRequestForm
            title="Запросити архівацію техніки"
            description="Після погодження менеджером техніка отримає позначку архіву, але її історія не видаляється."
            entityType="VEHICLE"
            entityId={vehicle.id}
            action="ARCHIVE"
            redirectTo={currentPath}
            submitLabel="Запросити архівацію техніки"
            fieldOptions={[{ value: 'archive', label: 'Архівація техніки', currentValue: vehicleLabel }]}
          />
        ) : null}
      </div>

      <RelatedRequests requests={vehicle.requests} />
      <VehiclePartsHistory items={vehicle.requestItems} />
    </div>
  );
}

function VehicleFact({ label, value, breakWords = false }: { label: string; value: string; breakWords?: boolean }) {
  return (
    <div className="grid min-w-0 gap-1 sm:grid-cols-[150px_minmax(0,1fr)] sm:gap-4">
      <dt className="text-sm font-semibold text-muted">{label}</dt>
      <dd className={`text-sm font-bold text-foreground ${breakWords ? 'break-words' : ''}`}>{value}</dd>
    </div>
  );
}

type VehicleDetail = NonNullable<Awaited<ReturnType<typeof getClientVehicleDetail>>>;

function RelatedRequests({ requests }: { requests: VehicleDetail['requests'] }) {
  return (
    <section aria-labelledby="related-requests-heading" className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
      <h2 id="related-requests-heading" className="text-xl font-bold text-foreground">Пов’язані заявки</h2>
      <div className="mt-5 grid gap-3">
        {requests.length > 0 ? requests.map((request) => (
          <Link key={request.id} href={`/client/requests/${request.id}`} className="rounded-md border border-border p-4 transition hover:border-accent hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
            <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
              <div className="min-w-0">
                <p className="font-bold text-foreground">{request.requestNumber}</p>
                <p className="mt-1 line-clamp-2 break-words text-sm text-muted">{request.description}</p>
                <p className="mt-1 text-xs text-muted">{request.createdAt.toLocaleDateString('uk-UA')}</p>
              </div>
              <StatusBadge status={request.status} />
            </div>
          </Link>
        )) : <p className="rounded-md border border-dashed border-border p-5 text-sm text-muted">По цій техніці ще немає заявок.</p>}
      </div>
    </section>
  );
}

function VehiclePartsHistory({ items }: { items: VehicleDetail['requestItems'] }) {
  return (
    <section aria-labelledby="parts-history-heading" className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
      <h2 id="parts-history-heading" className="text-xl font-bold text-foreground">Історія підібраних запчастин</h2>
      <p className="mt-2 text-sm text-muted">Позиції, які менеджер відкрив для клієнта по цій одиниці техніки.</p>
      <div className="mt-5 grid gap-3">
        {items.length > 0 ? items.map((item) => (
          <article key={item.id} className="rounded-md border border-border p-4">
            <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-muted">{item.request.createdAt.toLocaleDateString('uk-UA')} · {item.request.requestNumber}</p>
                <h3 className="mt-2 break-words font-bold text-foreground">
                  {item.name}{item.brand ? ` — ${item.brand}` : ''}{item.catalogNumber ? ` ${item.catalogNumber}` : ''}
                </h3>
                <p className="mt-1 text-sm text-muted">{item.quantity} {item.unit}</p>
                <p className="mt-1 text-sm text-muted">{item.availability ?? 'Наявність уточнюється'}</p>
                {item.comment ? <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-6 text-muted">{item.comment}</p> : null}
              </div>
              <StatusBadge status={item.request.status} />
            </div>
          </article>
        )) : <p className="rounded-md border border-dashed border-border p-5 text-sm text-muted">Для цієї одиниці техніки ще немає збережених підібраних позицій.</p>}
      </div>
    </section>
  );
}
