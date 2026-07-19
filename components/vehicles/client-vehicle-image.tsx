'use client';

import Image from 'next/image';
import { useState } from 'react';
import { TbPhotoOff } from 'react-icons/tb';

type ClientVehicleImageProps = {
  src?: string | null;
  alt: string;
  sizes: string;
  priority?: boolean;
  className?: string;
  placeholderLabel?: string;
};

export function ClientVehicleImage({
  src,
  alt,
  sizes,
  priority = false,
  className = 'object-cover',
  placeholderLabel = 'Фото відсутнє'
}: ClientVehicleImageProps) {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div role="img" aria-label={alt} className="flex h-full w-full flex-col items-center justify-center gap-2 px-4 text-center text-sm font-semibold text-muted">
        <TbPhotoOff aria-hidden="true" className="size-7" />
        <span>{placeholderLabel}</span>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      fill
      priority={priority}
      sizes={sizes}
      className={className}
      onError={() => setFailed(true)}
    />
  );
}
