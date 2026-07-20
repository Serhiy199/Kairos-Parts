import { createManufacturer, updateManufacturer } from '@/app/admin/directories/actions';
import { requireCrmSession } from '@/lib/admin/access';
import { prisma } from '@/lib/prisma';

export default async function ManufacturersDirectoryPage({ searchParams }: { searchParams: Promise<{ result?: string }> }) {
  const session = await requireCrmSession();
  const { result } = await searchParams;
  const [types, manufacturers, vehicleUsage] = await Promise.all([
    prisma.equipmentType.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], select: { id: true, name: true, isActive: true } }),
    prisma.manufacturer.findMany({ orderBy: [{ sortOrder: 'asc' }, { name: 'asc' }], include: { equipmentTypes: { select: { equipmentTypeId: true } }, _count: { select: { requests: true, usedEquipment: true } } } }),
    prisma.vehicle.groupBy({ by: ['manufacturer'], _count: { _all: true } })
  ]);
  const vehicleMap = new Map(vehicleUsage.map((item) => [item.manufacturer.toLocaleLowerCase('uk-UA'), item._count._all]));
  const canEdit = session.user.role === 'ADMIN';
  return (
    <section className="grid gap-5 rounded-lg border border-border bg-card p-5 shadow-card sm:p-6">
      <div><p className="text-sm font-bold uppercase text-accent">Довідники</p><h1 className="mt-2 text-2xl font-bold">Виробники</h1><p className="mt-2 text-sm text-muted">Прив’язки визначають залежний список виробників після вибору типу техніки.</p></div>
      {result ? <p aria-live="polite" className="rounded-md border border-border bg-surface-muted p-3 text-sm font-semibold">Результат: {result}</p> : null}
      {canEdit ? <form action={createManufacturer} className="grid gap-4 rounded-md border border-border p-4"><div className="grid gap-3 sm:grid-cols-[1fr_120px_auto] sm:items-end"><Field label="Назва" name="name" required /><Field label="Порядок" name="sortOrder" type="number" defaultValue="0" /><button className="min-h-11 rounded-md bg-accent px-5 text-sm font-bold">Додати</button></div><TypeChecks types={types} /></form> : <p className="rounded-md border border-border p-4 text-sm text-muted">Менеджер має доступ лише для перегляду.</p>}
      <div className="grid gap-3">
        {manufacturers.map((manufacturer) => canEdit ? (
          <form key={manufacturer.id} action={updateManufacturer} className="grid gap-4 rounded-md border border-border p-4">
            <input type="hidden" name="id" value={manufacturer.id} /><div className="grid gap-3 sm:grid-cols-[1fr_120px_auto_auto] sm:items-end"><Field label="Назва" name="name" defaultValue={manufacturer.name} required /><Field label="Порядок" name="sortOrder" type="number" defaultValue={String(manufacturer.sortOrder)} /><label className="flex min-h-11 items-center gap-2 text-sm font-semibold"><input type="checkbox" name="isActive" defaultChecked={manufacturer.isActive} /> Активний</label><button className="min-h-11 rounded-md border border-accent px-4 text-sm font-bold">Зберегти</button></div><TypeChecks types={types} selected={manufacturer.equipmentTypes.map((item) => item.equipmentTypeId)} /><p className="text-xs text-muted">Використань: {manufacturer._count.requests + manufacturer._count.usedEquipment + (vehicleMap.get(manufacturer.name.toLocaleLowerCase('uk-UA')) ?? 0)}</p>
          </form>
        ) : <div key={manufacturer.id} className="rounded-md border border-border p-4"><p className="font-bold">{manufacturer.name}</p><p className="mt-1 text-xs text-muted">{manufacturer.isActive ? 'Активний' : 'Неактивний'} · Типів: {manufacturer.equipmentTypes.length}</p></div>)}
      </div>
    </section>
  );
}

function TypeChecks({ types, selected = [] }: { types: Array<{ id: string; name: string; isActive: boolean }>; selected?: string[] }) {
  return <fieldset><legend className="text-sm font-bold">Типи техніки</legend><div className="mt-2 flex flex-wrap gap-2">{types.map((type) => <label key={type.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs font-semibold"><input type="checkbox" name="equipmentTypeIds" value={type.id} defaultChecked={selected.includes(type.id)} /> {type.name}{type.isActive ? '' : ' (неактивний)'}</label>)}</div></fieldset>;
}

function Field({ label, name, defaultValue, required, type = 'text' }: { label: string; name: string; defaultValue?: string; required?: boolean; type?: string }) {
  return <label className="grid gap-2 text-sm font-semibold">{label}<input name={name} type={type} defaultValue={defaultValue} required={required} min={type === 'number' ? 0 : undefined} className="h-11 rounded-md border border-border bg-card px-3" /></label>;
}
