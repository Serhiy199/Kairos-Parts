import Link from 'next/link';
import { TbDownload, TbFileDescription } from 'react-icons/tb';

import { ClientDbBlocker } from '@/components/client/client-db-blocker';
import { documentAccessWhere, getClientAccessContext, requestAccessWhere, requireClientSession } from '@/lib/client/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';
import { REQUEST_DOCUMENT_TYPE_LABELS } from '@/lib/request-documents/validation';
import { formatVehicleDocumentSize, vehicleDocumentTypeLabel } from '@/lib/vehicles/documents';

export const dynamic = 'force-dynamic';

type ClientDocumentItem = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: Date;
  url: string | null;
  context?: string;
  contextHref?: string;
};

export default async function ClientDocumentsPage() {
  const session = await requireClientSession();
  if (!hasDatabaseUrl()) return <ClientDbBlocker />;

  const access = await getClientAccessContext(session.user.id);
  if (!access) return <ClientDbBlocker />;

  const requestWhere = requestAccessWhere(access);
  const [documents, requestFiles, requestDocuments] = await Promise.all([
    prisma.document.findMany({
      where: { AND: [documentAccessWhere(access), { visibleToClient: true }] },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        clientId: true,
        companyId: true,
        requestId: true,
        vehicleId: true,
        fileName: true,
        mimeType: true,
        size: true,
        createdAt: true,
        company: { select: { name: true } },
        request: { select: { id: true, requestNumber: true } },
        vehicle: { select: { id: true, name: true, manufacturer: true, model: true } }
      }
    }),
    prisma.requestFile.findMany({
      where: { request: requestWhere },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        fileName: true,
        mimeType: true,
        size: true,
        createdAt: true,
        request: { select: { id: true, requestNumber: true } }
      }
    }),
    prisma.requestDocument.findMany({
      where: { visibleToClient: true, request: requestWhere },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      select: {
        id: true,
        type: true,
        title: true,
        mimeType: true,
        size: true,
        createdAt: true,
        request: { select: { id: true, requestNumber: true } }
      }
    })
  ]);

  const companyDocuments: ClientDocumentItem[] = documents
    .filter(
      (document) =>
        document.companyId !== null && document.requestId === null && document.vehicleId === null
    )
    .map((document) => ({
      id: `company-${document.id}`,
      fileName: document.fileName,
      mimeType: document.mimeType,
      size: document.size,
      createdAt: document.createdAt,
      url: `/api/client/documents/${document.id}/download`,
      context: document.company?.name ? `Компанія: ${document.company.name}` : undefined
    }));

  const personalDocuments: ClientDocumentItem[] = documents
    .filter(
      (document) =>
        document.clientId !== null && document.requestId === null && document.vehicleId === null
    )
    .map((document) => ({
      id: `personal-${document.id}`,
      fileName: document.fileName,
      mimeType: document.mimeType,
      size: document.size,
      createdAt: document.createdAt,
      url: `/api/client/documents/${document.id}/download`
    }));

  const vehicleDocuments: ClientDocumentItem[] = documents
    .filter((document) => document.vehicleId !== null && document.requestId === null)
    .map((document) => ({
      id: `vehicle-${document.id}`,
      fileName: document.fileName,
      mimeType: document.mimeType,
      size: document.size,
      createdAt: document.createdAt,
      url: `/api/client/documents/${document.id}/download`,
      context: document.vehicle?.name,
      contextHref: document.vehicle ? `/client/vehicles/${document.vehicle.id}` : undefined
    }));

  const requestItems: ClientDocumentItem[] = [
    ...requestFiles.map((file) => ({
      id: `request-file-${file.id}`,
      fileName: file.fileName,
      mimeType: file.mimeType,
      size: file.size,
      createdAt: file.createdAt,
      url: null,
      context: `Заявка ${file.request.requestNumber}`,
      contextHref: `/client/requests/${file.request.id}`
    })),
    ...documents
      .filter((document) => document.requestId !== null)
      .map((document) => ({
        id: `request-document-generic-${document.id}`,
        fileName: document.fileName,
        mimeType: document.mimeType,
        size: document.size,
        createdAt: document.createdAt,
        url: `/api/client/documents/${document.id}/download`,
        context: document.request ? `Заявка ${document.request.requestNumber}` : undefined,
        contextHref: document.request ? `/client/requests/${document.request.id}` : undefined
      })),
    ...requestDocuments.map((document) => ({
      id: `request-document-${document.id}`,
      fileName: `${REQUEST_DOCUMENT_TYPE_LABELS[document.type]}: ${document.title}`,
      mimeType: document.mimeType ?? 'application/octet-stream',
      size: document.size ?? 0,
      createdAt: document.createdAt,
      url: `/api/client/request-documents/${document.id}/file`,
      context: `Заявка ${document.request.requestNumber}`,
      contextHref: `/client/requests/${document.request.id}`
    }))
  ].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

  const groups = [
    { title: 'Особисті документи', description: 'Ваші персональні документи, які не належать конкретній техніці.', items: personalDocuments },
    { title: 'Документи компанії', description: 'Загальні документи компанії, доступні її учасникам.', items: companyDocuments },
    { title: 'Документи техніки', description: 'Файли, прив’язані до доступних одиниць вашого парку.', items: vehicleDocuments },
    { title: 'Документи заявок', description: 'Файли та документи, пов’язані із заявками.', items: requestItems }
  ].filter((group) => group.items.length > 0);

  return (
    <div className="grid gap-6">
      <header className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
        <p className="text-sm font-bold uppercase text-accent">Документи</p>
        <h1 className="mt-2 text-2xl font-bold text-foreground">Усі документи в одному місці</h1>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
          Тут показуються лише документи, які менеджер відкрив для вашого кабінету: особисті, компанії, техніки та заявок.
        </p>
      </header>

      {groups.length === 0 ? (
        <section className="rounded-lg border border-dashed border-border bg-card p-8 text-center shadow-card">
          <TbFileDescription aria-hidden="true" className="mx-auto size-8 text-muted" />
          <h2 className="mt-3 text-lg font-bold text-foreground">Документів ще немає</h2>
          <p className="mt-2 text-sm text-muted">Доступні файли з’являться тут після публікації менеджером.</p>
        </section>
      ) : groups.map((group) => <DocumentGroup key={group.title} {...group} />)}
    </div>
  );
}

