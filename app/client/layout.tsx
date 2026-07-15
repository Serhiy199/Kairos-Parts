import { DashboardShell } from '@/components/layout/dashboard-shell';
import { getClientAccessContext, requestAccessWhere, requireClientSession } from '@/lib/client/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const session = await requireClientSession();
  let pendingApprovalRequestCount = 0;

  if (hasDatabaseUrl()) {
    const access = await getClientAccessContext(session.user.id);

    if (access) {
      pendingApprovalRequestCount = await prisma.request.count({
        where: {
          AND: [
            requestAccessWhere(access),
            {
              items: {
                some: {
                  visibleToClient: true,
                  approvedByClient: false
                }
              }
            }
          ]
        }
      });
    }
  }

  const clientNavItems = [
    { href: '/client', label: 'Панель керування' },
    { href: '/client/requests', label: 'Мої заявки', badge: pendingApprovalRequestCount },
    { href: '/client/vehicles', label: 'Мій парк техніки' },
    { href: '/client/documents', label: 'Документи' },
    { href: '/client/change-requests', label: 'Запити на зміну' },
    { href: '/client/profile', label: 'Профіль' }
  ];

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
