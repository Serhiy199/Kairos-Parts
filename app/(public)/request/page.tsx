import Link from 'next/link';

import { auth } from '@/auth';
import { ActionIcon } from '@/components/ui/action-icons';
import { getAllManufacturers } from '@/lib/catalog/catalog-data';
import { getClientAccessContext, getClientProfileForSession, requestAccessWhere, vehicleAccessWhere } from '@/lib/client/access';
import { getUploadMaxSizeMb } from '@/lib/files/upload-policy';

import { RequestForm } from './request-form';

export default async function RequestPage({
  searchParams
}: {
  searchParams: Promise<{ category?: string; mode?: string; source?: string; vehicleId?: string; repeatRequestId?: string }>;
}) {
  const params = await searchParams;
  const session = await auth();

  if (!session?.user?.id || session.user.role !== 'CLIENT') {
    return <RequestAuthGate isStaff={session?.user?.role === 'MANAGER' || session?.user?.role === 'ADMIN'} />;
  }

  const [clientProfile, clientAccess] = await Promise.all([
    getClientProfileForSession(session.user.id),
    getClientAccessContext(session.user.id)
  ]);

  if (!clientProfile || !clientAccess) {
    return <RequestAuthGate profileMissing />;
  }

  const maxSizeMb = getUploadMaxSizeMb();
  const manufacturerOptions = getAllManufacturers().map((manufacturer) => manufacturer.name);
  const clientFullName = [clientProfile.firstName, clientProfile.lastName].filter(Boolean).join(' ');
  const initialContact = {
    contactName: clientProfile.contactName ?? (clientFullName || clientProfile.user.name || ''),
    companyName: clientAccess.companyName ?? (clientProfile.clientType === 'BUSINESS' ? clientProfile.companyName ?? '' : ''),
    phone: clientProfile.phone ?? clientProfile.user.phone ?? '',
    email: clientProfile.email ?? clientProfile.user.email ?? ''
  };
  const vehiclePrefill = params.vehicleId ? await prismaVehiclePrefill(clientAccess, params.vehicleId) : null;
  const repeatPrefill = params.repeatRequestId ? await prismaRepeatPrefill(clientAccess, params.repeatRequestId) : null;
  const initialRequest = vehiclePrefill ?? repeatPrefill ?? undefined;

  return (
    <>
      <section className="bg-primary px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <p className="text-sm font-bold uppercase text-accent">Створити заявку</p>
          <h1 className="mt-3 max-w-3xl text-4xl font-bold leading-tight sm:text-5xl">Заявка на підбір запчастин</h1>
          <p className="mt-5 max-w-3xl text-base leading-7 text-sidebar-text">
            Вкажіть техніку, модель, VIN або серійний номер, опишіть потребу та додайте фото чи файл.
            Менеджер Kairos Parts перевірить сумісність і підбере рішення.
          </p>
        </div>
      </section>

      <section className="bg-public-page px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_0.45fr] lg:items-start">
          <RequestForm
            manufacturerOptions={manufacturerOptions}
            initialContact={initialContact}
            initialMode={params.mode}
            initialRequest={initialRequest}
            initialSource="client"
            maxSizeMb={maxSizeMb}
          />
          <aside className="public-card p-6">
            <p className="text-sm font-bold uppercase text-accent">Що підготувати</p>
            <div className="mt-5 grid gap-4 text-sm leading-6 text-public-muted">
              <p>1. Імʼя контактної особи, телефон, email і назву компанії.</p>
              <p>2. Тип техніки, виробника або марку, модель і рік випуску.</p>
              <p>3. VIN або серійний номер техніки.</p>
              <p>4. Опис деталі, вузла або проблеми.</p>
              <p>5. Фото, PDF, Excel або DOC список, якщо є. Файли можна не додавати.</p>
            </div>
            {clientAccess.mode === 'COMPANY' ? (
              <div className="public-callout mt-6 rounded-md p-4 text-sm leading-6">
                Заявка буде привʼязана до компанії <span className="font-bold">{clientAccess.companyName}</span> і буде доступна учасникам цієї компанії.
              </div>
            ) : null}
          </aside>
        </div>
      </section>
    </>
  );
}

