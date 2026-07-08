import Link from 'next/link';
import { notFound } from 'next/navigation';

import { ContextualChangeRequestForm } from '@/app/client/change-requests/contextual-change-request-form';
import { ClientDbBlocker } from '@/components/client/client-db-blocker';
import { StatusBadge } from '@/components/client/status-badge';
import { getClientAccessContext, requireClientSession, vehicleAccessWhere } from '@/lib/client/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';

import { updateVehicle } from '../actions';
import { VehicleForm } from '../vehicle-form';

export const dynamic = 'force-dynamic';

function resultMessage(result?: string) {
  const messages: Record<string, string> = {
    created: 'Запит на зміну відправлено на погодження.',
    database: 'DATABASE_URL не налаштовано.',
    'invalid-entity-type': 'Некоректний тип об’єкта для запиту на зміну.',
    'entity-id-required': 'Не вдалося визначити об’єкт для запиту на зміну.',
    'invalid-action': 'Некоректна дія для запиту на зміну.',
    'change-details-required': 'Вкажіть нове значення або причину зміни.',
    'entity-not-found-or-forbidden': 'Об’єкт не знайдено або недоступний для вашого кабінету.'
  };

  return result ? messages[result] : null;
}

export default async function ClientVehicleDetailPage({
  params,
  searchParams
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ updated?: string; error?: string; result?: string }>;
}) {
  const session = await requireClientSession();
  const { id } = await params;
  const query = await searchParams;

  if (!hasDatabaseUrl()) {
    return <ClientDbBlocker />;
  }

  const access = await getClientAccessContext(session.user.id);

  if (!access) {
    return <ClientDbBlocker />;
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: { id, AND: [vehicleAccessWhere(access)] },
    include: {
      company: { select: { name: true } },
      requests: {
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          requestNumber: true,
          status: true,
          createdAt: true,
          description: true
        }
      },
      requestItems: {
        where: { visibleToClient: true },
        orderBy: { createdAt: 'desc' },
        include: {
          request: {
            select: {
              id: true,
              requestNumber: true,
              status: true,
              createdAt: true
            }
          }
        }
      }
    }
  });

  if (!vehicle) {
    notFound();
  }

  const currentPath = `/client/vehicles/${vehicle.id}`;
  const changeMessage = resultMessage(query.result);

  return (
    <div className="grid gap-6">
      <div className="flex flex-col justify-between gap-4 rounded-lg border border-border bg-card p-6 shadow-card md:flex-row md:items-center">
        <div>
          <p className="text-sm font-bold uppercase text-accent">Одиниця техніки</p>
          <h2 className="mt-2 text-2xl font-bold text-foreground">
            {vehicle.manufacturer} {vehicle.model}
          </h2>
          <p className="mt-2 text-sm text-muted">{vehicle.type}</p>
        </div>
        <Link href={`/request?source=client&vehicleId=${vehicle.id}`} className="rounded-md bg-accent px-5 py-3 text-center text-sm font-bold text-foreground transition hover:bg-accent-hover">
          Створити заявку по цій техніці
        </Link>
      </div>

      {query.updated ? <div className="rounded-md border border-success/30 bg-[#E7F6EC] p-4 text-sm font-semibold text-success">Дані техніки оновлено.</div> : null}
      {query.error ? <div className="rounded-md border border-danger/30 bg-[#FEF3F2] p-4 text-sm font-semibold text-danger">Перевірте обовʼязкові поля.</div> : null}
      {changeMessage ? <div className="rounded-md border border-success/30 bg-[#E7F6EC] p-4 text-sm font-semibold text-success">{changeMessage}</div> : null}

      <VehicleForm action={updateVehicle} submitLabel="Зберегти зміни" vehicle={vehicle} />

      <div className="grid gap-4 lg:grid-cols-2">
        <ContextualChangeRequestForm
          title="Запросити редагування техніки"
          description="Надішліть менеджеру уточнення щодо даних техніки. Запит не змінює картку автоматично."
          entityType="VEHICLE"
          entityId={vehicle.id}
          action="UPDATE"
          redirectTo={currentPath}
          fieldOptions={[
            { value: 'type', label: 'Тип техніки', currentValue: vehicle.type },
            { value: 'manufacturer', label: 'Виробник', currentValue: vehicle.manufacturer },
            { value: 'model', label: 'Модель', currentValue: vehicle.model },
            { value: 'year', label: 'Рік', currentValue: vehicle.year },
            { value: 'vinOrSerial', label: 'VIN / серійний номер', currentValue: vehicle.vinOrSerial },
            { value: 'comment', label: 'Коментар', currentValue: vehicle.comment },
            { value: 'other', label: 'Інше' }
          ]}
        />
        <ContextualChangeRequestForm
          title="Запросити архівацію техніки"
          description="Створюється тільки запит на архівацію. Техніка не архівується автоматично на цьому етапі."
          entityType="VEHICLE"
          entityId={vehicle.id}
          action="ARCHIVE"
          redirectTo={currentPath}
          submitLabel="Запросити архівацію техніки"
          fieldOptions={[{ value: 'archive', label: 'Архівація техніки', currentValue: `${vehicle.manufacturer} ${vehicle.model}` }]}
        />
      </div>

      <div className="rounded-lg border border-border bg-card p-6 shadow-card">
        <h3 className="text-xl font-bold text-foreground">Повʼязані заявки</h3>
        <div className="mt-5 grid gap-3">
          {vehicle.requests.length > 0 ? (
            vehicle.requests.map((request) => (
              <Link key={request.id} href={`/client/requests/${request.id}`} className="rounded-md border border-border p-4 transition hover:border-accent hover:bg-surface-muted">
                <div className="flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
                  <div>
                    <p className="font-bold text-foreground">{request.requestNumber}</p>
                    <p className="mt-1 line-clamp-1 text-sm text-muted">{request.description}</p>
                    <p className="mt-1 text-xs text-muted">{request.createdAt.toLocaleDateString('uk-UA')}</p>
                  </div>
                  <StatusBadge status={request.status} />
                </div>
              </Link>
            ))
          ) : (
            <p className="rounded-md border border-dashed border-border p-5 text-sm text-muted">По цій техніці ще немає заявок.</p>
          )}
        </div>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 shadow-card">
        <h3 className="text-xl font-bold text-foreground">Історія підібраних запчастин</h3>
        <p className="mt-2 text-sm text-muted">Тут показані позиції, які менеджер позначив як видимі для клієнта по цій одиниці техніки.</p>
        <div className="mt-5 grid gap-3">
          {vehicle.requestItems.length > 0 ? (
            vehicle.requestItems.map((item) => (
              <article key={item.id} className="rounded-md border border-border p-4">
                <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
                  <div>
                    <p className="text-xs font-semibold text-muted">
                      {item.request.createdAt.toLocaleDateString('uk-UA')} · {item.request.requestNumber}
                    </p>
                    <h4 className="mt-2 font-bold text-foreground">
                      {item.name}{item.brand ? ` — ${item.brand}` : ''}{item.catalogNumber ? ` ${item.catalogNumber}` : ''}
                    </h4>
                    <p className="mt-1 text-sm text-muted">{item.quantity} {item.unit}{item.analogNumber ? ` · Аналог: ${item.analogNumber}` : ''}</p>
                    <p className="mt-1 text-sm text-muted">{item.availability ?? 'Наявність уточнюється'}{item.deliveryTime ? ` · ${item.deliveryTime}` : ''}</p>
                    {item.comment ? <p className="mt-2 text-sm leading-6 text-muted">{item.comment}</p> : null}
                  </div>
                  <StatusBadge status={item.request.status} />
                </div>
              </article>
            ))
          ) : (
            <p className="rounded-md border border-dashed border-border p-5 text-sm text-muted">
              Для цієї одиниці техніки ще немає збережених підібраних позицій.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
