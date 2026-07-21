import Link from 'next/link';
import { notFound } from 'next/navigation';

import { EQUIPMENT_TAXONOMY_ADMIN_ENABLED } from '@/lib/features/equipment-taxonomy';
import { prisma } from '@/lib/prisma';

export default async function DirectoriesPage() {
  if (!EQUIPMENT_TAXONOMY_ADMIN_ENABLED) {
    notFound();
  }

  const [types, manufacturers, relations] = await Promise.all([
    prisma.equipmentType.count(), prisma.manufacturer.count(), prisma.manufacturerEquipmentType.count()
  ]);
  return (
    <section className="rounded-lg border border-border bg-card p-6 shadow-card">
      <p className="text-sm font-bold uppercase text-accent">Типи й виробники</p>
      <h1 className="mt-2 text-2xl font-bold text-foreground">Типи техніки та виробники</h1>
      <p className="mt-3 max-w-3xl text-sm leading-6 text-muted">Керуйте значеннями, які доступні у нових формах. Історичні категорії каталогу та старі записи не змінюються.</p>
      <div className="mt-6 grid gap-4 sm:grid-cols-3">
        <DirectoryCard href="/admin/directories/equipment-types" label="Типи техніки" value={types} />
        <DirectoryCard href="/admin/directories/manufacturers" label="Виробники" value={manufacturers} />
        <div className="rounded-md border border-border p-4"><p className="text-sm text-muted">Зв’язки</p><p className="mt-2 text-2xl font-bold">{relations}</p></div>
      </div>
    </section>
  );
}

function DirectoryCard({ href, label, value }: { href: string; label: string; value: number }) {
  return <Link href={href} className="rounded-md border border-border p-4 transition hover:border-accent"><p className="text-sm text-muted">{label}</p><p className="mt-2 text-2xl font-bold">{value}</p></Link>;
}
