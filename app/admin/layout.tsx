import { DashboardShell } from '@/components/layout/dashboard-shell';

const adminNavItems = [
  { href: '/admin', label: 'Панель' },
  { href: '/admin/requests', label: 'Заявки' },
  { href: '/admin/clients', label: 'Клієнти' },
  { href: '/admin/categories', label: 'Категорії' },
  { href: '/admin/manufacturers', label: 'Виробники' },
  { href: '/admin/settings', label: 'Налаштування' }
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardShell title="CRM менеджера" subtitle="Admin / CRM" navItems={adminNavItems} homeHref="/admin">
      {children}
    </DashboardShell>
  );
}
