import { headers } from 'next/headers';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { getClientAccessContext, requestAccessWhere, requireClientSession } from '@/lib/client/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';

const CLIENT_INVOICE_PRINT_ROUTE = /^\/client\/invoices\/[^/]+\/print$/;

export default async function ClientLayout({ children }: { children: React.ReactNode }) {
  const session = await requireClientSession();
  const requestHeaders = await headers();
  const pathname = requestHeaders.get('x-kairos-pathname') ?? '';

  if (CLIENT_INVOICE_PRINT_ROUTE.test(pathname)) {
    return <>{children}</>;
  }

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
    { href: '/client', label: 'Панель керування', icon: 'dashboard' as const },
    { href: '/client/requests', label: 'Мої заявки', icon: 'requests' as const, badge: pendingApprovalRequestCount },
    { href: '/client/vehicles', label: 'Мій парк техніки', icon: 'tractor' as const },
    { href: '/client/documents', label: 'Документи', icon: 'documents' as const },
    { href: '/client/change-requests', label: 'Запити на зміну', icon: 'changes' as const },
    { href: '/client/profile', label: 'Профіль', icon: 'profile' as const }
  ];
  const wideContent = ['/client/requests', '/client/change-requests', '/client/documents'].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  return (
    <DashboardShell
      title="Кабінет клієнта"
      subtitle="Client dashboard"
      navItems={clientNavItems}
      homeHref="/client"
      logoutTarget="client"
      contentWidth={wideContent ? 'wide' : 'default'}
    >
      {children}
    </DashboardShell>
  );
}
