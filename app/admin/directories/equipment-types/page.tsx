import { createEquipmentType, updateEquipmentType } from '@/app/admin/directories/actions';
import { requireCrmSession } from '@/lib/admin/access';
import { prisma } from '@/lib/prisma';
import { TAXONOMY_SORT_ORDER_ERROR } from '@/lib/vehicles/taxonomy-sort-order';

export default async function EquipmentTypesDirectoryPage({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  const session = await requireCrmSession();
  const { result } = await searchParams;
  const [types, vehicleUsage, requestUsage, usedEquipmentUsage] = await Promise.all([
    prisma.equipmentType.findMany({
      orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }],
      include: { _count: { select: { manufacturers: true } } }
    }),
    prisma.vehicle.groupBy({ by: ['type'], _count: { _all: true } }),
    prisma.request.groupBy({ by: ['equipmentType'], where: { equipmentType: { not: null } }, _count: { _all: true } }),
    prisma.usedEquipment.groupBy({ by: ['equipmentType'], _count: { _all: true } })
  ]);
  const usageMap = new Map<string, number>();
  const addUsage = (name: string | null, count: number) => {
    if (!name) return;
    const key = name.toLocaleLowerCase('uk-UA');
    usageMap.set(key, (usageMap.get(key) ?? 0) + count);
  };
  vehicleUsage.forEach((item) => addUsage(item.type, item._count._all));
  requestUsage.forEach((item) => addUsage(item.equipmentType, item._count._all));
  usedEquipmentUsage.forEach((item) => addUsage(item.equipmentType, item._count._all));
  const canEdit = session.user.role === 'ADMIN';
  const orderInvalid = result === 'order-validation';
  return (
    <section className="grid gap-5 rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
      <div><p className="text-sm font-bold uppercase text-accent">Типи й виробники</p><h1 className="mt-2 text-2xl font-bold">Типи техніки</h1><p className="mt-2 text-sm text-muted">Неактивні значення залишаються в історії, але не показуються у нових формах.</p></div>
      {orderInvalid ? <p id="equipment-type-order-error" role="alert" className="rounded-md border border-red-200 bg-red-50 p-3 text-sm font-semibold text-red-700">{TAXONOMY_SORT_ORDER_ERROR}</p> : result ? <p aria-live="polite" className="rounded-md border border-border bg-surface-muted p-3 text-sm font-semibold">Результат: {result}</p> : null}
      {canEdit ? <form action={createEquipmentType} className="grid gap-3 rounded-md border border-border p-4 sm:grid-cols-[minmax(0,1fr)_5rem_auto] sm:items-end"><Field label="Назва" name="name" required /><Field label="Порядок" name="sortOrder" type="number" defaultValue="0" invalid={orderInvalid} errorId="equipment-type-order-error" compact /><button className="min-h-11 rounded-md bg-accent px-5 text-sm font-bold">Додати</button></form> : <p className="rounded-md border border-border p-4 text-sm text-muted">Менеджер має доступ лише для перегляду.</p>}
      <div className="grid gap-3">
        {types.map((type) => canEdit ? (
          <form key={type.id} action={updateEquipmentType} className="grid gap-3 rounded-md border border-border p-4 lg:grid-cols-[minmax(0,1fr)_5rem_auto_auto] lg:items-end">
            <input type="hidden" name="id" value={type.id} /><Field label="Назва" name="name" defaultValue={type.name} required /><Field label="Порядок" name="sortOrder" type="number" defaultValue={String(type.sortOrder)} invalid={orderInvalid} errorId="equipment-type-order-error" compact /><label className="flex min-h-11 cursor-pointer items-center gap-2 whitespace-nowrap rounded-md px-2 text-sm font-semibold focus-within:ring-2 focus-within:ring-accent"><input type="checkbox" name="isActive" defaultChecked={type.isActive} className="size-4" /> Активний</label><button className="min-h-11 rounded-md border border-accent px-4 text-sm font-bold">Зберегти</button><p className="text-xs text-muted lg:col-span-4">Виробників: {type._count.manufacturers} · Використань: {usageMap.get(type.name.toLocaleLowerCase('uk-UA')) ?? 0}</p>
          </form>
        ) : <div key={type.id} className="rounded-md border border-border p-4"><p className="font-bold">{type.name}</p><p className="mt-1 text-xs text-muted">{type.isActive ? 'Активний' : 'Неактивний'} · Виробників: {type._count.manufacturers} · Використань: {usageMap.get(type.name.toLocaleLowerCase('uk-UA')) ?? 0}</p></div>)}
      </div>
    </section>
  );
}

function Field({ label, name, defaultValue, required, type = 'text', invalid, errorId, compact }: { label: string; name: string; defaultValue?: string; required?: boolean; type?: string; invalid?: boolean; errorId?: string; compact?: boolean }) {
  return <label className={`grid min-w-0 gap-2 text-sm font-semibold ${compact ? 'w-20' : ''}`}>{label}<input name={name} type={type} defaultValue={defaultValue} required={required} min={type === 'number' ? 0 : undefined} max={type === 'number' ? 999 : undefined} step={type === 'number' ? 1 : undefined} inputMode={type === 'number' ? 'numeric' : undefined} aria-invalid={invalid || undefined} aria-describedby={invalid ? errorId : undefined} className="h-11 min-w-0 w-full rounded-md border border-border bg-card px-3" /></label>;
}
