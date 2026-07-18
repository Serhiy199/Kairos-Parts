'use client';

import Image from 'next/image';
import { useEffect, useMemo, useRef, useState } from 'react';
import { FaArrowDown, FaArrowUp, FaImage, FaRegStar, FaStar, FaTrash } from 'react-icons/fa';

import { ALLOWED_USED_EQUIPMENT_IMAGE_TYPES, MAX_USED_EQUIPMENT_IMAGE_BYTES, MAX_USED_EQUIPMENT_IMAGES } from '@/lib/used-equipment/images';

export type UsedEquipmentExistingImage = {
  id: string;
  url: string;
  alt: string | null;
  width: number | null;
  height: number | null;
  isPrimary: boolean;
  sortOrder: number;
};

type ImageItem =
  | {
      key: `existing:${string}`;
      type: 'existing';
      id: string;
      url: string;
      alt: string;
      width: number;
      height: number;
    }
  | {
      key: `new:${number}`;
      type: 'new';
      index: number;
      file: File;
      previewUrl: string;
      alt: string;
    };

type UsedEquipmentImageManagerProps = {
  mode: 'create' | 'edit';
  existingImages?: UsedEquipmentExistingImage[];
  error?: string;
};

function formatSize(bytes: number) {
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function syncInputFiles(input: HTMLInputElement | null, files: File[]) {
  if (!input || typeof DataTransfer === 'undefined') {
    return;
  }

  const transfer = new DataTransfer();
  files.forEach((file) => transfer.items.add(file));
  input.files = transfer.files;
}

export function UsedEquipmentImageManager({ mode, existingImages = [], error }: UsedEquipmentImageManagerProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [deletedIds, setDeletedIds] = useState<string[]>([]);
  const [orderedExistingIds, setOrderedExistingIds] = useState<string[]>(() =>
    existingImages
      .slice()
      .sort((a, b) => a.sortOrder - b.sortOrder)
      .map((image) => image.id)
  );
  const [primaryKey, setPrimaryKey] = useState<string>(() => {
    const primary = existingImages.find((image) => image.isPrimary);
    return primary ? `existing:${primary.id}` : existingImages[0] ? `existing:${existingImages[0].id}` : 'new:0';
  });
  const [message, setMessage] = useState<string | null>(null);

  const newPreviews = useMemo(
    () =>
      selectedFiles.map((file, index) => ({
        key: `new:${index}` as const,
        type: 'new' as const,
        index,
        file,
        previewUrl: URL.createObjectURL(file),
        alt: file.name
      })),
    [selectedFiles]
  );

  useEffect(() => {
    return () => {
      newPreviews.forEach((preview) => URL.revokeObjectURL(preview.previewUrl));
    };
  }, [newPreviews]);

  const existingItems = useMemo<ImageItem[]>(
    () =>
      orderedExistingIds
        .map((id) => existingImages.find((image) => image.id === id))
        .filter((image): image is UsedEquipmentExistingImage => image !== undefined && !deletedIds.includes(image.id))
        .map((image) => ({
          key: `existing:${image.id}` as const,
          type: 'existing' as const,
          id: image.id,
          url: image.url,
          alt: image.alt ?? 'Фото БВ техніки',
          width: image.width ?? 800,
          height: image.height ?? 600
        })),
    [deletedIds, existingImages, orderedExistingIds]
  );

  const items = useMemo<ImageItem[]>(() => [...existingItems, ...newPreviews], [existingItems, newPreviews]);

  useEffect(() => {
    if (items.length === 0) {
      setPrimaryKey('new:0');
      return;
    }

    if (!items.some((item) => item.key === primaryKey)) {
      setPrimaryKey(items[0].key);
    }
  }, [items, primaryKey]);

  const selectedFileLimitLeft = MAX_USED_EQUIPMENT_IMAGES - existingItems.length;

  function setFiles(nextFiles: File[]) {
    setSelectedFiles(nextFiles);
    syncInputFiles(inputRef.current, nextFiles);
  }

  function validateFile(file: File) {
    if (!ALLOWED_USED_EQUIPMENT_IMAGE_TYPES.includes(file.type as (typeof ALLOWED_USED_EQUIPMENT_IMAGE_TYPES)[number])) {
      return 'Дозволені лише JPG, PNG або WEBP фото.';
    }

    if (file.size > MAX_USED_EQUIPMENT_IMAGE_BYTES) {
      return 'Розмір одного фото не має перевищувати 10 MB.';
    }

    return null;
  }

  function handleSelectFiles(files: FileList | null) {
    setMessage(null);

    if (!files?.length) {
      return;
    }

    const incoming = Array.from(files);
    const invalidMessage = incoming.map(validateFile).find(Boolean);

    if (invalidMessage) {
      setMessage(invalidMessage);
      syncInputFiles(inputRef.current, selectedFiles);
      return;
    }

    const allowed = incoming.slice(0, Math.max(0, selectedFileLimitLeft - selectedFiles.length));

    if (allowed.length < incoming.length) {
      setMessage(`Можна додати максимум ${MAX_USED_EQUIPMENT_IMAGES} фото для однієї одиниці техніки.`);
    }

    setFiles([...selectedFiles, ...allowed]);
  }

  function removeItem(item: ImageItem) {
    setMessage(null);

    if (item.type === 'existing') {
      setDeletedIds([...deletedIds, item.id]);
      return;
    }

    setFiles(selectedFiles.filter((_, index) => index !== item.index));
  }

  function moveExistingImage(id: string, direction: -1 | 1) {
    const availableIds = orderedExistingIds.filter((imageId) => !deletedIds.includes(imageId));
    const availableIndex = availableIds.indexOf(id);
    const toAvailableIndex = availableIndex + direction;

    if (availableIndex < 0 || toAvailableIndex < 0 || toAvailableIndex >= availableIds.length) {
      return;
    }

    const targetId = availableIds[toAvailableIndex];
    const nextIds = [...orderedExistingIds];
    const fromIndex = nextIds.indexOf(id);
    const toIndex = nextIds.indexOf(targetId);
    nextIds[fromIndex] = targetId;
    nextIds[toIndex] = id;
    setOrderedExistingIds(nextIds);
  }

  function moveItem(item: ImageItem, direction: -1 | 1) {
    if (item.type === 'existing') {
      moveExistingImage(item.id, direction);
      return;
    }

    const toIndex = item.index + direction;
    if (toIndex < 0 || toIndex >= selectedFiles.length) {
      return;
    }

    const nextFiles = [...selectedFiles];
    const [moved] = nextFiles.splice(item.index, 1);
    nextFiles.splice(toIndex, 0, moved);
    setFiles(nextFiles);
  }

  const orderValue = items.map((item) => item.key).join(',');
  const primarySelectedIndex = Math.max(
    0,
    newPreviews.findIndex((item) => item.key === primaryKey)
  );

  return (
    <section className="grid gap-4 rounded-lg border border-border bg-surface-muted p-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-sm font-bold uppercase text-accent">Фото техніки</p>
          <h3 className="mt-1 text-lg font-bold text-foreground">Зображення для майданчика</h3>
          <p className="mt-1 text-sm leading-6 text-muted">
            Додайте до {MAX_USED_EQUIPMENT_IMAGES} фото у форматі JPG, PNG або WEBP. Перше або позначене зіркою фото буде основним.
          </p>
        </div>
        <span className="rounded-full bg-card px-3 py-1 text-xs font-bold text-muted">
          {items.length}/{MAX_USED_EQUIPMENT_IMAGES}
        </span>
      </div>

      <input ref={inputRef} type="file" name="images" accept="image/jpeg,image/png,image/webp" multiple className="sr-only" onChange={(event) => handleSelectFiles(event.target.files)} />
      <input type="hidden" name="imageOrder" value={orderValue} />
      <input type="hidden" name="deletedImageIds" value={deletedIds.join(',')} />
      <input type="hidden" name="primaryImageKey" value={primaryKey} />
      <input type="hidden" name="primarySelectedIndex" value={primarySelectedIndex} />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-accent/50 bg-card px-4 text-sm font-bold text-foreground transition hover:border-accent hover:text-accent"
        >
          <FaImage aria-hidden="true" className="size-4" />
          Додати фото
        </button>
        <p className="text-xs font-medium text-muted">
          Максимум {MAX_USED_EQUIPMENT_IMAGES} фото, до {formatSize(MAX_USED_EQUIPMENT_IMAGE_BYTES)} кожне.
          {mode === 'create' ? ' Для створення потрібне щонайменше одне фото.' : ''}
        </p>
      </div>

      {error || message ? (
        <div className="rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
          {error ?? message}
        </div>
      ) : null}

      {items.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {items.map((item, index) => (
            <article key={item.key} className="overflow-hidden rounded-lg border border-border bg-card shadow-sm">
              <div className="relative aspect-[4/3] bg-surface-muted">
                {item.type === 'existing' ? (
                  <Image src={item.url} alt={item.alt} fill sizes="(min-width: 1280px) 30vw, (min-width: 640px) 45vw, 90vw" className="object-cover" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.previewUrl} alt={item.alt} className="h-full w-full object-cover" />
                )}
                {primaryKey === item.key ? (
                  <span className="absolute left-3 top-3 rounded-full bg-accent px-3 py-1 text-xs font-bold text-foreground">Основне</span>
                ) : null}
              </div>
              <div className="grid gap-3 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">{item.type === 'existing' ? item.alt : item.file.name}</p>
                  <span className="text-xs font-bold text-muted">#{index + 1}</span>
                </div>
                <div className="grid grid-cols-4 gap-2">
                  <button type="button" onClick={() => setPrimaryKey(item.key)} className="inline-flex h-9 items-center justify-center rounded-md border border-border text-accent transition hover:border-accent" aria-label="Зробити основним фото">
                    {primaryKey === item.key ? <FaStar aria-hidden="true" /> : <FaRegStar aria-hidden="true" />}
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(item, -1)}
                    disabled={item.type === 'existing' ? index === 0 : item.index === 0}
                    className="inline-flex h-9 items-center justify-center rounded-md border border-border text-muted transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Підняти фото"
                  >
                    <FaArrowUp aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveItem(item, 1)}
                    disabled={item.type === 'existing' ? index === existingItems.length - 1 : item.index === selectedFiles.length - 1}
                    className="inline-flex h-9 items-center justify-center rounded-md border border-border text-muted transition hover:border-accent hover:text-accent disabled:cursor-not-allowed disabled:opacity-40"
                    aria-label="Опустити фото"
                  >
                    <FaArrowDown aria-hidden="true" />
                  </button>
                  <button type="button" onClick={() => removeItem(item)} className="inline-flex h-9 items-center justify-center rounded-md border border-danger/30 text-danger transition hover:bg-danger/10" aria-label="Видалити фото">
                    <FaTrash aria-hidden="true" />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-md border border-dashed border-border bg-card px-4 py-8 text-center text-sm font-medium text-muted">
          Фото ще не додані.
        </div>
      )}
    </section>
  );
}