function RequestAuthGate({ isStaff = false, profileMissing = false }: { isStaff?: boolean; profileMissing?: boolean }) {
  return (
    <section className="bg-public-page px-4 py-16 sm:px-6 lg:px-8">
      <div className="public-card mx-auto max-w-4xl p-6 sm:p-8">
        <p className="text-sm font-bold uppercase text-accent">Заявка на підбір</p>
        <h1 className="mt-3 text-3xl font-bold text-public-primary sm:text-4xl">
          {profileMissing ? 'Профіль клієнта потребує налаштування' : 'Створення заявки доступне після входу'}
        </h1>
        <p className="mt-4 max-w-2xl text-sm leading-6 text-public-muted sm:text-base">
          {profileMissing
            ? 'Ми не знайшли клієнтський профіль для цього акаунта. Зверніться до менеджера Kairos Parts або увійдіть іншим клієнтським акаунтом.'
            : 'Увійдіть або зареєструйтеся, щоб створити заявку на підбір запчастин, привʼязувати її до техніки та зберігати історію замовлень у кабінеті.'}
        </p>

        <div className="mt-6">
          <p className="text-sm font-bold uppercase text-accent">Що дає особистий кабінет</p>
        </div>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {[
            'Історія заявок і підібраних запчастин',
            'Привʼязка до парку техніки',
            'Документи та рахунки в одному кабінеті',
            'Статус заявки онлайн'
          ].map((item) => (
            <div key={item} className="rounded-md border border-public-border bg-public-elevated px-4 py-3 text-sm font-semibold text-public-secondary">
              {item}
            </div>
          ))}
        </div>

        {isStaff ? (
          <div className="public-callout mt-6 rounded-md p-4 text-sm leading-6">
            Ви авторизовані як менеджер або адміністратор. Для створення клієнтської заявки використовуйте CLIENT-акаунт.
          </div>
        ) : null}

        <div className="mt-8 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/login?next=/request"
            className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-bold text-primary transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <ActionIcon name="login" />
            Увійти
          </Link>
          <Link
            href="/register?next=/request"
            className="inline-flex items-center justify-center gap-2 rounded-md border border-public-border px-5 py-3 text-sm font-semibold text-public-primary transition hover:border-public-border-accent-hover hover:bg-public-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <ActionIcon name="plus" />
            Зареєструватися
          </Link>
        </div>
      </div>
    </section>
  );
}

type ClientAccess = Awaited<ReturnType<typeof getClientAccessContext>>;

async function prismaVehiclePrefill(access: NonNullable<ClientAccess>, vehicleId: string) {
  const { hasDatabaseUrl } = await import('@/lib/env/database');
  const { prisma } = await import('@/lib/prisma');

  if (!hasDatabaseUrl()) {
    return null;
  }

  const vehicle = await prisma.vehicle.findFirst({
    where: { id: vehicleId, AND: [vehicleAccessWhere(access)] }
  });

  if (!vehicle) {
    return null;
  }

  return {
    vehicleId: vehicle.id,
    equipmentType: vehicle.type,
    manufacturer: vehicle.manufacturer,
    model: vehicle.model,
    vehicleYear: vehicle.year,
    vinOrSerial: vehicle.vinOrSerial ?? '',
    description: '',
    comment: vehicle.comment ?? ''
  };
}

async function prismaRepeatPrefill(access: NonNullable<ClientAccess>, requestId: string) {
  const { hasDatabaseUrl } = await import('@/lib/env/database');
  const { prisma } = await import('@/lib/prisma');

  if (!hasDatabaseUrl()) {
    return null;
  }

  const request = await prisma.request.findFirst({
    where: { id: requestId, AND: [requestAccessWhere(access)] },
    include: { manufacturer: true }
  });

  if (!request) {
    return null;
  }

  return {
    vehicleId: request.vehicleId ?? '',
    equipmentType: request.equipmentType ?? '',
    manufacturer: request.manufacturer?.name ?? '',
    model: request.model ?? '',
    vehicleYear: request.vehicleYear,
    vinOrSerial: request.vinOrSerial ?? '',
    description: request.description,
    comment: ''
  };
}
