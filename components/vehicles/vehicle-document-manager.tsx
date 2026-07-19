'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { LuDownload, LuEye, LuEyeOff, LuFilePlus2, LuTrash2 } from 'react-icons/lu';

import {
  deleteAdminVehicleDocument,
  setVehicleDocumentVisibility,
  uploadAdminVehicleDocuments
} from '@/app/admin/vehicles/document-actions';
import {
  EMPTY_VEHICLE_DOCUMENT_ACTION_STATE,
  formatVehicleDocumentSize,
  MAX_VEHICLE_DOCUMENTS,
  type VehicleDocumentActionState,
  vehicleDocumentTypeLabel
} from '@/lib/vehicles/documents';

export type VehicleDocumentListItem = {
  id: string;
  fileName: string;
  mimeType: string;
  size: number;
  visibleToClient: boolean;
  createdAt: Date;
  uploadedBy: { name: string | null; email: string | null } | null;
};

export function VehicleDocumentManager({ vehicleId, documents }: { vehicleId: string; documents: VehicleDocumentListItem[] }) {
  const uploadAction = uploadAdminVehicleDocuments.bind(null, vehicleId);
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
          <p className="text-sm font-bold uppercase text-accent">Документи</p>
          <h2 className="mt-2 text-xl font-bold text-foreground">Документи техніки</h2>
          <p className="mt-2 text-sm leading-6 text-muted">PDF, JPEG, PNG або WebP. До 15 МБ кожен. Нові документи за замовчуванням внутрішні.</p>
        </div>
        <span className="w-fit rounded-full bg-surface-muted px-3 py-1 text-xs font-bold text-muted">{documents.length}/{MAX_VEHICLE_DOCUMENTS}</span>
      </div>

      <form action={formAction} className="grid gap-3 rounded-md border border-dashed border-border bg-surface-muted p-4">
        <label htmlFor="vehicle-documents" className="text-sm font-bold text-foreground">Додати документи</label>
        <input
          ref={inputRef}
          id="vehicle-documents"
          name="documents"
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          multiple
          required
          className="block w-full rounded-md border border-border bg-card p-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-4 file:py-2 file:font-bold file:text-foreground"
        />
        <label className="flex w-fit items-center gap-2 text-sm font-semibold text-foreground">
          <input name="visibleToClient" type="checkbox" className="size-4 accent-accent" />
          Одразу показати клієнту
        </label>
        <button disabled={isUploading || documents.length >= MAX_VEHICLE_DOCUMENTS} className="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">
          <LuFilePlus2 aria-hidden="true" className="size-4" />
          {isUploading ? 'Завантаження...' : 'Завантажити документи'}
        </button>
        {uploadState.message ? <ActionMessage state={uploadState} /> : null}
      </form>

      {documents.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted">Документи ще не додані.</p>
      ) : (
        <div className="grid gap-3">
          {documents.map((document) => (
            <article key={document.id} className="grid gap-4 rounded-md border border-border p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
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
                <a href={`/api/admin/vehicle-documents/${document.id}/download`} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-bold text-foreground transition hover:border-accent">
                  <LuDownload aria-hidden="true" /> Завантажити
                </a>
                <button type="button" disabled={isActionPending} onClick={() => runAction(setVehicleDocumentVisibility(vehicleId, document.id, !document.visibleToClient))} className="inline-flex min-h-10 items-center gap-2 rounded-md border border-border px-3 py-2 text-sm font-bold text-foreground transition hover:border-accent disabled:opacity-50">
                  {document.visibleToClient ? <LuEyeOff aria-hidden="true" /> : <LuEye aria-hidden="true" />}
                  {document.visibleToClient ? 'Приховати' : 'Показати клієнту'}
                </button>
                <details className="relative">
                  <summary className="inline-flex min-h-10 cursor-pointer list-none items-center gap-2 rounded-md border border-danger/30 px-3 py-2 text-sm font-bold text-danger transition hover:bg-danger/10">
                    <LuTrash2 aria-hidden="true" /> Видалити
                  </summary>
                  <div className="absolute right-0 top-12 z-10 w-64 rounded-md border border-border bg-card p-3 shadow-card">
                    <p className="text-xs font-semibold text-foreground">Видалити файл без можливості відновлення?</p>
                    <button type="button" disabled={isActionPending} onClick={() => runAction(deleteAdminVehicleDocument(vehicleId, document.id))} className="mt-3 w-full rounded-md bg-danger px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Підтвердити видалення</button>
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
