'use client';

import type { ReactNode } from 'react';
import { useEffect, useMemo, useState } from 'react';

import { SearchableCombobox, type SearchableComboboxOption } from '@/components/ui/searchable-combobox';
import { ManualEquipmentFields } from '@/components/vehicles/manual-equipment-fields';
import { EQUIPMENT_TAXONOMY_VEHICLE_FIELDS_ENABLED } from '@/lib/features/equipment-taxonomy';
import type {
  AdminVehicleFormState,
  AdminVehicleFormValues
} from '@/lib/vehicles/admin-validation';
import type { EquipmentTaxonomyType } from '@/lib/vehicles/taxonomy';

type VehicleCoreFieldsProps = {
  values: AdminVehicleFormValues;
  fieldErrors?: AdminVehicleFormState['fieldErrors'];
  taxonomy: EquipmentTaxonomyType[];
  disabled?: boolean;
  surface?: 'white' | 'card';
  vinAfter?: ReactNode;
};

function inputClass(error?: string, surface: 'white' | 'card' = 'card') {
  return `h-11 w-full rounded-md border px-3 text-sm font-semibold text-foreground outline-none transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20 ${
    surface === 'white' ? 'bg-white' : 'bg-card'
  } ${error ? 'border-danger/50' : 'border-border'}`;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <p id={id} className="text-xs font-semibold text-danger">{message}</p> : null;
}

export function VehicleCoreFields({
  values,
  fieldErrors,
  taxonomy,
  disabled = false,
  surface = 'card',
  vinAfter
}: VehicleCoreFieldsProps) {
  const [equipmentType, setEquipmentType] = useState(values.equipmentType);
  const [manufacturerId, setManufacturerId] = useState(values.manufacturerId);

  useEffect(() => {
    setEquipmentType(values.equipmentType);
    setManufacturerId(values.manufacturerId);
  }, [values.equipmentType, values.manufacturerId]);

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

  function handleEquipmentTypeChange(value: string) {
    setEquipmentType(value);
    setManufacturerId('');
  }

  return (
    <fieldset disabled={disabled} className="grid min-w-0 gap-4 lg:grid-cols-2">
      <legend className="mb-4 text-lg font-bold text-foreground">Основні характеристики</legend>
      {EQUIPMENT_TAXONOMY_VEHICLE_FIELDS_ENABLED ? (
        <>
          <SearchableCombobox
            variant="light"
            label="Тип техніки"
            name="equipmentType"
            options={equipmentTypeOptions}
            value={equipmentType}
            onChange={handleEquipmentTypeChange}
            placeholder="Оберіть тип техніки"
            emptyMessage="Тип техніки не знайдено"
            required
            disabled={disabled}
            error={fieldErrors?.equipmentType}
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
            disabled={disabled || !equipmentType}
            required
            error={fieldErrors?.manufacturerId}
          />
        </>
      ) : (
        <ManualEquipmentFields
          typeName="equipmentType"
          manufacturerName="manufacturer"
          typeDefaultValue={values.equipmentType}
          manufacturerDefaultValue={values.manufacturer}
          typeError={fieldErrors?.equipmentType}
          manufacturerError={fieldErrors?.manufacturer}
          variant={surface === 'white' ? 'white' : undefined}
        />
      )}

      <VehicleInput
        label="Модель"
        name="model"
        defaultValue={values.model}
        required
        requiredMessage="Вкажіть модель."
        error={fieldErrors?.model}
        surface={surface}
      />
      <VehicleInput
        label="Рік"
        name="year"
        defaultValue={values.year}
        inputMode="numeric"
        placeholder="Наприклад, 2020"
        error={fieldErrors?.year}
        surface={surface}
      />
      <div className="lg:col-span-2">
        <VehicleInput
          label="VIN / серійний номер"
          name="vinOrSerial"
          defaultValue={values.vinOrSerial}
          placeholder="Вкажіть VIN або серійний номер"
          required
          requiredMessage="Вкажіть VIN або серійний номер."
          error={fieldErrors?.vinOrSerial}
          surface={surface}
          afterError={vinAfter}
        />
      </div>
      <label className="grid gap-2 text-sm font-semibold text-foreground lg:col-span-2">
        Опис / примітка
        <textarea
          name="comment"
          defaultValue={values.comment}
          rows={6}
          aria-invalid={Boolean(fieldErrors?.comment)}
          aria-describedby={fieldErrors?.comment ? 'vehicle-comment-error' : undefined}
          className={`${inputClass(fieldErrors?.comment, surface)} min-h-32 py-3`}
        />
        <FieldError id="vehicle-comment-error" message={fieldErrors?.comment} />
      </label>
    </fieldset>
  );
}

function VehicleInput({
  label,
  name,
  defaultValue,
  required = false,
  requiredMessage,
  inputMode = 'text',
  placeholder,
  error,
  surface,
  afterError
}: {
  label: string;
  name: 'model' | 'year' | 'vinOrSerial';
  defaultValue: string;
  required?: boolean;
  requiredMessage?: string;
  inputMode?: 'text' | 'numeric';
  placeholder?: string;
  error?: string;
  surface: 'white' | 'card';
  afterError?: ReactNode;
}) {
  const errorId = `vehicle-${name}-error`;
  return (
    <label className="grid gap-2 text-sm font-semibold text-foreground">
      <span>{label}{required ? <span aria-hidden="true"> *</span> : null}</span>
      <input
        name={name}
        defaultValue={defaultValue}
        required={required}
        pattern={required ? '.*\\S.*' : undefined}
        inputMode={inputMode}
        placeholder={placeholder}
        maxLength={name === 'vinOrSerial' ? 120 : undefined}
        onInvalid={(event) => {
          if (required && !event.currentTarget.value.trim()) {
            event.currentTarget.setCustomValidity(requiredMessage ?? 'Заповніть поле.');
          }
        }}
        onInput={(event) => event.currentTarget.setCustomValidity('')}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? errorId : undefined}
        className={inputClass(error, surface)}
      />
      <FieldError id={errorId} message={error} />
      {afterError}
    </label>
  );
}
