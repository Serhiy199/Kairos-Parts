'use client';

import { useActionState, useMemo, useState } from 'react';
import { LuImagePlus } from 'react-icons/lu';

import { ActionIcon } from '@/components/ui/action-icons';
import { SearchableCombobox, type SearchableComboboxOption } from '@/components/ui/searchable-combobox';
import { ManualEquipmentFields } from '@/components/vehicles/manual-equipment-fields';
import { EQUIPMENT_TAXONOMY_VEHICLE_FIELDS_ENABLED } from '@/lib/features/equipment-taxonomy';
import {
  EMPTY_ADMIN_VEHICLE_FORM_STATE,
  type AdminVehicleFormState
} from '@/lib/vehicles/admin-validation';
import { MAX_VEHICLE_IMAGE_BYTES, MAX_VEHICLE_IMAGES } from '@/lib/vehicles/images';
import type { EquipmentTaxonomyType } from '@/lib/vehicles/taxonomy';

type VehicleFormProps = {
  action: (state: AdminVehicleFormState, formData: FormData) => Promise<AdminVehicleFormState>;
  submitLabel: string;
  taxonomy: EquipmentTaxonomyType[];
  vehicle?: {
    id: string;
    type: string;
    manufacturer: string;
    model: string;
    year: number | null;
    vinOrSerial: string | null;
    comment: string | null;
  };
};

const inputClass =
  'h-11 rounded-md border border-border bg-white px-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25';

export function VehicleForm({ action, submitLabel, taxonomy, vehicle }: VehicleFormProps) {
  const [state, formAction, isPending] = useActionState(action, EMPTY_ADMIN_VEHICLE_FORM_STATE);
  const values = state.values;
  const [equipmentType, setEquipmentType] = useState(values?.equipmentType ?? vehicle?.type ?? '');
  const [selectedImageCount, setSelectedImageCount] = useState(0);
  const initialManufacturer = taxonomy
    .flatMap((type) => type.manufacturers)
    .find((manufacturer) => manufacturer.name.toLocaleLowerCase('uk-UA') === vehicle?.manufacturer.toLocaleLowerCase('uk-UA'));
  const [manufacturerId, setManufacturerId] = useState(initialManufacturer?.id ?? '');
  const equipmentTypeOptions = useMemo<SearchableComboboxOption[]>(
    () => taxonomy.map((type) => ({ value: type.name, label: type.name })),
    [taxonomy]
  );
  const manufacturerOptions = useMemo<SearchableComboboxOption[]>(() => {
    const selectedType = taxonomy.find((type) => type.name === equipmentType);
    return (selectedType?.manufacturers ?? []).map((manufacturer) => ({ value: manufacturer.id, label: manufacturer.name }));
  }, [equipmentType, taxonomy]);

  function handleEquipmentTypeChange(value: string) {
    setEquipmentType(value);
    setManufacturerId('');
  }

  return (
    <form action={formAction} className="cabinet-card grid gap-5 lg:grid-cols-2">
      {vehicle ? <input type="hidden" name="vehicleId" value={vehicle.id} /> : null}
      {state.message ? (
        <div className="rounded-md border border-danger/30 bg-[#FEF3F2] p-4 text-sm font-semibold text-danger lg:col-span-2">
          {state.message}
        </div>
      ) : null}
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
        </>
      ) : (
        <ManualEquipmentFields
          typeName="equipmentType"
          manufacturerName="manufacturer"
          typeDefaultValue={values?.equipmentType ?? vehicle?.type ?? ''}
          manufacturerDefaultValue={values?.manufacturer ?? vehicle?.manufacturer ?? ''}
          typeError={state.fieldErrors?.equipmentType}
          manufacturerError={state.fieldErrors?.manufacturer}
          variant="white"
        />
      )}
      <label className="grid gap-2 text-sm font-semibold text-foreground">
        Модель *
        <input name="model" required defaultValue={values?.model ?? vehicle?.model} className={inputClass} />
        {state.fieldErrors?.model ? <span className="text-xs text-danger">{state.fieldErrors.model}</span> : null}
      </label>
      <label className="grid gap-2 text-sm font-semibold text-foreground">
        Рік
        <input name="year" type="number" min={1901} max={2199} defaultValue={values?.year ?? vehicle?.year ?? ''} className={inputClass} />
        {state.fieldErrors?.year ? <span className="text-xs text-danger">{state.fieldErrors.year}</span> : null}
      </label>
      <label className="grid gap-2 text-sm font-semibold text-foreground md:col-span-2">
        VIN / серійний номер
        <input name="vinOrSerial" maxLength={120} defaultValue={values?.vinOrSerial ?? vehicle?.vinOrSerial ?? ''} className={inputClass} />
        {state.fieldErrors?.vinOrSerial ? <span className="text-xs text-danger">{state.fieldErrors.vinOrSerial}</span> : null}
      </label>
      <label className="grid gap-2 text-sm font-semibold text-foreground md:col-span-2">
        Коментар
        <textarea
          name="comment"
          defaultValue={values?.comment ?? vehicle?.comment ?? ''}
          className="min-h-28 rounded-md border border-border bg-white px-3 py-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25"
          placeholder="Напрацювання, особливості, комплектація або інші дані для підбору запчастин."
        />
      </label>
      {!vehicle ? (
        <div className="grid gap-3 rounded-md border border-dashed border-border bg-surface-muted p-4 md:col-span-2">
          <div className="flex items-start gap-3">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
              <LuImagePlus aria-hidden="true" className="size-5" />
            </span>
            <div>
              <label htmlFor="vehicle-create-images" className="text-sm font-bold text-foreground">
                Фотографії техніки
              </label>
              <p id="vehicle-create-images-help" className="mt-1 text-xs leading-5 text-muted">
                Необов’язково. JPEG, PNG або WebP, до {MAX_VEHICLE_IMAGE_BYTES / 1024 / 1024} МБ кожне. Максимум {MAX_VEHICLE_IMAGES} фото.
              </p>
            </div>
          </div>
          <input
            id="vehicle-create-images"
            name="images"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            multiple
            aria-describedby="vehicle-create-images-help"
            onChange={(event) => setSelectedImageCount(event.currentTarget.files?.length ?? 0)}
            className="block w-full rounded-md border border-border bg-white p-2 text-sm text-foreground file:mr-3 file:rounded-md file:border-0 file:bg-accent file:px-4 file:py-2 file:font-bold file:text-foreground"
          />
          {selectedImageCount > 0 ? (
            <p className={`text-xs font-semibold ${selectedImageCount > MAX_VEHICLE_IMAGES ? 'text-danger' : 'text-muted'}`}>
              Вибрано фотографій: {selectedImageCount}/{MAX_VEHICLE_IMAGES}
            </p>
          ) : null}
        </div>
      ) : null}
      <button type="submit" disabled={isPending} className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60 md:col-span-2">
        <ActionIcon name="save" />
        {isPending ? 'Збереження...' : submitLabel}
      </button>
    </form>
  );
}
