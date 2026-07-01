import { DashboardShell } from '@/components/layout/dashboard-shell';

const clientNavItems = [
  { href: '/client', label: 'Панель керування' },
  { href: '/client/requests', label: 'Мої заявки' },
  { href: '/client/vehicles', label: 'Мій парк техніки' },
  { href: '/client/documents', label: 'Документи' },
  { href: '/client/profile', label: 'Профіль' }
];

export default function ClientLayout({ children }: { children: React.ReactNode }) {
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
