import { EQUIPMENT_TEXT_FIELD_MAX_LENGTH } from '@/lib/features/equipment-taxonomy';

type ManualEquipmentFieldsProps = {
  typeName: string;
  manufacturerName: string;
  typeDefaultValue?: string;
  manufacturerDefaultValue?: string;
  typeError?: string;
  manufacturerError?: string;
  variant?: 'card' | 'white';
};

export function ManualEquipmentFields({
  typeName,
  manufacturerName,
  typeDefaultValue = '',
  manufacturerDefaultValue = '',
  typeError,
  manufacturerError,
  variant = 'card'
}: ManualEquipmentFieldsProps) {
  return (
    <>
      <ManualField
        label="Тип техніки"
        name={typeName}
        defaultValue={typeDefaultValue}
        placeholder="Наприклад: Комбайн, Трактор, Сівалка"
        requiredMessage="Вкажіть тип техніки."
        error={typeError}
        variant={variant}
      />
      <ManualField
        label="Виробник / марка"
        name={manufacturerName}
        defaultValue={manufacturerDefaultValue}
        placeholder="Наприклад: John Deere, MAN, Claas"
        requiredMessage="Вкажіть виробника або марку."
        error={manufacturerError}
        variant={variant}
      />
    </>
  );
}

function ManualField({
  label,
  name,
  defaultValue,
  placeholder,
  requiredMessage,
  error,
  variant
}: {
  label: string;
  name: string;
  defaultValue: string;
  placeholder: string;
  requiredMessage: string;
  error?: string;
  variant: 'card' | 'white';
}) {
  return (
    <label className="grid min-w-0 gap-2 text-sm font-semibold text-foreground">
      <span>{label} <span aria-hidden="true">*</span></span>
      <input
        name={name}
        defaultValue={defaultValue}
        placeholder={placeholder}
        required
        pattern={'.*\\S.*'}
        maxLength={EQUIPMENT_TEXT_FIELD_MAX_LENGTH}
        aria-invalid={Boolean(error)}
        onInvalid={(event) => {
          if (!event.currentTarget.value.trim()) {
            event.currentTarget.setCustomValidity(requiredMessage);
          }
        }}
        onInput={(event) => event.currentTarget.setCustomValidity('')}
        className={`h-11 w-full min-w-0 rounded-md border px-3 text-sm outline-none transition placeholder:text-muted focus:border-accent focus:ring-2 focus:ring-accent/20 ${
          variant === 'white' ? 'bg-white' : 'bg-card font-semibold text-foreground'
        } ${error ? 'border-danger/50' : 'border-border'}`}
      />
      {error ? <p className="text-xs font-semibold text-danger">{error}</p> : null}
    </label>
  );
}
