'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';

type ClientVehicleGalleryImage = {
  id: string;
  secureUrl: string;
  isPrimary: boolean;
};

export function ClientVehicleGallery({ vehicleLabel, images }: { vehicleLabel: string; images: ClientVehicleGalleryImage[] }) {
  const initialId = useMemo(() => images.find((image) => image.isPrimary)?.id ?? images[0]?.id ?? null, [images]);
  const [activeId, setActiveId] = useState(initialId);
  const active = images.find((image) => image.id === activeId) ?? images[0];

  if (!active) {
    return (
      <section className="rounded-lg border border-border bg-card p-6 shadow-card">
        <h3 className="text-xl font-bold text-foreground">Фотографії техніки</h3>
        <p className="mt-4 rounded-md border border-dashed border-border p-6 text-center text-sm text-muted">Фотографії ще не додані.</p>
      </section>
    );
  }

  return (
    <section className="grid gap-4 rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
      <h3 className="text-xl font-bold text-foreground">Фотографії техніки</h3>
      <div className="relative aspect-[16/10] overflow-hidden rounded-md bg-surface-muted sm:aspect-[16/9]">
        <Image src={active.secureUrl} alt={vehicleLabel} fill priority sizes="(min-width: 1024px) 70vw, 94vw" className="object-contain" />
      </div>
      {images.length > 1 ? (
        <div className="grid grid-cols-3 gap-3 sm:grid-cols-5 md:grid-cols-6">
          {images.map((image, index) => (
            <button key={image.id} type="button" onClick={() => setActiveId(image.id)} aria-label={`Показати фото ${vehicleLabel} — ${index + 1}`} aria-pressed={image.id === active.id} className={`relative aspect-[4/3] overflow-hidden rounded-md border-2 bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${image.id === active.id ? 'border-accent' : 'border-transparent'}`}>
              <Image src={image.secureUrl} alt={`Фото ${vehicleLabel} — ${index + 1}`} fill sizes="160px" className="object-cover" />
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
