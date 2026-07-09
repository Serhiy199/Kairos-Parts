import { DashboardShell } from '@/components/layout/dashboard-shell';
import { requireCrmSession } from '@/lib/admin/access';

const adminNavItems = [
  { href: '/admin', label: 'Панель' },
  { href: '/admin/requests', label: 'Заявки' },
  { href: '/admin/clients', label: 'Клієнти' },
  { href: '/admin/companies', label: 'Компанії' },
  { href: '/admin/change-requests', label: 'Запити змін' },
  { href: '/admin/audit-log', label: 'Журнал дій' },
  { href: '/admin/categories', label: 'Категорії' },
  { href: '/admin/manufacturers', label: 'Виробники' },
  { href: '/admin/settings', label: 'Налаштування' }
];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireCrmSession();
  const navItems = session.user.role === 'ADMIN'
    ? adminNavItems
    : adminNavItems.filter((item) => !['/admin/change-requests', '/admin/categories', '/admin/manufacturers', '/admin/settings'].includes(item.href));

  return (
    <DashboardShell title="CRM менеджера" subtitle={session.user.role === 'ADMIN' ? 'Admin / CRM' : 'Manager / CRM'} navItems={navItems} homeHref="/admin" logoutTarget="staff">
      {children}
    </DashboardShell>
  );
}
