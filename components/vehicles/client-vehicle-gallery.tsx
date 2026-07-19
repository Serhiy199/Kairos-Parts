'use client';

import { useEffect, useMemo, useState } from 'react';

import { ClientVehicleImage } from '@/components/vehicles/client-vehicle-image';

type ClientVehicleGalleryImage = {
  id: string;
  secureUrl: string;
  isPrimary: boolean;
};

export function ClientVehicleGallery({ vehicleLabel, images }: { vehicleLabel: string; images: ClientVehicleGalleryImage[] }) {
  const initialId = useMemo(() => images.find((image) => image.isPrimary)?.id ?? images[0]?.id ?? null, [images]);
  const [activeId, setActiveId] = useState(initialId);
  const activeIndex = Math.max(0, images.findIndex((image) => image.id === activeId));
  const active = images[activeIndex] ?? images[0];

  useEffect(() => {
    setActiveId(initialId);
  }, [initialId]);

  if (!active) {
    return (
      <section aria-labelledby="vehicle-gallery-heading" className="rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
        <h2 id="vehicle-gallery-heading" className="text-xl font-bold text-foreground">Фотографії техніки</h2>
        <div className="mt-4 flex min-h-56 items-center justify-center rounded-md border border-dashed border-border bg-surface-muted text-sm font-semibold text-muted">
          Фотографії ще не додані
        </div>
      </section>
    );
  }

  return (
    <section aria-labelledby="vehicle-gallery-heading" className="grid min-w-0 gap-4 rounded-lg border border-border bg-card p-4 shadow-card sm:p-6">
      <div className="flex items-center justify-between gap-4">
        <h2 id="vehicle-gallery-heading" className="text-xl font-bold text-foreground">Фотографії техніки</h2>
        <span aria-live="polite" className="text-xs font-semibold text-muted">{activeIndex + 1} / {images.length}</span>
      </div>
      <div className="relative aspect-[16/10] overflow-hidden rounded-md bg-surface-muted sm:aspect-[16/9]">
        <ClientVehicleImage
          key={active.id}
          src={active.secureUrl}
          alt={`${vehicleLabel} — фото ${activeIndex + 1}`}
          sizes="(min-width: 1280px) 760px, (min-width: 1024px) 58vw, 94vw"
          priority
          className="object-contain"
          placeholderLabel="Не вдалося завантажити фото"
        />
      </div>
      {images.length > 1 ? (
        <div className="flex max-w-full gap-3 overflow-x-auto pb-1" aria-label="Мініатюри фотографій техніки">
          {images.map((image, index) => {
            const isActive = image.id === active.id;

            return (
              <button
                key={image.id}
                type="button"
                onClick={() => setActiveId(image.id)}
                aria-label={`Показати фото ${index + 1}`}
                aria-current={isActive ? 'true' : undefined}
                className={`relative aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-md border-2 bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent sm:w-28 ${
                  isActive ? 'border-accent' : 'border-transparent hover:border-border'
                }`}
              >
                <ClientVehicleImage
                  src={image.secureUrl}
                  alt={`Фото ${vehicleLabel} — ${index + 1}`}
                  sizes="112px"
                  placeholderLabel={`Фото ${index + 1}`}
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
