'use client';

import { useActionState, useEffect, useId, useRef, useState, useTransition } from 'react';
import { LuDownload, LuEye, LuEyeOff, LuFilePlus2, LuTrash2 } from 'react-icons/lu';

import {
  deleteAdminOwnerDocument,
  setOwnerDocumentVisibility,
  uploadAdminOwnerDocuments
} from '@/app/admin/documents/actions';
import type { OwnerDocumentType } from '@/lib/documents/ownership';
import {
  EMPTY_VEHICLE_DOCUMENT_ACTION_STATE,
  formatVehicleDocumentSize,
  MAX_DOCUMENTS_PER_OWNER,
  type VehicleDocumentActionState,
  vehicleDocumentTypeLabel
} from '@/lib/vehicles/documents';

export type AdminOwnerDocumentListItem = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  visibleToClient: boolean;
  createdAt: Date;
  uploadedBy: { name: string | null; email: string | null } | null;
};

const COPY = {
  company: {
    eyebrow: 'Документи компанії',
    title: 'Загальні документи компанії',
    emptyTitle: 'Документи компанії ще не додані',
    emptyText: 'Завантажте договори, реквізити або інші загальні файли компанії.'
  },
  client: {
    eyebrow: 'Документи клієнта',
    title: 'Загальні документи клієнта',
    emptyTitle: 'Документи клієнта ще не додані',
    emptyText: 'Завантажте загальні файли клієнта, які не належать конкретній техніці.'
  }
} as const;

export function AdminOwnerDocumentsSection({
  ownerType,
  ownerId,
  documents
}: {
  ownerType: Exclude<OwnerDocumentType, 'vehicle'>;
  ownerId: string;
  documents: AdminOwnerDocumentListItem[];
}) {
  const copy = COPY[ownerType];
  const inputId = useId();
  const uploadAction = uploadAdminOwnerDocuments.bind(null, ownerType, ownerId);
  const [uploadState, formAction, isUploading] = useActionState(uploadAction, EMPTY_VEHICLE_DOCUMENT_ACTION_STATE);
  const [actionState, setActionState] = useState(EMPTY_VEHICLE_DOCUMENT_ACTION_STATE);
  const [isActionPending, startActionTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (uploadState.status === 'success' && inputRef.current) inputRef.current.value = '';
  }, [uploadState]);

  function runAction(action: Promise<VehicleDocumentActionState>) {
    setActionState(EMPTY_VEHICLE_DOCUMENT_ACTION_STATE);
    startActionTransition(async () => setActionState(await action));
  }

  return (
    <section className="grid gap-5 rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm font-bold uppercase text-accent">{copy.eyebrow}</p>
          <h2 className="mt-2 text-xl font-bold text-foreground">{copy.title}</h2>
          <p className="mt-2 text-sm leading-6 text-muted">PDF, JPEG, PNG або WebP. До 15 МБ кожен. Нові документи за замовчуванням внутрішні.</p>
        </div>
        <span className="w-fit rounded-full bg-surface-muted px-3 py-1 text-xs font-bold text-muted">{documents.length}/{MAX_DOCUMENTS_PER_OWNER}</span>
      </div>

      <form action={formAction} className="grid gap-3 rounded-md border border-dashed border-border bg-surface-muted p-4">
        <label htmlFor={inputId} className="text-sm font-bold text-foreground">Додати документи</label>
        <input
          ref={inputRef}
          id={inputId}
          name="documents"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          multiple
          required
          className="block w-full min-w-0 rounded-md border border-border bg-card p-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-4 file:py-2 file:font-bold file:text-foreground"
        />
        <label className="flex w-fit items-center gap-2 text-sm font-semibold text-foreground">
          <input name="visibleToClient" type="checkbox" className="size-4 accent-accent" />
          Одразу показати клієнту
        </label>
        <button disabled={isUploading || documents.length >= MAX_DOCUMENTS_PER_OWNER} className="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50">
          <LuFilePlus2 aria-hidden="true" className="size-4" />
          {isUploading ? 'Завантаження...' : 'Завантажити документи'}
        </button>
        {uploadState.message ? <ActionMessage state={uploadState} /> : null}
      </form>

      {documents.length === 0 ? (
        <div className="rounded-md border border-dashed border-border p-6 text-center">
          <p className="text-sm font-bold text-foreground">{copy.emptyTitle}</p>
          <p className="mt-2 text-sm text-muted">{copy.emptyText}</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {documents.map((document) => (
            <article key={document.id} className="grid min-w-0 gap-4 rounded-md border border-border p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="min-w-0">
                <p className="break-words font-bold text-foreground">{document.fileName}</p>
                <p className="mt-1 text-xs leading-5 text-muted">
                  {vehicleDocumentTypeLabel(document.mimeType)} · {formatVehicleDocumentSize(document.size)} · {document.createdAt.toLocaleDateString('uk-UA')}
                </p>
                <p className="mt-1 text-xs text-muted">Завантажив: {document.uploadedBy?.name ?? document.uploadedBy?.email ?? 'Не визначено'}</p>
                <span className={document.visibleToClient ? 'mt-2 inline-flex rounded-full bg-success/10 px-3 py-1 text-xs font-bold text-success' : 'mt-2 inline-flex rounded-full bg-surface-muted px-3 py-1 text-xs font-bold text-muted'}>
                  {document.visibleToClient ? 'Видимо клієнту' : 'Внутрішній документ'}
                </span>
              </div>
              <div className="flex flex-wrap gap-2 lg:justify-end">
                <a href={`/api/admin/documents/${document.id}/download`} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-bold text-foreground transition hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent">
                  <LuDownload aria-hidden="true" /> Завантажити
                </a>
                <button type="button" disabled={isActionPending} onClick={() => runAction(setOwnerDocumentVisibility(ownerType, ownerId, document.id, !document.visibleToClient))} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-bold text-foreground transition hover:border-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50">
                  {document.visibleToClient ? <LuEyeOff aria-hidden="true" /> : <LuEye aria-hidden="true" />}
                  {document.visibleToClient ? 'Приховати' : 'Показати клієнту'}
                </button>
                <details className="relative">
                  <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-md border border-danger/30 px-3 py-2 text-sm font-bold text-danger transition hover:bg-danger/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger">
                    <LuTrash2 aria-hidden="true" /> Видалити
                  </summary>
                  <div className="absolute right-0 top-12 z-10 w-64 max-w-[calc(100vw-3rem)] rounded-md border border-border bg-card p-3 shadow-card">
                    <p className="text-xs font-semibold text-foreground">Видалити файл без можливості відновлення?</p>
                    <button type="button" disabled={isActionPending} onClick={() => runAction(deleteAdminOwnerDocument(ownerType, ownerId, document.id))} className="mt-3 w-full rounded-md bg-danger px-3 py-2 text-xs font-bold text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-danger disabled:opacity-50">Підтвердити видалення</button>
                  </div>
                </details>
              </div>
            </article>
          ))}
        </div>
      )}

      {actionState.message ? <ActionMessage state={actionState} /> : null}
    </section>
  );
}

function ActionMessage({ state }: { state: VehicleDocumentActionState }) {
  return (
    <p aria-live="polite" className={state.status === 'error' ? 'rounded-md border border-danger/30 bg-danger/10 p-3 text-sm font-semibold text-danger' : 'rounded-md border border-success/30 bg-[#E7F6EC] p-3 text-sm font-semibold text-success'}>
      {state.message}
    </p>
  );
}
