'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';

import { ActionIcon } from '@/components/ui/action-icons';
import type { CatalogCategory } from '@/lib/catalog/catalog-data';
import { ALLOWED_UPLOAD_EXTENSIONS, ALLOWED_UPLOAD_MIME_TYPES } from '@/lib/files/upload-policy';

type RequestFormProps = {
  categories: CatalogCategory[];
  initialCategory?: string;
  initialContact?: {
    contactName?: string;
    companyName?: string;
    phone?: string;
    email?: string;
  };
  initialMode?: string;
  initialRequest?: {
    vehicleId?: string;
    category?: string;
    equipmentType?: string;
    manufacturer?: string;
    model?: string;
    vinOrSerial?: string;
    description?: string;
    comment?: string;
  };
  initialSource?: 'client';
  maxSizeMb: number;
};

type SubmitState =
  | { status: 'idle' }
  | { status: 'submitting' }
  | { status: 'success'; requestNumber: string; publicStatusUrl: string }
  | { status: 'error'; message: string; errors?: string[] };

export function RequestForm({ categories, initialCategory, initialContact, initialMode, initialRequest, initialSource, maxSizeMb }: RequestFormProps) {
  const requestCategory = initialRequest?.category || initialCategory;
  const initialCategoryExists = categories.some((category) => category.slug === requestCategory);
  const [formType, setFormType] = useState<'quick' | 'detailed'>(initialMode === 'file' || initialRequest ? 'detailed' : 'quick');
  const [selectedCategory, setSelectedCategory] = useState(initialCategoryExists ? (requestCategory ?? '') : '');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [submitState, setSubmitState] = useState<SubmitState>({ status: 'idle' });

  const selectedCategoryData = useMemo(
    () => categories.find((category) => category.slug === selectedCategory),
    [categories, selectedCategory]
  );
  const manufacturers = selectedCategoryData?.manufacturers ?? [];

  function validateFiles(files: File[]) {
    const maxSizeBytes = maxSizeMb * 1024 * 1024;
    const errors: string[] = [];

    for (const file of files) {
      const lowerName = file.name.toLowerCase();
      const hasAllowedExtension = ALLOWED_UPLOAD_EXTENSIONS.some((extension) => lowerName.endsWith(extension));
      const hasAllowedMimeType = ALLOWED_UPLOAD_MIME_TYPES.includes(file.type as (typeof ALLOWED_UPLOAD_MIME_TYPES)[number]) || file.type === '';

      if (!hasAllowedExtension || !hasAllowedMimeType) {
        errors.push(`Файл "${file.name}" має непідтримуваний формат.`);
      }

      if (file.size > maxSizeBytes) {
        errors.push(`Файл "${file.name}" перевищує ${maxSizeMb} MB.`);
      }
    }

    return errors;
  }

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    const errors = validateFiles(files);

    setSelectedFiles(files);

    if (errors.length > 0) {
      setSubmitState({
        status: 'error',
        message: 'Перевірте файли перед відправкою.',
        errors
      });
      return;
    }

    if (submitState.status === 'error') {
      setSubmitState({ status: 'idle' });
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;

    const fileErrors = validateFiles(selectedFiles);

    if (fileErrors.length > 0) {
      setSubmitState({
        status: 'error',
        message: 'Перевірте файли перед відправкою.',
        errors: fileErrors
      });
      return;
    }

    setSubmitState({ status: 'submitting' });

    const formData = new FormData(form);
    formData.set('formType', formType);

    try {
      const response = await fetch('/api/requests', {
        method: 'POST',
        body: formData
      });
      const payload = (await response.json()) as {
        requestNumber?: string;
        publicStatusUrl?: string;
        message?: string;
        errors?: string[];
        status?: string;
      };

      if (!response.ok) {
        setSubmitState({
          status: 'error',
          message: payload.message ?? 'Не вдалося створити заявку.',
          errors: payload.errors
        });
        return;
      }

      form.reset();
      setSelectedFiles([]);
      setSubmitState({
        status: 'success',
        requestNumber: payload.requestNumber ?? '',
        publicStatusUrl: payload.publicStatusUrl ?? '/'
      });
    } catch (error) {
      console.error('Request form submit failed', error);
      setSubmitState({
        status: 'error',
        message: 'Не вдалося відправити заявку. Спробуйте ще раз або напишіть нам у Telegram.'
      });
    }
  }

  if (submitState.status === 'success') {
    return (
      <div className="rounded-lg border border-border bg-card p-6 shadow-card">
        <p className="text-sm font-bold uppercase text-success">Заявку створено</p>
        <h2 className="mt-2 text-3xl font-bold text-foreground">Номер заявки: {submitState.requestNumber}</h2>
        <p className="mt-4 text-sm leading-6 text-muted">
          Менеджер Kairos Parts зв&apos;яжеться з вами для уточнення деталей. Збережіть посилання на статус заявки.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href={submitState.publicStatusUrl}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-center text-sm font-bold text-foreground transition hover:bg-accent-hover"
          >
            <ActionIcon name="search" />
            Переглянути статус
          </Link>
          <button
            type="button"
            onClick={() => setSubmitState({ status: 'idle' })}
            className="inline-flex items-center justify-center gap-2 rounded-md border border-border px-5 py-3 text-sm font-semibold text-foreground transition hover:border-accent hover:bg-surface-muted"
          >
            <ActionIcon name="plus" />
            Створити ще одну заявку
          </button>
          <Link
            href="/"
            className="rounded-md border border-border px-5 py-3 text-center text-sm font-semibold text-foreground transition hover:border-accent hover:bg-surface-muted"
          >
            Перейти на головну
          </Link>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="rounded-lg border border-border bg-card p-6 shadow-card">
      <div className="grid gap-2 rounded-lg bg-surface-muted p-1 sm:grid-cols-2">
        {(['quick', 'detailed'] as const).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => setFormType(type)}
            className={`rounded-md px-4 py-3 text-sm font-bold transition ${
              formType === type ? 'bg-primary text-white shadow-card' : 'text-muted hover:bg-card hover:text-foreground'
            }`}
          >
            {type === 'quick' ? 'Швидка заявка' : 'Детальна заявка'}
          </button>
        ))}
      </div>

      {initialMode === 'file' ? (
        <div className="mt-5 rounded-lg border border-accent/40 bg-[#F7F1E8] p-4 text-sm leading-6 text-foreground">
          Ви перейшли в режим завантаження файлу або фото. Додайте файл у блоці нижче та коротко опишіть потребу.
        </div>
      ) : null}

      <input type="hidden" name="formType" value={formType} />
      {initialSource ? <input type="hidden" name="source" value={initialSource} /> : null}
      {initialRequest?.vehicleId ? <input type="hidden" name="vehicleId" value={initialRequest.vehicleId} /> : null}

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-foreground">
          Імʼя або назва компанії *
          <input
            name="contactName"
            required
            defaultValue={initialContact?.contactName}
            className="h-11 rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25"
            placeholder="ТОВ Агро-Тех або Іваненко Іван"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-foreground">
          Телефон *
          <input
            name="phone"
            required
            defaultValue={initialContact?.phone}
            className="h-11 rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25"
            placeholder="+38 (067) 123 45 67"
          />
        </label>
        {initialContact ? (
          <label className="grid gap-2 text-sm font-semibold text-foreground md:col-span-2">
            Назва компанії
            <input
              name="companyName"
              defaultValue={initialContact.companyName}
              className="h-11 rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25"
              placeholder="ТОВ Агро-Тех"
            />
          </label>
        ) : null}
        <label className="grid gap-2 text-sm font-semibold text-foreground md:col-span-2">
          Email
          <input
            name="email"
            type="email"
            defaultValue={initialContact?.email}
            className="h-11 rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25"
            placeholder="name@company.ua"
          />
        </label>
      </div>

      {formType === 'detailed' ? (
        <div className="mt-6 grid gap-5 md:grid-cols-2">
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Тип техніки
            <input name="equipmentType" defaultValue={initialRequest?.equipmentType} className="h-11 rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Категорія
            <select
              name="category"
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value)}
              className="h-11 rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25"
            >
              <option value="">Не обрано</option>
              {categories.map((category) => (
                <option key={category.id} value={category.slug}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Виробник
            <select name="manufacturer" defaultValue={initialRequest?.manufacturer ?? ''} className="h-11 rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25">
              <option value="">Не обрано</option>
              {initialRequest?.manufacturer && !manufacturers.includes(initialRequest.manufacturer) ? (
                <option value={initialRequest.manufacturer}>{initialRequest.manufacturer}</option>
              ) : null}
              {manufacturers.map((manufacturer) => (
                <option key={manufacturer} value={manufacturer}>
                  {manufacturer}
                </option>
              ))}
            </select>
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Модель
            <input name="model" defaultValue={initialRequest?.model} className="h-11 rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25" />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-foreground md:col-span-2">
            VIN / серійний номер
            <input name="vinOrSerial" defaultValue={initialRequest?.vinOrSerial} className="h-11 rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25" />
          </label>
        </div>
      ) : (
        <input type="hidden" name="category" value={selectedCategory} />
      )}

      <label className="mt-6 grid gap-2 text-sm font-semibold text-foreground">
        Опис потреби *
        <textarea
          name="description"
          required
          defaultValue={initialRequest?.description}
          className="min-h-32 rounded-md border border-border bg-white px-3 py-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25"
          placeholder="Опишіть, яку запчастину потрібно підібрати, для якої техніки, що відомо про вузол або проблему."
        />
      </label>

      {formType === 'detailed' ? (
        <label className="mt-6 grid gap-2 text-sm font-semibold text-foreground">
          Коментар
          <textarea
            name="comment"
            defaultValue={initialRequest?.comment}
            className="min-h-24 rounded-md border border-border bg-white px-3 py-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25"
            placeholder="Додаткові побажання, терміновість, аналоги, умови доставки."
          />
        </label>
      ) : null}

      <div className="mt-6 rounded-lg border border-dashed border-border bg-surface-muted p-5">
        <label className="grid gap-3 text-sm font-semibold text-foreground">
          Додайте фото, список або документ
          <input
            name="files"
            type="file"
            multiple
            accept={ALLOWED_UPLOAD_EXTENSIONS.join(',')}
            onChange={handleFileChange}
            className="block w-full rounded-md border border-border bg-white px-3 py-2 text-sm text-muted file:mr-4 file:rounded-md file:border file:border-accent file:bg-white file:px-4 file:py-2 file:text-sm file:font-bold file:text-[#8A5B24] file:transition hover:file:bg-accent/10"
          />
        </label>
        <p className="mt-3 text-sm leading-6 text-foreground">
          Можна прикріпити фото деталі, список позицій, PDF, Excel або документ із артикулами.
        </p>
        <p className="mt-1 text-xs leading-5 text-muted">
          Дозволені формати: JPG, PNG, PDF, XLS, XLSX, CSV, DOC, DOCX. Максимальний розмір одного файлу: {maxSizeMb} MB.
        </p>
        {selectedFiles.length > 0 ? (
          <div className="mt-4 grid gap-2">
            {selectedFiles.map((file) => (
              <div key={`${file.name}-${file.size}`} className="rounded-md border border-border bg-card px-3 py-2 text-xs text-muted">
                {file.name} — {(file.size / 1024 / 1024).toFixed(2)} MB
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {submitState.status === 'error' ? (
        <div className="mt-5 rounded-lg border border-danger/30 bg-[#FEF3F2] p-4 text-sm leading-6 text-danger">
          <p className="font-bold">{submitState.message}</p>
          {submitState.errors?.length ? (
            <ul className="mt-2 list-inside list-disc">
              {submitState.errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}

      <button
        type="submit"
        disabled={submitState.status === 'submitting'}
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        <ActionIcon name={submitState.status === 'submitting' ? 'refresh' : 'send'} />
        {submitState.status === 'submitting' ? 'Створюємо заявку...' : 'Створити заявку'}
      </button>
    </form>
  );
}
