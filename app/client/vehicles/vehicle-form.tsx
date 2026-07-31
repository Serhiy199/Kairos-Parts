'use client';

import { useActionState } from 'react';

import { ActionIcon } from '@/components/ui/action-icons';
import { VehicleCoreFields } from '@/components/vehicles/vehicle-core-fields';
import { VehicleDocumentPicker } from '@/components/vehicles/vehicle-document-picker';
import { VehicleImagePicker } from '@/components/vehicles/vehicle-image-picker';
import {
  EMPTY_ADMIN_VEHICLE_FORM_STATE,
  type AdminVehicleFormState,
  type AdminVehicleFormValues
} from '@/lib/vehicles/admin-validation';
import type { EquipmentTaxonomyType } from '@/lib/vehicles/taxonomy';

type VehicleFormProps = {
  action: (state: AdminVehicleFormState, formData: FormData) => Promise<AdminVehicleFormState>;
  submitLabel: string;
  taxonomy: EquipmentTaxonomyType[];
  vehicle?: {
    type: string;
    manufacturer: string;
    model: string;
    year: number | null;
    vinOrSerial: string | null;
    comment: string | null;
  };
  existingImageCount?: number;
  existingDocumentCount?: number;
  existingDocumentBytes?: number;
};

function initialValues(vehicle?: VehicleFormProps['vehicle']): AdminVehicleFormValues {
  return {
    equipmentType: vehicle?.type ?? '',
    manufacturerId: '',
    manufacturer: vehicle?.manufacturer ?? '',
    model: vehicle?.model ?? '',
    year: vehicle?.year ? String(vehicle.year) : '',
    vinOrSerial: vehicle?.vinOrSerial ?? '',
    comment: vehicle?.comment ?? ''
  };
}

export function VehicleForm({
  action,
  submitLabel,
  taxonomy,
  vehicle,
  existingImageCount = 0,
  existingDocumentCount = 0,
  existingDocumentBytes = 0
}: VehicleFormProps) {
  const [state, formAction, isPending] = useActionState(action, EMPTY_ADMIN_VEHICLE_FORM_STATE);
  const baseValues = initialValues(vehicle);
  const matchingManufacturer = taxonomy
    .flatMap((type) => type.manufacturers)
    .find((manufacturer) => manufacturer.name.toLocaleLowerCase('uk-UA') === vehicle?.manufacturer.toLocaleLowerCase('uk-UA'));
  const values = state.values ?? {
    ...baseValues,
    manufacturerId: matchingManufacturer?.id ?? ''
  };

  return (
    <form action={formAction} className="cabinet-card grid min-w-0 gap-6">
      {state.message ? (
        <div role="alert" className="rounded-md border border-danger/30 bg-[#FEF3F2] p-4 text-sm font-semibold text-danger">
          {state.message}
        </div>
      ) : null}

      <VehicleCoreFields
        values={values}
        fieldErrors={state.fieldErrors}
        taxonomy={taxonomy}
        disabled={isPending}
        surface="white"
      />
      <VehicleImagePicker disabled={isPending} existingCount={existingImageCount} />
      <VehicleDocumentPicker
        disabled={isPending}
        existingCount={existingDocumentCount}
        existingBytes={existingDocumentBytes}
      />

      <button type="submit" disabled={isPending} className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60">
        <ActionIcon name="save" />
        {isPending ? 'Збереження...' : submitLabel}
      </button>
    </form>
  );
}
