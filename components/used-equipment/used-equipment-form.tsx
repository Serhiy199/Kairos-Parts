'use client';

import type { UsedEquipmentStatus } from '@prisma/client';
import { useActionState, useEffect, useMemo, useState } from 'react';
import { FaSave } from 'react-icons/fa';

import { RichTextEditor } from '@/components/ui/rich-text-editor';
import { SearchableCombobox, type SearchableComboboxOption } from '@/components/ui/searchable-combobox';
import { UsedEquipmentImageManager, type UsedEquipmentExistingImage } from '@/components/used-equipment/used-equipment-image-manager';
import { USED_EQUIPMENT_STATUS_LABELS } from '@/lib/used-equipment/status';
import {
  EMPTY_USED_EQUIPMENT_FORM_STATE,
  type UsedEquipmentFormState,
  type UsedEquipmentFormValues,
  USED_EQUIPMENT_ALLOWED_FORM_STATUSES,
  USED_EQUIPMENT_NO_IMAGE_STATUSES
} from '@/lib/used-equipment/validation';
import type { EquipmentTaxonomyType } from '@/lib/vehicles/taxonomy';

type UsedEquipmentFormProps = {
  action: (state: UsedEquipmentFormState, formData: FormData) => Promise<UsedEquipmentFormState>;
  mode: 'create' | 'edit';
  taxonomy: EquipmentTaxonomyType[];
  initialValues: UsedEquipmentFormValues;
  hasImages?: boolean;
  existingImages?: UsedEquipmentExistingImage[];
};

function fieldClass(error?: string) {
  return `h-11 rounded-md border bg-card px-3 text-sm font-semibold text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 ${
    error ? 'border-danger/50' : 'border-border'
  }`;
}

function textareaClass(error?: string) {
  return `min-h-32 rounded-md border bg-card px-3 py-3 text-sm font-semibold text-foreground outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/20 ${
    error ? 'border-danger/50' : 'border-border'
  }`;
}

function FieldError({ error }: { error?: string }) {
  return error ? <p className="text-xs font-semibold text-danger">{error}</p> : null;
}

