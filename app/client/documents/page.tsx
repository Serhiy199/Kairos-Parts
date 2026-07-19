import Link from 'next/link';

import { ClientDbBlocker } from '@/components/client/client-db-blocker';
import { documentAccessWhere, getClientAccessContext, requestAccessWhere, requireClientSession } from '@/lib/client/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';
import { REQUEST_DOCUMENT_TYPE_LABELS } from '@/lib/request-documents/validation';

export const dynamic = 'force-dynamic';

function formatSize(size: number) {
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

export default async function ClientDocumentsPage() {
  const session = await requireClientSession();

  if (!hasDatabaseUrl()) {
    return <ClientDbBlocker />;
  }

  const access = await getClientAccessContext(session.user.id);

  if (!access) {
    return <ClientDbBlocker />;
  }

  const requestWhere = requestAccessWhere(access);
  const [documents, requestFiles, requestDocuments] = await Promise.all([
    prisma.document.findMany({
      where: {
        AND: [
          documentAccessWhere(access),
          { OR: [{ vehicleId: null }, { visibleToClient: true }] }
        ]
      },
      orderBy: { createdAt: 'desc' },
      include: {
        request: { select: { id: true, requestNumber: true } },
        vehicle: { select: { id: true, manufacturer: true, model: true } }
      }
    }),
    prisma.requestFile.findMany({
      where: { request: requestWhere },
      orderBy: { createdAt: 'desc' },
      include: { request: { select: { id: true, requestNumber: true } } }
    }),
    prisma.requestDocument.findMany({
      where: { visibleToClient: true, request: requestWhere },
      orderBy: { createdAt: 'desc' },
      include: { request: { select: { id: true, requestNumber: true } } }
    })
  ]);

  const items = [
    ...requestFiles.map((file) => ({
      id: `request-file-${file.id}`,
      fileName: file.fileName,
      mimeType: file.mimeType,
      size: file.size,
      createdAt: file.createdAt,
      request: file.request,
      vehicle: null,
      url: null as string | null
    })),
    ...documents.map((document) => ({
      id: `document-${document.id}`,
      fileName: document.fileName,
      mimeType: document.mimeType,
      size: document.size,
      createdAt: document.createdAt,
      request: document.request,
      vehicle: document.vehicle,
      url: document.vehicleId ? `/api/client/vehicle-documents/${document.id}/download` : document.fileUrl
    })),
    ...requestDocuments.map((document) => ({
      id: `request-document-${document.id}`,
      fileName: `${REQUEST_DOCUMENT_TYPE_LABELS[document.type]}: ${document.title}`,
      mimeType: document.mimeType ?? 'application/octet-stream',
      size: document.size ?? 0,
      createdAt: document.createdAt,
      request: document.request,
      vehicle: null,
      url: `/api/client/request-documents/${document.id}/file`
    }))
  ].sort((left, right) => right.createdAt.getTime() - left.createdAt.getTime());

  return (
    <div className="rounded-lg border border-border bg-card p-6 shadow-card">
      <p className="text-sm font-bold uppercase text-accent">Документи</p>
      <h2 className="mt-2 text-2xl font-bold text-foreground">Файли заявок і документи</h2>
      <p className="mt-2 max-w-3xl text-sm leading-6 text-muted">
        Тут показуються файли, які привʼязані до ваших заявок, а також документи, повʼязані з заявками або технікою.
      </p>

      <div className="mt-6 overflow-x-auto">
        <table className="w-full min-w-[820px] border-collapse text-left text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted text-muted">
              <th className="px-4 py-3 font-bold">Файл</th>
              <th className="px-4 py-3 font-bold">Тип</th>
              <th className="px-4 py-3 font-bold">Розмір</th>
              <th className="px-4 py-3 font-bold">Дата</th>
              <th className="px-4 py-3 font-bold">Заявка</th>
              <th className="px-4 py-3 font-bold">Техніка</th>
              <th className="px-4 py-3 font-bold">Доступ</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-bold text-foreground">{item.url ? <a href={item.url} target="_blank" rel="noreferrer" className="transition hover:text-accent">{item.fileName}</a> : item.fileName}</td>
                <td className="px-4 py-3 text-muted">{item.mimeType}</td>
                <td className="px-4 py-3 text-muted">{formatSize(item.size)}</td>
                <td className="px-4 py-3 text-muted">{item.createdAt.toLocaleDateString('uk-UA')}</td>
                <td className="px-4 py-3">
                  {item.request ? (
                    <Link href={`/client/requests/${item.request.id}`} className="font-bold text-foreground transition hover:text-accent">
                      {item.request.requestNumber}
                    </Link>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3">
                  {item.vehicle ? (
                    <Link href={`/client/vehicles/${item.vehicle.id}`} className="font-bold text-foreground transition hover:text-accent">
                      {item.vehicle.manufacturer} {item.vehicle.model}
                    </Link>
                  ) : (
                    <span className="text-muted">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-muted">{item.url ? <span>Посилання доступне</span> : <span>Приватне сховище</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
        {items.length === 0 ? <p className="mt-5 rounded-md border border-dashed border-border p-5 text-sm text-muted">Документів ще немає.</p> : null}
      </div>
    </div>
  );
}
