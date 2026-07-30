'use client';

import type { DocumentSource } from '@prisma/client';
import { useState, useTransition } from 'react';
import { LuDownload, LuFileText, LuTrash2 } from 'react-icons/lu';

import {
  formatVehicleDocumentSize,
  type VehicleDocumentActionState,
  vehicleDocumentTypeLabel
} from '@/lib/vehicles/documents';
import { vehicleDocumentSourceLabel } from '@/lib/vehicles/document-presentation';

type ClientDocument = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  source: DocumentSource;
  createdAt: string;
  canDelete: boolean;
};

export function ClientVehicleDocumentManager({
  documents,
  deleteAction
}: {
  documents: ClientDocument[];
  deleteAction: (documentId: string) => Promise<VehicleDocumentActionState>;
}) {
  const [state, setState] = useState<VehicleDocumentActionState>({ status: 'idle' });
  const [isPending, startTransition] = useTransition();
  const clientDocuments = documents.filter((document) => document.source === 'CLIENT');
  const sharedDocuments = documents.filter((document) => document.source !== 'CLIENT');

  function remove(documentId: string) {
    startTransition(async () => setState(await deleteAction(documentId)));
  }

  return (
    <section aria-labelledby="vehicle-documents-heading" className="grid gap-5 rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
      <div>
        <h2 id="vehicle-documents-heading" className="text-xl font-bold text-foreground">Документи техніки</h2>
        <p className="mt-2 text-sm leading-6 text-muted">Ваші документи та файли, які відкрила команда Kairos Parts.</p>
      </div>
      {documents.length === 0 ? (
        <div className="flex items-center gap-3 rounded-md border border-dashed border-border p-5 text-sm text-muted">
          <LuFileText aria-hidden="true" className="size-5 shrink-0" />
          Документи для цієї техніки ще не додані.
        </div>
      ) : (
        <>
          <DocumentGroup title="Додані вами" documents={clientDocuments} pending={isPending} onDelete={remove} />
          <DocumentGroup title="Від команди Kairos Parts" documents={sharedDocuments} pending={isPending} onDelete={remove} />
        </>
      )}
      {state.message ? (
        <p role={state.status === 'error' ? 'alert' : 'status'} className={state.status === 'error' ? 'rounded-md border border-danger/30 bg-danger/10 p-3 text-sm font-semibold text-danger' : 'rounded-md border border-success/30 bg-[#E7F6EC] p-3 text-sm font-semibold text-success'}>
          {state.message}
        </p>
      ) : null}
    </section>
  );
}

function DocumentGroup({
  title,
  documents,
  pending,
  onDelete
}: {
  title: string;
  documents: ClientDocument[];
  pending: boolean;
  onDelete: (documentId: string) => void;
}) {
  if (documents.length === 0) return null;
  return (
    <div className="grid gap-3">
      <h3 className="text-sm font-bold uppercase tracking-wide text-muted">{title}</h3>
      {documents.map((document) => (
        <article key={document.id} className="flex min-w-0 flex-col justify-between gap-4 rounded-md border border-border p-4 sm:flex-row sm:items-center">
          <div className="min-w-0">
            <p className="break-words font-bold text-foreground">{document.fileName}</p>
            <p className="mt-1 text-xs text-muted">
              {vehicleDocumentTypeLabel(document.mimeType)} · {formatVehicleDocumentSize(document.size)} · {new Date(document.createdAt).toLocaleDateString('uk-UA')}
            </p>
            <p className="mt-1 text-xs font-semibold text-muted">{vehicleDocumentSourceLabel(document.source, 'CLIENT')}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href={`/api/client/vehicle-documents/${document.id}/download`} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-accent px-3 py-2 text-sm font-bold text-foreground hover:bg-accent/10">
              <LuDownload aria-hidden="true" /> Завантажити
            </a>
            {document.canDelete ? (
              <details className="relative">
                <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-md border border-danger/30 px-3 py-2 text-sm font-bold text-danger hover:bg-danger/10">
                  <LuTrash2 aria-hidden="true" /> Видалити
                </summary>
                <div className="absolute right-0 top-12 z-10 w-64 rounded-md border border-border bg-card p-3 shadow-card">
                  <p className="text-xs font-semibold text-foreground">Видалити файл без можливості відновлення?</p>
                  <button type="button" disabled={pending} onClick={() => onDelete(document.id)} className="mt-3 w-full rounded-md bg-danger px-3 py-2 text-xs font-bold text-white disabled:opacity-50">
                    Підтвердити видалення
                  </button>
                </div>
              </details>
            ) : null}
          </div>
        </article>
      ))}
    </div>
  );
}
