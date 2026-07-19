import { VehicleForm } from '../vehicle-form';
import { createVehicle } from '../actions';

export default async function NewVehiclePage({
  searchParams
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const params = await searchParams;

  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-bold uppercase text-accent">Мій парк техніки</p>
        <h2 className="mt-2 text-2xl font-bold text-foreground">Додати техніку</h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-muted">
          Збережіть базові дані техніки, щоб швидко створювати заявки з готовими параметрами.
        </p>
      </div>
      {params.error ? (
        <div className="rounded-md border border-danger/30 bg-[#FEF3F2] p-4 text-sm font-semibold text-danger">
          {params.error === 'duplicate'
            ? 'Техніка з таким VIN або серійним номером уже є у вашому парку.'
            : 'Заповніть тип техніки, виробника і модель.'}
        </div>
      ) : null}
      <VehicleForm action={createVehicle} submitLabel="Додати техніку" />
    </div>
  );
}
