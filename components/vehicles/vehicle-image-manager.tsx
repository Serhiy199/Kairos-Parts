'use client';

import Image from 'next/image';
import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { LuArrowLeft, LuArrowRight, LuImagePlus, LuStar, LuTrash2 } from 'react-icons/lu';

import {
  EMPTY_VEHICLE_IMAGE_ACTION_STATE,
  MAX_VEHICLE_IMAGE_BYTES,
  MAX_VEHICLE_IMAGES,
  type VehicleImageActionState
} from '@/lib/vehicles/images';

export type VehicleGalleryImage = {
  id: string;
  secureUrl: string;
  width: number | null;
  height: number | null;
  sortOrder: number;
  isPrimary: boolean;
};

type VehicleImageManagerProps = {
  vehicleId: string;
  vehicleLabel: string;
  images: VehicleGalleryImage[];
  uploadAction: (state: VehicleImageActionState, formData: FormData) => Promise<VehicleImageActionState>;
  setPrimaryAction: (imageId: string) => Promise<VehicleImageActionState>;
  reorderAction: (orderedImageIds: string[]) => Promise<VehicleImageActionState>;
  deleteAction: (imageId: string) => Promise<VehicleImageActionState>;
};

export function VehicleImageManager({ vehicleLabel, images, uploadAction, setPrimaryAction, reorderAction, deleteAction }: VehicleImageManagerProps) {
  const [state, formAction, isPending] = useActionState(uploadAction, EMPTY_VEHICLE_IMAGE_ACTION_STATE);
  const [actionState, setActionState] = useState(EMPTY_VEHICLE_IMAGE_ACTION_STATE);
  const [isGalleryPending, startGalleryTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (state.status === 'success' && inputRef.current) {
      inputRef.current.value = '';
    }
  }, [state]);

  function moveImage(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;
    const ordered = images.map((image) => image.id);
    [ordered[index], ordered[target]] = [ordered[target], ordered[index]];
    runGalleryAction(reorderAction(ordered));
  }

  function runGalleryAction(action: Promise<VehicleImageActionState>) {
    setActionState(EMPTY_VEHICLE_IMAGE_ACTION_STATE);
    startGalleryTransition(async () => {
      setActionState(await action);
    });
  }

  return (
    <section className="grid gap-5 rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <p className="text-sm font-bold uppercase text-accent">Фотографії</p>
          <h2 className="mt-2 text-xl font-bold text-foreground">Галерея техніки</h2>
          <p className="mt-2 text-sm leading-6 text-muted">JPEG, PNG або WebP. До 8 МБ кожне. Максимум 10 фото.</p>
        </div>
        <span className="w-fit rounded-full bg-surface-muted px-3 py-1 text-xs font-bold text-muted">{images.length}/{MAX_VEHICLE_IMAGES}</span>
      </div>

      <form action={formAction} className="grid gap-3 rounded-md border border-dashed border-border bg-surface-muted p-4">
        <label htmlFor="vehicle-images" className="text-sm font-bold text-foreground">Додати фотографії</label>
        <input
          ref={inputRef}
          id="vehicle-images"
          name="images"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          required
          className="block w-full rounded-md border border-border bg-card p-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-4 file:py-2 file:font-bold file:text-foreground"
        />
        <p className="text-xs text-muted">Максимальний розмір: {MAX_VEHICLE_IMAGE_BYTES / 1024 / 1024} МБ на файл.</p>
        <button disabled={isPending || images.length >= MAX_VEHICLE_IMAGES} className="inline-flex min-h-11 w-fit items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-50">
          <LuImagePlus aria-hidden="true" className="size-4" />
          {isPending ? 'Завантаження...' : 'Завантажити фото'}
        </button>
        {state.message ? (
          <p aria-live="polite" className={state.status === 'error' ? 'rounded-md border border-danger/30 bg-danger/10 p-3 text-sm font-semibold text-danger' : 'rounded-md border border-success/30 bg-[#E7F6EC] p-3 text-sm font-semibold text-success'}>
            {state.message}
          </p>
        ) : null}
      </form>

      {images.length === 0 ? (
        <p className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted">Фотографії ще не додані.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {images.map((image, index) => (
            <article key={image.id} className="overflow-hidden rounded-md border border-border bg-card">
              <div className="relative aspect-[4/3] bg-surface-muted">
                <Image src={image.secureUrl} alt={`Фото ${vehicleLabel} — ${index + 1}`} fill sizes="(min-width: 1280px) 28vw, (min-width: 640px) 45vw, 92vw" className="object-cover" />
                {image.isPrimary ? <span className="absolute left-3 top-3 rounded-full bg-accent px-3 py-1 text-xs font-bold text-foreground">Головне фото</span> : null}
              </div>
              <div className="grid grid-cols-4 gap-2 p-3">
                <button type="button" onClick={() => moveImage(index, -1)} disabled={isGalleryPending || index === 0} aria-label="Перемістити фото вліво" className="inline-flex h-10 items-center justify-center rounded-md border border-border text-muted hover:border-accent disabled:opacity-40"><LuArrowLeft aria-hidden="true" /></button>
                <button type="button" onClick={() => moveImage(index, 1)} disabled={isGalleryPending || index === images.length - 1} aria-label="Перемістити фото вправо" className="inline-flex h-10 items-center justify-center rounded-md border border-border text-muted hover:border-accent disabled:opacity-40"><LuArrowRight aria-hidden="true" /></button>
                <button type="button" onClick={() => runGalleryAction(setPrimaryAction(image.id))} disabled={isGalleryPending || image.isPrimary} aria-label="Зробити головним фото" className="inline-flex h-10 w-full items-center justify-center rounded-md border border-border text-accent hover:border-accent disabled:opacity-40"><LuStar aria-hidden="true" /></button>
                <details className="relative">
                  <summary aria-label="Видалити фотографію" className="flex h-10 cursor-pointer list-none items-center justify-center rounded-md border border-danger/30 text-danger hover:bg-danger/10"><LuTrash2 aria-hidden="true" /></summary>
                  <div className="absolute bottom-12 right-0 z-10 w-56 rounded-md border border-border bg-card p-3 shadow-card">
                    <p className="text-xs font-semibold text-foreground">Видалити це фото без можливості відновлення?</p>
                    <button type="button" disabled={isGalleryPending} onClick={() => runGalleryAction(deleteAction(image.id))} className="mt-3 w-full rounded-md bg-danger px-3 py-2 text-xs font-bold text-white disabled:opacity-50">Підтвердити видалення</button>
                  </div>
                </details>
              </div>
            </article>
          ))}
        </div>
      )}

      {actionState.message ? (
        <p aria-live="polite" className={actionState.status === 'error' ? 'rounded-md border border-danger/30 bg-danger/10 p-3 text-sm font-semibold text-danger' : 'rounded-md border border-success/30 bg-[#E7F6EC] p-3 text-sm font-semibold text-success'}>
          {actionState.message}
        </p>
      ) : null}
    </section>
  );
}
