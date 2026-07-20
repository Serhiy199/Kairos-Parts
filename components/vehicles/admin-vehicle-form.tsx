'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { useActionState, useEffect, useId, useMemo, useState } from 'react';
import { LuSave } from 'react-icons/lu';

import { SearchableCombobox, type SearchableComboboxOption } from '@/components/ui/searchable-combobox';
import {
  EMPTY_ADMIN_VEHICLE_FORM_STATE,
  type AdminVehicleFormField,
  type AdminVehicleFormState,
  type AdminVehicleFormValues
} from '@/lib/vehicles/admin-validation';
import type { EquipmentTaxonomyType } from '@/lib/vehicles/taxonomy';

type AdminVehicleOwner = {
  type: 'company' | 'client';
  name: string;
  meta?: string;
};

type AdminVehicleFormProps = {
  action: (state: AdminVehicleFormState, formData: FormData) => Promise<AdminVehicleFormState>;
  mode: 'create' | 'edit';
  owner: AdminVehicleOwner;
  taxonomy: EquipmentTaxonomyType[];
  initialValues: AdminVehicleFormValues;
  cancelHref: string;
};

function fieldClass(error?: string) {
  return `h-11 w-full rounded-md border bg-card px-3 text-sm font-semibold text-foreground outline-none transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20 ${
    error ? 'border-danger/50' : 'border-border'
  }`;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="text-xs font-semibold text-danger">
      {message}
    </p>
  ) : null;
}

export function AdminVehicleForm({
  action,
  mode,
  owner,
  taxonomy,
  initialValues,
  cancelHref
}: AdminVehicleFormProps) {
  const [state, formAction, isPending] = useActionState(action, EMPTY_ADMIN_VEHICLE_FORM_STATE);
  const values = state.values ?? initialValues;
  const [equipmentType, setEquipmentType] = useState(values.equipmentType);
  const [manufacturerId, setManufacturerId] = useState(values.manufacturerId);
  const modelErrorId = useId();
  const yearErrorId = useId();
  const vinErrorId = useId();
  const commentErrorId = useId();
  const messageId = useId();

  useEffect(() => {
    if (state.values) {
      setEquipmentType(state.values.equipmentType);
      setManufacturerId(state.values.manufacturerId);
    }
  }, [state.values]);

  useEffect(() => {
    if (state.duplicateVehicleId) {
      document.querySelector<HTMLInputElement>('input[name="vinOrSerial"]')?.focus();
    }
  }, [state.duplicateVehicleId]);

  const equipmentTypeOptions = useMemo<SearchableComboboxOption[]>(
    () => taxonomy.map((option) => ({ value: option.name, label: option.name })),
    [taxonomy]
  );

  const manufacturerOptions = useMemo(() => {
    const selectedType = taxonomy.find((option) => option.name === equipmentType);
    return (selectedType?.manufacturers ?? []).map((manufacturer) => ({
      value: manufacturer.id,
      label: manufacturer.name
    }));
  }, [equipmentType, taxonomy]);

  useEffect(() => {
    if (manufacturerId && !manufacturerOptions.some((option) => option.value === manufacturerId)) {
      setManufacturerId('');
    }
  }, [manufacturerId, manufacturerOptions]);

  const ownerTitle = owner.type === 'company' ? 'Компанія-власник' : 'Персональний власник';

  return (
    <form action={formAction} className="grid gap-6 rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
      <div className="rounded-md border border-accent/30 bg-[#FFF7E0] p-4">
        <p className="text-xs font-bold uppercase text-[#8A5B24]">{ownerTitle}</p>
        <p className="mt-2 text-lg font-bold text-foreground">{owner.name}</p>
        {owner.meta ? <p className="mt-1 text-sm text-muted">{owner.meta}</p> : null}
        <p className="mt-3 text-xs leading-5 text-muted">Власника визначено сервером. Змінити його в цій формі неможливо.</p>
      </div>

      {state.message ? (
        <div id={messageId} aria-live="polite" className="rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
          {state.message}
        </div>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
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
          label="Виробник / марка"
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

        <VehicleInput
          label="Модель"
          name="model"
          defaultValue={values.model}
          required
          error={state.fieldErrors?.model}
          errorId={modelErrorId}
        />

        <VehicleInput
          label="Рік"
          name="year"
          defaultValue={values.year}
          inputMode="numeric"
          placeholder="Наприклад, 2020"
          error={state.fieldErrors?.year}
          errorId={yearErrorId}
        />

        <div className="md:col-span-2">
          <VehicleInput
            label="VIN / серійний номер"
            name="vinOrSerial"
            defaultValue={values.vinOrSerial}
            placeholder="Вкажіть VIN або серійний номер"
            error={state.fieldErrors?.vinOrSerial}
            errorId={vinErrorId}
            afterError={state.duplicateVehicleId ? (
              <Link
                href={`/admin/vehicles/${state.duplicateVehicleId}/edit`}
                className="w-fit text-sm font-bold text-accent underline underline-offset-4 transition hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
              >
                Відкрити існуючу техніку
              </Link>
            ) : null}
          />
        </div>

        <label className="grid gap-2 text-sm font-semibold text-foreground md:col-span-2">
          Опис / примітка
          <textarea
            name="comment"
            defaultValue={values.comment}
            rows={6}
            aria-invalid={Boolean(state.fieldErrors?.comment)}
            aria-describedby={state.fieldErrors?.comment ? commentErrorId : undefined}
            className={`${fieldClass(state.fieldErrors?.comment)} min-h-32 py-3`}
          />
          <FieldError id={commentErrorId} message={state.fieldErrors?.comment} />
        </label>
      </div>

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <Link
          href={cancelHref}
          className="inline-flex min-h-11 items-center justify-center rounded-md border border-border px-5 py-3 text-sm font-bold text-foreground transition hover:border-accent hover:bg-surface-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
        >
          Скасувати
        </Link>
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <LuSave aria-hidden="true" className="h-4 w-4" />
          {isPending ? 'Збереження...' : mode === 'create' ? 'Створити техніку' : 'Зберегти зміни'}
        </button>
      </div>
    </form>
  );
}

type VehicleInputProps = {
  label: string;
  name: AdminVehicleFormField;
  defaultValue: string;
  required?: boolean;
  inputMode?: 'text' | 'numeric';
  placeholder?: string;
  error?: string;
  errorId: string;
  afterError?: ReactNode;
};

function VehicleInput({
  label,
  name,
  defaultValue,
  required = false,
  inputMode = 'text',
  placeholder,
  error,
  errorId,
  afterError
}: VehicleInputProps) {
  return (
    <label className="grid gap-2 text-sm font-semibold text-foreground">
      <span>
        {label}
        {required ? <span aria-hidden="true"> *</span> : null}
      </span>
      <input
        name={name}
        defaultValue={defaultValue}
        required={required}
        inputMode={inputMode}
        placeholder={placeholder}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={fieldClass(error)}
      />
      <FieldError id={errorId} message={error} />
      {afterError}
    </label>
  );
}
