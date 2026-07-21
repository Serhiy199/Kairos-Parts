'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';

import { ActionIcon } from '@/components/ui/action-icons';
import { SearchableCombobox, type SearchableComboboxOption } from '@/components/ui/searchable-combobox';
import { EQUIPMENT_TAXONOMY_REQUEST_FIELDS_ENABLED, EQUIPMENT_TEXT_FIELD_MAX_LENGTH } from '@/lib/features/equipment-taxonomy';
import { ALLOWED_UPLOAD_EXTENSIONS, ALLOWED_UPLOAD_MIME_TYPES } from '@/lib/files/upload-policy';
import type { EquipmentTaxonomyType } from '@/lib/vehicles/taxonomy';

type RequestFormProps = {
  taxonomy: EquipmentTaxonomyType[];
  initialContact?: {
    contactName?: string;
    companyName?: string;
    phone?: string;
    email?: string;
  };
  initialMode?: string;
  initialRequest?: {
    vehicleId?: string;
    equipmentType?: string;
    manufacturer?: string;
    model?: string;
    vehicleYear?: number | null;
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

type FieldErrors = {
  equipmentType?: string;
  manufacturer?: string;
};

function uniqueSortedOptions(values: string[]): SearchableComboboxOption[] {
  return Array.from(new Set(values.filter(Boolean)))
    .sort((left, right) => left.localeCompare(right, 'uk'))
    .map((value) => ({ value, label: value }));
}

export function RequestForm({
  taxonomy,
  initialContact,
  initialMode,
  initialRequest,
  initialSource,
  maxSizeMb
}: RequestFormProps) {
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [equipmentType, setEquipmentType] = useState(initialRequest?.equipmentType ?? '');
  const [manufacturer, setManufacturer] = useState(initialRequest?.manufacturer ?? '');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitState, setSubmitState] = useState<SubmitState>({ status: 'idle' });

  const equipmentTypeOptions = useMemo(() => {
    const values = taxonomy.map((type) => type.name);

    if (initialRequest?.equipmentType && !values.includes(initialRequest.equipmentType)) {
      values.push(initialRequest.equipmentType);
    }

    return uniqueSortedOptions(values);
  }, [initialRequest?.equipmentType, taxonomy]);

  const manufacturerComboboxOptions = useMemo(() => {
    const selectedType = taxonomy.find((type) => type.name === equipmentType);
    const options = (selectedType?.manufacturers ?? []).map((manufacturer) => manufacturer.name);

    if (initialRequest?.manufacturer && !options.includes(initialRequest.manufacturer)) {
      options.push(initialRequest.manufacturer);
    }

    return uniqueSortedOptions(options);
  }, [equipmentType, initialRequest?.manufacturer, taxonomy]);

  useEffect(() => {
    if (!EQUIPMENT_TAXONOMY_REQUEST_FIELDS_ENABLED || !manufacturer) {
      return;
    }

    if (!manufacturerComboboxOptions.some((option) => option.value === manufacturer)) {
      setManufacturer('');
    }
  }, [manufacturer, manufacturerComboboxOptions]);

  function handleEquipmentTypeChange(value: string) {
    setEquipmentType(value);
    setFieldErrors((current) => ({ ...current, equipmentType: undefined }));

    if (submitState.status === 'error') {
      setSubmitState({ status: 'idle' });
    }
  }

  function handleManufacturerChange(value: string) {
    setManufacturer(value);
    setFieldErrors((current) => ({ ...current, manufacturer: undefined }));

    if (submitState.status === 'error') {
      setSubmitState({ status: 'idle' });
    }
  }

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
    const nextFieldErrors: FieldErrors = {};

    if (!equipmentType.trim()) {
      nextFieldErrors.equipmentType = 'Вкажіть тип техніки.';
    }

    if (!manufacturer.trim()) {
      nextFieldErrors.manufacturer = 'Вкажіть виробника або марку.';
    }

    if (Object.keys(nextFieldErrors).length > 0) {
      setFieldErrors(nextFieldErrors);
      setSubmitState({
        status: 'error',
        message: 'Заповніть обовʼязкові поля.'
      });
      return;
    }

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
    formData.set('formType', 'detailed');

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
      setEquipmentType('');
      setManufacturer('');
      setFieldErrors({});
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
    <div className="public-card p-6">
      <p className="text-sm font-bold uppercase text-public-success">Заявку створено</p>
      <h2 className="mt-2 text-3xl font-bold text-public-primary">Номер заявки: {submitState.requestNumber}</h2>
      <p className="mt-4 text-sm leading-6 text-public-muted">
          Менеджер Kairos Parts зв&apos;яжеться з вами для уточнення деталей. Збережіть посилання на статус заявки.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href={submitState.publicStatusUrl}
          className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-center text-sm font-bold text-primary transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <ActionIcon name="search" />
            Переглянути статус
          </Link>
          <button
            type="button"
            onClick={() => setSubmitState({ status: 'idle' })}
          className="inline-flex items-center justify-center gap-2 rounded-md border border-public-border px-5 py-3 text-sm font-semibold text-public-primary transition hover:border-public-border-accent-hover hover:bg-public-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            <ActionIcon name="plus" />
            Створити ще одну заявку
          </button>
          <Link
            href="/"
          className="rounded-md border border-public-border px-5 py-3 text-center text-sm font-semibold text-public-primary transition hover:border-public-border-accent-hover hover:bg-public-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
          >
            Перейти на головну
          </Link>
        </div>
      </div>
    );
  }

  return (
  <form onSubmit={handleSubmit} className="public-card p-6">
      <div>
        <p className="text-sm font-bold uppercase text-accent">Створити заявку</p>
      <h2 className="mt-2 text-3xl font-bold text-public-primary">Заявка на підбір запчастин</h2>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-public-muted">
          Опишіть техніку, потрібні запчастини та додайте фото або файл. Менеджер перевірить сумісність і запропонує рішення.
        </p>
      </div>

      {initialMode === 'file' ? (
        <div className="public-callout mt-5 rounded-lg p-4 text-sm leading-6">
          Додайте файл або фото у блоці нижче та коротко опишіть потребу. Форма працює в єдиному детальному форматі заявки.
        </div>
      ) : null}

      <input type="hidden" name="formType" value="detailed" />
      {initialSource ? <input type="hidden" name="source" value={initialSource} /> : null}
      {initialRequest?.vehicleId ? <input type="hidden" name="vehicleId" value={initialRequest.vehicleId} /> : null}

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-public-secondary">
          Імʼя контактної особи *
          <input
            name="contactName"
            required
            defaultValue={initialContact?.contactName}
          className="public-field h-11 rounded-md px-3 text-sm transition"
            placeholder="Іваненко Іван"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-public-secondary">
          Телефон *
          <input
            name="phone"
            required
            defaultValue={initialContact?.phone}
          className="public-field h-11 rounded-md px-3 text-sm transition"
            placeholder="+38 (067) 123 45 67"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-public-secondary md:col-span-2">
          Компанія *
          <input
            name="companyName"
            required
            defaultValue={initialContact?.companyName}
          className="public-field h-11 rounded-md px-3 text-sm transition"
            placeholder="ТОВ Агро-Тех"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-public-secondary md:col-span-2">
          Email *
          <input
            name="email"
            type="email"
            required
            defaultValue={initialContact?.email}
          className="public-field h-11 rounded-md px-3 text-sm transition"
            placeholder="name@company.ua"
          />
        </label>
      </div>

      <div className="mt-6 grid gap-5 md:grid-cols-2">
        {EQUIPMENT_TAXONOMY_REQUEST_FIELDS_ENABLED ? (
          <>
            <SearchableCombobox
              name="equipmentType"
              label="Тип техніки"
              value={equipmentType}
              options={equipmentTypeOptions}
              onChange={handleEquipmentTypeChange}
              required
              placeholder="Наприклад: Комбайн, Трактор, Сівалка"
              emptyMessage="Нічого не знайдено"
              error={fieldErrors.equipmentType}
            />
            <SearchableCombobox
              name="manufacturer"
              label="Виробник / марка"
              value={manufacturer}
              options={manufacturerComboboxOptions}
              onChange={handleManufacturerChange}
              required
              placeholder="Наприклад: Claas, Lemken, AgroMax"
              emptyMessage="Нічого не знайдено"
              error={fieldErrors.manufacturer}
            />
          </>
        ) : (
          <>
            <ManualEquipmentField
              name="equipmentType"
              label="Тип техніки"
              placeholder="Наприклад: Комбайн, Трактор, Сівалка"
              value={equipmentType}
              onChange={handleEquipmentTypeChange}
              error={fieldErrors.equipmentType}
            />
            <ManualEquipmentField
              name="manufacturer"
              label="Виробник / марка"
              placeholder="Наприклад: Claas, Lemken, AgroMax"
              value={manufacturer}
              onChange={handleManufacturerChange}
              error={fieldErrors.manufacturer}
            />
          </>
        )}
        <label className="grid gap-2 text-sm font-semibold text-public-secondary">
          Модель *
          <input
            name="model"
            required
            defaultValue={initialRequest?.model}
          className="public-field h-11 rounded-md px-3 text-sm transition"
            placeholder="Наприклад: MAN TGX 18.440, John Deere 8430"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-public-secondary">
          Рік випуску *
          <input
            name="vehicleYear"
            type="number"
            min="1950"
            max="2100"
            required
            defaultValue={initialRequest?.vehicleYear ?? ''}
          className="public-field h-11 rounded-md px-3 text-sm transition"
            placeholder="Наприклад: 2018"
          />
        </label>
        <label className="grid gap-2 text-sm font-semibold text-public-secondary md:col-span-2">
          VIN / серійний номер *
          <input
            name="vinOrSerial"
            required
            defaultValue={initialRequest?.vinOrSerial}
          className="public-field h-11 rounded-md px-3 text-sm transition"
            placeholder="VIN, серійний номер або номер шасі"
          />
        </label>
      </div>

      <label className="mt-6 grid gap-2 text-sm font-semibold text-public-secondary">
        Опис / коментар *
        <textarea
          name="description"
          required
          defaultValue={initialRequest?.description}
        className="public-field min-h-32 rounded-md px-3 py-3 text-sm transition"
          placeholder={"Вкажіть каталожний номер та назву запчастини, яку шукаєте.\nЯкщо позицій декілька — напишіть їх одним повідомленням."}
        />
      </label>

      <label className="mt-6 grid gap-2 text-sm font-semibold text-public-secondary">
        Додатковий коментар
        <textarea
          name="comment"
          defaultValue={initialRequest?.comment}
        className="public-field min-h-24 rounded-md px-3 py-3 text-sm transition"
          placeholder="Додаткові побажання, терміновість, аналоги, умови доставки."
        />
      </label>

      <div className="mt-6 rounded-lg border border-dashed border-public-border bg-public-elevated p-5">
        <label className="grid gap-3 text-sm font-semibold text-public-secondary">
          Додайте фото, список або документ
          <input
            name="files"
            type="file"
            multiple
            accept={ALLOWED_UPLOAD_EXTENSIONS.join(',')}
            onChange={handleFileChange}
          className="public-field block w-full rounded-md px-3 py-2 text-sm text-public-muted"
          />
        </label>
        <p className="mt-3 text-sm leading-6 text-public-secondary">
          Можна прикріпити фото деталі, список позицій, PDF, Excel або документ із артикулами.
        </p>
        <p className="mt-1 text-xs leading-5 text-public-muted">
          Дозволені формати: JPG, PNG, PDF, XLS, XLSX, CSV, DOC, DOCX. Максимальний розмір одного файлу: {maxSizeMb} MB.
        </p>
        {selectedFiles.length > 0 ? (
          <div className="mt-4 grid gap-2">
            {selectedFiles.map((file) => (
            <div key={`${file.name}-${file.size}`} className="rounded-md border border-public-border bg-public-card px-3 py-2 text-xs text-public-muted">
                {file.name} - {(file.size / 1024 / 1024).toFixed(2)} MB
              </div>
            ))}
          </div>
        ) : null}
      </div>

      {submitState.status === 'error' ? (
        <div className="mt-5 rounded-lg border border-danger/40 bg-danger/10 p-4 text-sm leading-6 text-public-danger">
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
        className="mt-6 inline-flex w-full items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-bold text-primary transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
      >
        <ActionIcon name={submitState.status === 'submitting' ? 'refresh' : 'send'} />
        {submitState.status === 'submitting' ? 'Створюємо заявку...' : 'Створити заявку'}
      </button>
    </form>
  );
}

function ManualEquipmentField({
  name,
  label,
  placeholder,
  value,
  onChange,
  error
}: {
  name: 'equipmentType' | 'manufacturer';
  label: string;
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
}) {
  const errorId = `${name}-error`;

  return (
    <label className="grid gap-2 text-sm font-semibold text-public-secondary">
      {label} *
      <input
        name={name}
        required
        maxLength={EQUIPMENT_TEXT_FIELD_MAX_LENGTH}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className="public-field h-11 rounded-md px-3 text-sm transition"
      />
      {error ? <span id={errorId} role="alert" className="text-xs font-semibold text-red-400">{error}</span> : null}
    </label>
  );
}
