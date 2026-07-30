'use client';

import Link from 'next/link';
import { useActionState, useEffect, useId } from 'react';
import { LuSave } from 'react-icons/lu';

import { VehicleCoreFields } from '@/components/vehicles/vehicle-core-fields';
import { VehicleDocumentPicker } from '@/components/vehicles/vehicle-document-picker';
import { VehicleImagePicker } from '@/components/vehicles/vehicle-image-picker';
import {
  EMPTY_ADMIN_VEHICLE_FORM_STATE,
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
  existingImageCount?: number;
  existingDocumentCount?: number;
  existingDocumentBytes?: number;
};

export function AdminVehicleForm({
  action,
  mode,
  owner,
  taxonomy,
  initialValues,
  cancelHref,
  existingImageCount = 0,
  existingDocumentCount = 0,
  existingDocumentBytes = 0
}: AdminVehicleFormProps) {
  const [state, formAction, isPending] = useActionState(action, EMPTY_ADMIN_VEHICLE_FORM_STATE);
  const values = state.values ?? initialValues;
  const messageId = useId();

  useEffect(() => {
    if (state.duplicateVehicleId) {
      document.querySelector<HTMLInputElement>('input[name="vinOrSerial"]')?.focus();
    }
  }, [state.duplicateVehicleId]);

  const ownerTitle = owner.type === 'company' ? 'Компанія-власник' : 'Персональний власник';
  const duplicateLink = state.duplicateVehicleId ? (
    <Link
      href={`/admin/vehicles/${state.duplicateVehicleId}/edit`}
      className="w-fit text-sm font-bold text-accent underline underline-offset-4 transition hover:text-accent-hover focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
    >
      Відкрити існуючу техніку
    </Link>
  ) : null;

  return (
    <form action={formAction} className="grid min-w-0 gap-6 rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
      <div className="rounded-md border border-accent/30 bg-[#FFF7E0] p-4">
        <p className="text-xs font-bold uppercase text-[#8A5B24]">{ownerTitle}</p>
        <p className="mt-2 text-lg font-bold text-foreground">{owner.name}</p>
        {owner.meta ? <p className="mt-1 text-sm text-muted">{owner.meta}</p> : null}
        <p className="mt-3 text-xs leading-5 text-muted">Власника визначено сервером. Змінити його в цій формі неможливо.</p>
      </div>

      {state.message ? (
        <div id={messageId} role="alert" className="rounded-md border border-danger/30 bg-danger/10 px-4 py-3 text-sm font-semibold text-danger">
          {state.message}
        </div>
      ) : null}

      <VehicleCoreFields
        values={values}
        fieldErrors={state.fieldErrors}
        taxonomy={taxonomy}
        disabled={isPending}
        vinAfter={duplicateLink}
      />
      <VehicleImagePicker disabled={isPending} existingCount={existingImageCount} />
      <VehicleDocumentPicker
        disabled={isPending}
        existingCount={existingDocumentCount}
        existingBytes={existingDocumentBytes}
        showStaffVisibility
      />

      <div className="flex flex-col-reverse gap-3 border-t border-border pt-5 sm:flex-row sm:justify-end">
        <Link href={cancelHref} className="inline-flex min-h-11 items-center justify-center rounded-md border border-border px-5 py-3 text-sm font-bold text-foreground transition hover:border-accent hover:bg-surface-muted">
          Скасувати
        </Link>
        <button type="submit" disabled={isPending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover disabled:cursor-not-allowed disabled:opacity-60">
          <LuSave aria-hidden="true" className="size-4" />
          {isPending ? 'Збереження...' : mode === 'create' ? 'Створити техніку' : 'Зберегти зміни'}
        </button>
      </div>
    </form>
  );
}
