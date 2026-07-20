import { createEquipmentType, updateEquipmentType } from '@/app/admin/directories/actions';
import { requireCrmSession } from '@/lib/admin/access';
import { prisma } from '@/lib/prisma';

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
  return (
    <section className="grid gap-5 rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
      <div><p className="text-sm font-bold uppercase text-accent">Довідники</p><h1 className="mt-2 text-2xl font-bold">Типи техніки</h1><p className="mt-2 text-sm text-muted">Неактивні значення залишаються в історії, але не показуються у нових формах.</p></div>
      {result ? <p aria-live="polite" className="rounded-md border border-border bg-surface-muted p-3 text-sm font-semibold">Результат: {result}</p> : null}
      {canEdit ? <form action={createEquipmentType} className="grid gap-3 rounded-md border border-border p-4 sm:grid-cols-[1fr_120px_auto] sm:items-end"><Field label="Назва" name="name" required /><Field label="Порядок" name="sortOrder" type="number" defaultValue="0" /><button className="min-h-11 rounded-md bg-accent px-5 text-sm font-bold">Додати</button></form> : <p className="rounded-md border border-border p-4 text-sm text-muted">Менеджер має доступ лише для перегляду.</p>}
      <div className="grid gap-3">
        {types.map((type) => canEdit ? (
          <form key={type.id} action={updateEquipmentType} className="grid gap-3 rounded-md border border-border p-4 lg:grid-cols-[1fr_220px_110px_auto_auto] lg:items-end">
            <input type="hidden" name="id" value={type.id} /><Field label="Назва" name="name" defaultValue={type.name} required /><Field label="Slug" name="slug" defaultValue={type.slug} required /><Field label="Порядок" name="sortOrder" type="number" defaultValue={String(type.sortOrder)} /><label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" name="isActive" defaultChecked={type.isActive} /> Активний</label><button className="min-h-11 rounded-md border border-accent px-4 text-sm font-bold">Зберегти</button><p className="text-xs text-muted lg:col-span-5">Виробників: {type._count.manufacturers} · Використань: {usageMap.get(type.name.toLocaleLowerCase('uk-UA')) ?? 0}</p>
          </form>
        ) : <div key={type.id} className="rounded-md border border-border p-4"><p className="font-bold">{type.name}</p><p className="mt-1 text-xs text-muted">{type.isActive ? 'Активний' : 'Неактивний'} · Виробників: {type._count.manufacturers} · Використань: {usageMap.get(type.name.toLocaleLowerCase('uk-UA')) ?? 0}</p></div>)}
      </div>
    </section>
  );
}

function Field({ label, name, defaultValue, required, type = 'text' }: { label: string; name: string; defaultValue?: string; required?: boolean; type?: string }) {
  return <label className="grid gap-2 text-sm font-semibold">{label}<input name={name} type={type} defaultValue={defaultValue} required={required} min={type === 'number' ? 0 : undefined} className="h-11 rounded-md border border-border bg-card px-3" /></label>;
}
