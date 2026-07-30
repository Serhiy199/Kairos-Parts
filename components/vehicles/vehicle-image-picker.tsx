'use client';

import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import { LuImagePlus, LuX } from 'react-icons/lu';

import {
  ALLOWED_VEHICLE_IMAGE_TYPES,
  MAX_VEHICLE_IMAGE_BYTES,
  MAX_VEHICLE_IMAGES
} from '@/lib/vehicles/images';

type SelectedImage = { file: File; key: string; previewUrl: string };

function fileKey(file: File) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

export function VehicleImagePicker({
  disabled = false,
  existingCount = 0
}: {
  disabled?: boolean;
  existingCount?: number;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const itemsRef = useRef<SelectedImage[]>([]);
  const [items, setItems] = useState<SelectedImage[]>([]);
  const [errors, setErrors] = useState<string[]>([]);
  const available = Math.max(0, MAX_VEHICLE_IMAGES - existingCount);

  useEffect(() => {
    itemsRef.current = items;
  }, [items]);

  useEffect(() => () => {
    itemsRef.current.forEach((item) => URL.revokeObjectURL(item.previewUrl));
  }, []);

  function syncInput(next: SelectedImage[]) {
    if (!inputRef.current) return;
    const transfer = new DataTransfer();
    next.forEach((item) => transfer.items.add(item.file));
    inputRef.current.files = transfer.files;
  }

  function selectFiles(files: File[]) {
    const nextErrors: string[] = [];
    const known = new Set(items.map((item) => item.key));
    const accepted = [...items];
    for (const file of files) {
      const key = fileKey(file);
      if (known.has(key)) {
        nextErrors.push(`«${file.name}» уже вибрано.`);
        continue;
      }
      if (!ALLOWED_VEHICLE_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_VEHICLE_IMAGE_TYPES)[number])) {
        nextErrors.push(`«${file.name}»: дозволені лише JPEG, PNG або WebP.`);
        continue;
      }
      if (file.size > MAX_VEHICLE_IMAGE_BYTES) {
        nextErrors.push(`«${file.name}» перевищує 8 МБ.`);
        continue;
      }
      if (accepted.length >= available) {
        nextErrors.push(`Можна вибрати ще не більше ${available} фотографій.`);
        break;
      }
      known.add(key);
      accepted.push({ file, key, previewUrl: URL.createObjectURL(file) });
    }
    setItems(accepted);
    setErrors(nextErrors);
    syncInput(accepted);
  }

  function removeItem(key: string) {
    const item = items.find((candidate) => candidate.key === key);
    if (item) URL.revokeObjectURL(item.previewUrl);
    const next = items.filter((candidate) => candidate.key !== key);
    setItems(next);
    setErrors([]);
    syncInput(next);
  }

  return (
    <fieldset disabled={disabled} className="grid min-w-0 gap-4 rounded-md border border-dashed border-border bg-surface-muted p-4">
      <legend className="px-2 text-base font-bold text-foreground">Фотографії техніки</legend>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
          <LuImagePlus aria-hidden="true" className="size-5" />
        </span>
        <div>
          <label htmlFor="vehicle-form-images" className="text-sm font-bold text-foreground">Додати фотографії</label>
          <p id="vehicle-form-images-help" className="mt-1 text-xs leading-5 text-muted">
            JPEG, PNG або WebP, до 8 МБ кожне. Доступно {available} із {MAX_VEHICLE_IMAGES}.
          </p>
        </div>
      </div>
      <input
        ref={inputRef}
        id="vehicle-form-images"
        name="images"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        aria-describedby="vehicle-form-images-help"
        onChange={(event) => selectFiles(Array.from(event.currentTarget.files ?? []))}
        className="block w-full rounded-md border border-border bg-card p-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-4 file:py-2 file:font-bold file:text-foreground"
      />
      {items.length === 0 ? <p className="text-sm text-muted">Фотографії не вибрано.</p> : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3" aria-label="Вибрані фотографії">
          {items.map((item) => (
            <li key={item.key} className="min-w-0 overflow-hidden rounded-md border border-border bg-card">
              <div className="relative aspect-[4/3] bg-surface-muted">
                <Image src={item.previewUrl} alt={`Попередній перегляд ${item.file.name}`} fill sizes="(min-width: 1024px) 25vw, (min-width: 640px) 42vw, 90vw" className="object-cover" unoptimized />
              </div>
              <div className="flex min-w-0 items-center justify-between gap-2 p-3">
                <span className="min-w-0 truncate text-xs font-semibold text-foreground" title={item.file.name}>{item.file.name}</span>
                <button type="button" onClick={() => removeItem(item.key)} aria-label={`Прибрати фотографію ${item.file.name}`} className="inline-flex size-9 shrink-0 items-center justify-center rounded-md border border-danger/30 text-danger hover:bg-danger/10">
                  <LuX aria-hidden="true" />
                </button>
              </div>
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
