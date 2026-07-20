'use client';

import { useMemo, useState } from 'react';

import { ActionIcon } from '@/components/ui/action-icons';
import { SearchableCombobox, type SearchableComboboxOption } from '@/components/ui/searchable-combobox';
import type { EquipmentTaxonomyType } from '@/lib/vehicles/taxonomy';

type VehicleFormProps = {
  action: (formData: FormData) => void | Promise<void>;
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
  const [equipmentType, setEquipmentType] = useState(vehicle?.type ?? '');
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
    <form action={action} className="grid gap-5 rounded-lg border border-border bg-card p-6 shadow-card md:grid-cols-2">
      {vehicle ? <input type="hidden" name="vehicleId" value={vehicle.id} /> : null}
      <SearchableCombobox
        variant="light"
        label="Тип техніки"
        name="type"
        options={equipmentTypeOptions}
        value={equipmentType}
        onChange={handleEquipmentTypeChange}
        placeholder="Оберіть тип техніки"
        emptyMessage="Тип техніки не знайдено"
        required
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
      />
      <label className="grid gap-2 text-sm font-semibold text-foreground">
        Модель *
        <input name="model" required defaultValue={vehicle?.model} className={inputClass} />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-foreground">
        Рік
        <input name="year" type="number" min={1901} max={2199} defaultValue={vehicle?.year ?? ''} className={inputClass} />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-foreground md:col-span-2">
        VIN / серійний номер
        <input name="vinOrSerial" defaultValue={vehicle?.vinOrSerial ?? ''} className={inputClass} />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-foreground md:col-span-2">
        Коментар
        <textarea
          name="comment"
          defaultValue={vehicle?.comment ?? ''}
          className="min-h-28 rounded-md border border-border bg-white px-3 py-3 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25"
          placeholder="Напрацювання, особливості, комплектація або інші дані для підбору запчастин."
        />
      </label>
      <p className="rounded-md border border-dashed border-border bg-surface-muted p-4 text-xs leading-5 text-muted md:col-span-2">
        Після збереження ви перейдете до додавання фотографій. Документи можна переглядати в картці техніки.
      </p>
      <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover md:col-span-2">
        <ActionIcon name="save" />
        {submitLabel}
      </button>
    </form>
  );
}
