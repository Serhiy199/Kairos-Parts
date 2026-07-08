import { DashboardShell } from '@/components/layout/dashboard-shell';
import { requireClientSession } from '@/lib/client/access';

const clientNavItems = [
  { href: '/client', label: 'Панель керування' },
  { href: '/client/requests', label: 'Мої заявки' },
  { href: '/client/vehicles', label: 'Мій парк техніки' },
  { href: '/client/documents', label: 'Документи' },
  { href: '/client/change-requests', label: 'Запити на зміну' },
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
      logoutTarget="client"
    >
      {children}
    </DashboardShell>
  );
}
