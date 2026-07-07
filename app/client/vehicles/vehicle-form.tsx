import { ActionIcon } from '@/components/ui/action-icons';

type VehicleFormProps = {
  action: (formData: FormData) => void | Promise<void>;
  submitLabel: string;
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

export function VehicleForm({ action, submitLabel, vehicle }: VehicleFormProps) {
  return (
    <form action={action} className="grid gap-5 rounded-lg border border-border bg-card p-6 shadow-card md:grid-cols-2">
      {vehicle ? <input type="hidden" name="vehicleId" value={vehicle.id} /> : null}
      <label className="grid gap-2 text-sm font-semibold text-foreground">
        Тип техніки *
        <input name="type" required defaultValue={vehicle?.type} className={inputClass} placeholder="Трактор, комбайн, вантажівка" />
      </label>
      <label className="grid gap-2 text-sm font-semibold text-foreground">
        Виробник *
        <input name="manufacturer" required defaultValue={vehicle?.manufacturer} className={inputClass} placeholder="John Deere, MAN, Claas" />
      </label>
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
        Фото або документи до техніки буде винесено в окремий storage flow. На Day 8 документи показуються як файли заявок і записи Document.
      </p>
      <button type="submit" className="inline-flex items-center justify-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover md:col-span-2">
        <ActionIcon name="save" />
        {submitLabel}
      </button>
    </form>
  );
}
