import { ContactMessageStatus } from '@prisma/client';
import type { Metadata } from 'next';
import { headers } from 'next/headers';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { requireCrmSession } from '@/lib/admin/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { EQUIPMENT_TAXONOMY_ADMIN_ENABLED } from '@/lib/features/equipment-taxonomy';
import { prisma } from '@/lib/prisma';
import { NOINDEX_METADATA } from '@/lib/seo';
import { getNewUsedEquipmentInquiryCount } from '@/lib/used-equipment/queries';

const ADMIN_INVOICE_PRINT_ROUTE = /^\/admin\/invoices\/[^/]+\/print$/;

export const metadata: Metadata = NOINDEX_METADATA;

const adminNavItems = [
  { href: '/admin', label: 'Панель', icon: 'dashboard' as const },
  { href: '/admin/requests', label: 'Заявки', icon: 'requests' as const, badgeTone: 'success' as const },
  { href: '/admin/logistics', label: 'Логістика', icon: 'logistics' as const },
  { href: '/admin/contact-messages', label: 'Звернення', icon: 'messages' as const },
  { href: '/admin/used-equipment/items', label: 'БВ техніка', icon: 'tractor' as const, activePrefix: '/admin/used-equipment' },
  { href: '/admin/clients', label: 'Клієнти', icon: 'clients' as const },
  { href: '/admin/companies', label: 'Компанії', icon: 'companies' as const },
  { href: '/admin/change-requests', label: 'Запити змін', icon: 'changes' as const },
  { href: '/admin/audit-log', label: 'Журнал дій', icon: 'history' as const },
  { href: '/admin/billing-settings', label: 'Реквізити продавця', icon: 'billing' as const },
  ...(EQUIPMENT_TAXONOMY_ADMIN_ENABLED
    ? [{ href: '/admin/directories', label: 'Типи й виробники', icon: 'directories' as const }]
    : []),
  { href: '/admin/team', label: 'Команда', icon: 'team' as const }
];

const ADMIN_ONLY_ROUTES = ['/admin/change-requests', '/admin/audit-log', '/admin/billing-settings', '/admin/team'];

async function getNewContactMessagesCount() {
  try {
    return await prisma.contactMessage.count({
      where: {
        status: ContactMessageStatus.NEW
      }
    });
  } catch (error) {
    console.error('Contact messages navigation count failed.', {
      errorType: error instanceof Error ? error.name : 'UnknownError'
    });

    return 0;
  }
}

async function getNewLogisticsRequestsCount() {
  try {
    return await prisma.logisticsRequest.count({
      where: {
        status: 'NEW'
      }
    });
  } catch (error) {
    console.error('Logistics requests navigation count failed.', {
      errorType: error instanceof Error ? error.name : 'UnknownError'
    });

    return 0;
  }
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireCrmSession();
  const requestHeaders = await headers();
  const pathname = requestHeaders.get('x-kairos-pathname') ?? '';

  if (ADMIN_INVOICE_PRINT_ROUTE.test(pathname)) {
    return <>{children}</>;
  }

  const [
    newRequestsCount,
    newLogisticsRequestsCount,
    newContactMessagesCount,
    newUsedEquipmentInquiryCount
  ] = hasDatabaseUrl()
    ? await Promise.all([
        prisma.request.count({
          where: {
            status: 'NEW'
          }
        }),
        getNewLogisticsRequestsCount(),
        getNewContactMessagesCount(),
        getNewUsedEquipmentInquiryCount().catch((error) => {
          console.error('Used equipment inquiries navigation count failed.', {
            errorType: error instanceof Error ? error.name : 'UnknownError'
          });

          return 0;
        })
      ])
    : [0, 0, 0, 0];

  const navItems = session.user.role === 'ADMIN'
    ? adminNavItems
    : adminNavItems.filter((item) => !ADMIN_ONLY_ROUTES.includes(item.href));
  const navItemsWithBadges = navItems.map((item) => {
    if (item.href === '/admin/requests') {
      return { ...item, badge: newRequestsCount };
    }

    if (item.href === '/admin/contact-messages') {
      return { ...item, badge: newContactMessagesCount };
    }

    if (item.href === '/admin/logistics') {
      return { ...item, badge: newLogisticsRequestsCount };
    }

    if (item.href === '/admin/used-equipment/items') {
      return { ...item, badge: newUsedEquipmentInquiryCount };
    }

    return item;
  });
  const wideContent = [
    '/admin/requests',
    '/admin/logistics',
    '/admin/clients',
    '/admin/companies',
    '/admin/change-requests',
    '/admin/audit-log',
    '/admin/contact-messages',
    '/admin/used-equipment',
    '/admin/team'
  ].some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
  const isAdmin = session.user.role === 'ADMIN';

  return (
    <DashboardShell
      title={isAdmin ? 'CRM адміністратора' : 'CRM менеджера'}
      subtitle={isAdmin ? 'Адміністратор / CRM' : 'Менеджер / CRM'}
      navItems={navItemsWithBadges}
      homeHref="/admin"
      logoutTarget="staff"
      contentWidth={wideContent ? 'wide' : 'default'}
    >
      {children}
    </DashboardShell>
  );
}
