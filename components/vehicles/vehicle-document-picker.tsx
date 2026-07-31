'use client';

import { useRef, useState } from 'react';
import { LuFilePlus2, LuX } from 'react-icons/lu';

import {
  formatVehicleDocumentSize,
  MAX_VEHICLE_DOCUMENT_BATCH_FILES,
  MAX_VEHICLE_DOCUMENT_BATCH_BYTES,
  MAX_VEHICLE_DOCUMENT_BYTES,
  MAX_VEHICLE_DOCUMENTS,
  MAX_VEHICLE_DOCUMENT_TOTAL_BYTES
} from '@/lib/vehicles/documents';

const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp']);
const ALLOWED_EXTENSIONS = new Set(['pdf', 'jpg', 'jpeg', 'png', 'webp']);

function fileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export function VehicleDocumentPicker({
  disabled = false,
  existingCount = 0,
  existingBytes = 0,
  showStaffVisibility = false
}: {
  disabled?: boolean;
  existingCount?: number;
  existingBytes?: number;
  showStaffVisibility?: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [files, setFiles] = useState<File[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const availableCount = Math.max(0, Math.min(
    MAX_VEHICLE_DOCUMENT_BATCH_FILES,
    MAX_VEHICLE_DOCUMENTS - existingCount
  ));

  function syncInput(next: File[]) {
    if (!inputRef.current) return;
    const transfer = new DataTransfer();
    next.forEach((file) => transfer.items.add(file));
    inputRef.current.files = transfer.files;
  }

  function selectFiles(incoming: File[]) {
    const next = [...files];
    const known = new Set(files.map(fileKey));
    const nextErrors: string[] = [];
    for (const file of incoming) {
      const key = fileKey(file);
      const extension = file.name.toLowerCase().split('.').pop() ?? '';
      if (known.has(key)) {
        nextErrors.push(`«${file.name}» уже вибрано.`);
        continue;
      }
      if (!ALLOWED_TYPES.has(file.type) || !ALLOWED_EXTENSIONS.has(extension)) {
        nextErrors.push(`«${file.name}»: дозволені PDF, JPEG, PNG або WebP.`);
        continue;
      }
      if (file.size === 0) {
        nextErrors.push(`«${file.name}» порожній.`);
        continue;
      }
      if (file.size > MAX_VEHICLE_DOCUMENT_BYTES) {
        nextErrors.push(`«${file.name}» перевищує 15 МБ.`);
        continue;
      }
      if (next.length >= availableCount) {
        nextErrors.push(`За один submit можна додати не більше ${availableCount} документів.`);
        break;
      }
      if (next.reduce((total, item) => total + item.size, 0) + file.size > MAX_VEHICLE_DOCUMENT_BATCH_BYTES) {
        nextErrors.push(`«${file.name}» перевищує ліміт 60 МБ за один submit.`);
        continue;
      }
      if (existingBytes + next.reduce((total, item) => total + item.size, 0) + file.size > MAX_VEHICLE_DOCUMENT_TOTAL_BYTES) {
        nextErrors.push(`«${file.name}» перевищує доступну quota 250 МБ для цієї техніки.`);
        continue;
      }
      known.add(key);
      next.push(file);
    }
    setFiles(next);
    setErrors(nextErrors);
    syncInput(next);
  }

  function removeFile(key: string) {
    const next = files.filter((file) => fileKey(file) !== key);
    setFiles(next);
    setErrors([]);
    syncInput(next);
  }

  return (
    <fieldset disabled={disabled} className="grid min-w-0 gap-4 rounded-md border border-dashed border-border bg-surface-muted p-4">
      <legend className="px-2 text-base font-bold text-foreground">Документи техніки</legend>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
          <LuFilePlus2 aria-hidden="true" className="size-5" />
        </span>
        <div>
          <label htmlFor="vehicle-form-documents" className="text-sm font-bold text-foreground">Додати документи</label>
          <p id="vehicle-form-documents-help" className="mt-1 text-xs leading-5 text-muted">
            Додайте техпаспорт, реєстраційні, сервісні або інші документи, які можуть допомогти під час підбору запчастин.
            PDF, JPEG, PNG або WebP, до 15 МБ на файл; максимум 5 за один submit.
          </p>
        </div>
      </div>
      <input
        ref={inputRef}
        id="vehicle-form-documents"
        name="documents"
        type="file"
        accept="application/pdf,image/jpeg,image/png,image/webp"
        multiple
        aria-describedby="vehicle-form-documents-help"
        onChange={(event) => selectFiles(Array.from(event.currentTarget.files ?? []))}
        className="block w-full rounded-md border border-border bg-card p-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-4 file:py-2 file:font-bold file:text-foreground"
      />
      {showStaffVisibility ? (
        <label className="flex w-fit items-center gap-2 text-sm font-semibold text-foreground">
          <input name="visibleToClient" type="checkbox" className="size-4 accent-accent" />
          Відкрити нові документи клієнту
        </label>
      ) : null}
      {files.length === 0 ? <p className="text-sm text-muted">Документи не вибрано.</p> : (
        <ul className="grid gap-2" aria-label="Вибрані документи">
          {files.map((file) => (
            <li key={fileKey(file)} className="flex min-w-0 items-center justify-between gap-3 rounded-md border border-border bg-card p-3">
              <div className="min-w-0">
                <p className="break-words text-sm font-bold text-foreground">{file.name}</p>
                <p className="mt-1 text-xs text-muted">{formatVehicleDocumentSize(file.size)}</p>
              </div>
              <button type="button" onClick={() => removeFile(fileKey(file))} aria-label={`Прибрати документ ${file.name}`} className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-danger/30 text-danger hover:bg-danger/10">
                <LuX aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {errors.length > 0 ? (
        <ul role="alert" className="grid gap-1 rounded-md border border-danger/30 bg-danger/10 p-3 text-xs font-semibold text-danger">
          {errors.map((error, index) => <li key={`${index}-${error}`}>{error}</li>)}
        </ul>
      ) : null}
    </fieldset>
  );
}
