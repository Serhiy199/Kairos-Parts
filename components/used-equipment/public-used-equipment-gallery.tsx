'use client';

import Image from 'next/image';
import { useMemo, useState } from 'react';
import { FaTractor } from 'react-icons/fa';

export type PublicUsedEquipmentGalleryImage = {
  id: string;
  url: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  isPrimary: boolean;
  sortOrder: number;
};

type PublicUsedEquipmentGalleryProps = {
  title: string;
  images: PublicUsedEquipmentGalleryImage[];
};

export function PublicUsedEquipmentGallery({ title, images }: PublicUsedEquipmentGalleryProps) {
  const initialImageId = useMemo(() => images.find((image) => image.isPrimary)?.id ?? images[0]?.id ?? null, [images]);
  const [activeImageId, setActiveImageId] = useState<string | null>(initialImageId);
  const activeImage = images.find((image) => image.id === activeImageId) ?? images.find((image) => image.isPrimary) ?? images[0];

  if (!activeImage) {
    return (
      <div className="flex aspect-[4/3] min-h-[280px] w-full items-center justify-center rounded-lg border border-dashed border-accent/30 bg-[linear-gradient(145deg,#151d29,#0b111a)] text-accent shadow-[0_20px_50px_rgba(0,0,0,0.3)]">
        <FaTractor aria-hidden="true" className="size-16 opacity-85" />
        <span className="sr-only">Фото тимчасово відсутнє</span>
      </div>
    );
  }

  return (
    <section aria-label="Галерея фото техніки" className="grid gap-3">
      <div className="relative aspect-[4/3] overflow-hidden rounded-lg border border-accent/25 bg-public-card shadow-[0_20px_50px_rgba(0,0,0,0.32)]">
        <Image
          src={activeImage.url}
          alt={activeImage.alt ?? `${title} - БВ техніка`}
          fill
          priority
          sizes="(min-width: 1024px) 54vw, 100vw"
          unoptimized
          className="object-contain"
        />
      </div>

      {images.length > 1 ? (
        <div className="flex gap-3 overflow-x-auto pb-1" aria-label="Мініатюри фото">
          {images.map((image, index) => {
            const isActive = image.id === activeImage.id;

            return (
              <button
                key={image.id}
                type="button"
                aria-label={`Показати фото ${index + 1} для ${title}`}
                aria-pressed={isActive}
                onClick={() => setActiveImageId(image.id)}
                className={`relative aspect-[4/3] w-24 shrink-0 overflow-hidden rounded-md border bg-public-elevated transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-28 ${
                  isActive ? 'border-accent ring-2 ring-accent/30' : 'border-public-border hover:border-accent/70'
                }`}
              >
                <Image
                  src={image.url}
                  alt={image.alt ?? `${title} - фото ${index + 1}`}
                  fill
                  sizes="112px"
                  unoptimized
                  className="object-cover"
                />
              </button>
            );
          })}
        </div>
      ) : null}
    </section>
  );
}
