import { DashboardShell } from '@/components/layout/dashboard-shell';
import { requireClientSession } from '@/lib/client/access';

const clientNavItems = [
  { href: '/client', label: 'Панель керування' },
  { href: '/client/requests', label: 'Мої заявки' },
  { href: '/client/profile', label: 'Профіль' }
];

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  await requireClientSession();

  return (
    <DashboardShell
      title="Кабінет клієнта"
      subtitle="Client dashboard"
      navItems={clientNavItems}
      homeHref="/client"
    >
      {children}
    </DashboardShell>
  );
}
