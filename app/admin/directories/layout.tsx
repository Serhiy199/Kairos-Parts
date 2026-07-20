import Link from 'next/link';

import { requireCrmSession } from '@/lib/admin/access';

export default async function DirectoriesLayout({ children }: { children: React.ReactNode }) {
  await requireCrmSession();
  return (
    <div className="grid gap-6">
      <nav aria-label="Розділи типів і виробників" className="flex flex-wrap gap-2 rounded-lg border border-border bg-card p-3 shadow-card">
        <Link href="/admin/directories" className="rounded-md px-4 py-2 text-sm font-bold text-foreground hover:bg-surface-muted">Огляд</Link>
        <Link href="/admin/directories/equipment-types" className="rounded-md px-4 py-2 text-sm font-bold text-foreground hover:bg-surface-muted">Типи техніки</Link>
        <Link href="/admin/directories/manufacturers" className="rounded-md px-4 py-2 text-sm font-bold text-foreground hover:bg-surface-muted">Виробники</Link>
      </nav>
      {children}
    </div>
  );
}