export function UsedEquipmentForm({
  action,
  mode,
  taxonomy,
  initialValues,
  hasImages = false,
  existingImages = []
}: UsedEquipmentFormProps) {
  const [state, formAction, isPending] = useActionState(action, EMPTY_USED_EQUIPMENT_FORM_STATE);
  const values = state.values ?? initialValues;
  const [equipmentType, setEquipmentType] = useState(values.equipmentType);
  const [manufacturerId, setManufacturerId] = useState(values.manufacturerId);
  const [description, setDescription] = useState(values.description);

  useEffect(() => {
    if (state.values) {
      setEquipmentType(state.values.equipmentType);
      setManufacturerId(state.values.manufacturerId);
      setDescription(state.values.description);
    }
  }, [state.values]);

  const equipmentTypeOptions = useMemo<SearchableComboboxOption[]>(
    () => taxonomy.map((option) => ({ value: option.name, label: option.name })),
    [taxonomy]
  );

  const manufacturerOptions = useMemo<SearchableComboboxOption[]>(() => {
    const selectedType = taxonomy.find((option) => option.name === equipmentType);
    return (selectedType?.manufacturers ?? []).map((manufacturer) => ({
      value: manufacturer.id,
      label: manufacturer.name
    }));
  }, [equipmentType, taxonomy]);

  useEffect(() => {
    if (!manufacturerId) {
      return;
    }

    if (!manufacturerOptions.some((option) => option.value === manufacturerId)) {
      setManufacturerId('');
    }
  }, [manufacturerId, manufacturerOptions]);

  const statusOptions = useMemo(() => {
    if (mode === 'create') {
      return ['DRAFT'] as UsedEquipmentStatus[];
    }

    return USED_EQUIPMENT_ALLOWED_FORM_STATUSES;
  }, [mode]);

  return (
    <form action={formAction} className="grid gap-6 rounded-lg border border-border bg-card p-6 shadow-card">
      {state.status === 'error' && state.message ? (
        <div className="rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
          {state.message}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <label className="grid gap-2 text-sm font-semibold text-foreground">
          Назва техніки *
          <input name="title" defaultValue={values.title} className={fieldClass(state.fieldErrors?.title)} />
          <FieldError error={state.fieldErrors?.title} />
        </label>

        <SearchableCombobox
          variant="light"
          label="Тип техніки"
          name="equipmentType"
          options={equipmentTypeOptions}
          value={equipmentType}
          onChange={setEquipmentType}
          placeholder="Оберіть тип техніки"
          emptyMessage="Тип техніки не знайдено"
          required
          error={state.fieldErrors?.equipmentType}
        />

        <SearchableCombobox
          variant="light"
          label="Виробник"
          name="manufacturerId"
          options={manufacturerOptions}
          value={manufacturerId}
          onChange={setManufacturerId}
          placeholder={equipmentType ? 'Оберіть виробника' : 'Спочатку оберіть тип техніки'}
          emptyMessage="Виробника не знайдено"
          disabled={!equipmentType}
          required
          error={state.fieldErrors?.manufacturerId}
        />

        <label className="grid gap-2 text-sm font-semibold text-foreground">
          Рік випуску
          <input name="year" inputMode="numeric" defaultValue={values.year} className={fieldClass(state.fieldErrors?.year)} />
          <FieldError error={state.fieldErrors?.year} />
        </label>

        {mode === 'edit' ? (
          <label className="grid gap-2 text-sm font-semibold text-foreground lg:col-span-2">
            Статус
            <select name="status" defaultValue={values.status} className={fieldClass(state.fieldErrors?.status)}>
              {statusOptions.map((status) => {
                const disabled = !hasImages && !(USED_EQUIPMENT_NO_IMAGE_STATUSES as readonly UsedEquipmentStatus[]).includes(status);
                return (
                  <option key={status} value={status} disabled={disabled}>
                    {USED_EQUIPMENT_STATUS_LABELS[status]}
                    {disabled ? ' — потрібне фото' : ''}
                  </option>
                );
              })}
            </select>
            <FieldError error={state.fieldErrors?.status} />
            {!hasImages ? (
              <p className="text-xs font-medium text-muted">
                Публікація буде доступна після додавання фото техніки.
              </p>
            ) : null}
          </label>
        ) : (
          <input type="hidden" name="status" value="DRAFT" />
        )}

        <label className="grid gap-2 text-sm font-semibold text-foreground lg:col-span-2">
          Опис *
          <RichTextEditor
            value={description}
            onChange={setDescription}
            error={state.fieldErrors?.description}
            describedBy={state.fieldErrors?.description ? 'used-equipment-description-error' : undefined}
          />
          <input type="hidden" name="description" value={description} />
          <div id="used-equipment-description-error">
            <FieldError error={state.fieldErrors?.description} />
          </div>
        </label>

        <label className="grid gap-2 text-sm font-semibold text-foreground lg:col-span-2">
          Внутрішній коментар
          <textarea name="internalComment" defaultValue={values.internalComment} className={textareaClass(state.fieldErrors?.internalComment)} />
          <FieldError error={state.fieldErrors?.internalComment} />
        </label>
      </div>

      <UsedEquipmentImageManager mode={mode} existingImages={existingImages} error={state.fieldErrors?.images} />

      <div className="flex flex-col gap-3 border-t border-border pt-5 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted">
          {mode === 'create'
            ? 'Нова техніка зберігається як чернетка, доки не буде додано фото.'
            : 'Slug не змінюється під час редагування, щоб не ламати майбутні публічні посилання.'}
        </p>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-accent px-5 text-sm font-bold text-foreground transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60"
        >
          <FaSave aria-hidden="true" className="size-3" />
          {isPending ? 'Збереження...' : 'Зберегти'}
        </button>
      </div>
    </form>
  );
}