function DocumentGroup({ title, description, items }: { title: string; description: string; items: ClientDocumentItem[] }) {
  return (
    <section className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
      <h2 className="text-xl font-bold text-foreground">{title}</h2>
      <p className="mt-2 text-sm text-muted">{description}</p>
      <div className="mt-5 grid gap-3">
        {items.map((item) => (
          <article key={item.id} className="flex min-w-0 flex-col justify-between gap-4 rounded-md border border-border p-4 sm:flex-row sm:items-center">
            <div className="min-w-0">
              <p className="break-words font-bold text-foreground">{item.fileName}</p>
              <p className="mt-1 text-xs text-muted">
                {vehicleDocumentTypeLabel(item.mimeType)} · {formatVehicleDocumentSize(item.size)} · {item.createdAt.toLocaleDateString('uk-UA')}
              </p>
              {item.context ? (
                item.contextHref ? (
                  <Link href={item.contextHref} className="mt-2 inline-flex break-words text-sm font-semibold text-muted transition hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                    {item.context}
                  </Link>
                ) : <p className="mt-2 break-words text-sm text-muted">{item.context}</p>
              ) : null}
            </div>
            {item.url ? (
              <a
                href={item.url}
                aria-label={`Завантажити ${item.fileName}`}
                className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-accent px-4 py-2 text-sm font-bold text-foreground transition hover:bg-accent/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                <TbDownload aria-hidden="true" className="size-4" />
                Завантажити
              </a>
            ) : <span className="text-xs font-semibold text-muted">Файл додано клієнтом</span>}
          </article>
        ))}
      </div>
    </section>
  );
}
