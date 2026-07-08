import type { ChangeAction, ChangeEntityType } from '@prisma/client';

import { createClientChangeRequestAction } from './actions';

type FieldOption = {
  value: string;
  label: string;
  currentValue?: string | number | null;
};

type ContextualChangeRequestFormProps = {
  title: string;
  description?: string;
  entityType: ChangeEntityType;
  entityId: string;
  action?: ChangeAction;
  redirectTo: string;
  fieldOptions?: FieldOption[];
  submitLabel?: string;
  compact?: boolean;
};

const inputClass = 'rounded-md border border-border px-3 py-2 text-sm outline-none transition focus:border-accent focus:ring-2 focus:ring-accent/25';

export function ContextualChangeRequestForm({
  title,
  description,
  entityType,
  entityId,
  action = 'UPDATE',
  redirectTo,
  fieldOptions = [],
  submitLabel = 'Надіслати запит',
  compact = false
}: ContextualChangeRequestFormProps) {
  const oldValue = fieldOptions.length > 0 ? JSON.stringify(Object.fromEntries(fieldOptions.map((field) => [field.value, field.currentValue ?? null]))) : '';

  return (
    <form action={createClientChangeRequestAction} className={`grid gap-4 rounded-lg border border-border bg-card shadow-card ${compact ? 'p-4' : 'p-6'}`}>
      <input type="hidden" name="entityType" value={entityType} />
      <input type="hidden" name="entityId" value={entityId} />
      <input type="hidden" name="action" value={action} />
      <input type="hidden" name="redirectTo" value={redirectTo} />
      {oldValue ? <input type="hidden" name="oldValue" value={oldValue} /> : null}

      <div>
        <p className="text-sm font-bold uppercase text-accent">Запросити зміну</p>
        <h3 className={`${compact ? 'mt-1 text-base' : 'mt-2 text-lg'} font-bold text-foreground`}>{title}</h3>
        {description ? <p className="mt-2 text-sm leading-6 text-muted">{description}</p> : null}
      </div>

      <div className={`grid gap-4 ${compact ? '' : 'md:grid-cols-2'}`}>
        <label className="grid gap-2 text-sm font-semibold text-foreground">
          Що потрібно змінити?
          {fieldOptions.length > 0 ? (
            <select name="fieldName" className={inputClass} defaultValue={fieldOptions[0]?.value}>
              {fieldOptions.map((field) => (
                <option key={field.value} value={field.value}>
                  {field.label}
                </option>
              ))}
            </select>
          ) : (
            <input name="fieldName" className={inputClass} placeholder="Наприклад, опис, номер, кількість або інше" />
          )}
        </label>
        {action === 'ARCHIVE' ? (
          <input type="hidden" name="newValueText" value="Клієнт просить архівувати техніку" />
        ) : (
          <label className="grid gap-2 text-sm font-semibold text-foreground">
            Нове значення
            <input name="newValueText" className={inputClass} placeholder="Вкажіть нове значення або опис зміни" />
          </label>
        )}
        <label className={`grid gap-2 text-sm font-semibold text-foreground ${compact ? '' : 'md:col-span-2'}`}>
          Причина зміни
          <textarea name="reason" rows={compact ? 3 : 4} className={inputClass} placeholder="Коротко поясніть, чому потрібна зміна" />
        </label>
      </div>

      <button className="w-fit rounded-md border border-accent bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover">
        {submitLabel}
      </button>
    </form>
  );
}
