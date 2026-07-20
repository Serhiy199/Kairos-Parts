import { ContactMessageStatus } from '@prisma/client';
import { headers } from 'next/headers';

import { DashboardShell } from '@/components/layout/dashboard-shell';
import { requireCrmSession } from '@/lib/admin/access';
import { hasDatabaseUrl } from '@/lib/env/database';
import { prisma } from '@/lib/prisma';
import { getNewUsedEquipmentInquiryCount } from '@/lib/used-equipment/queries';

const ADMIN_INVOICE_PRINT_ROUTE = /^\/admin\/invoices\/[^/]+\/print$/;

const adminNavItems = [
  { href: '/admin', label: 'Панель' },
  { href: '/admin/requests', label: 'Заявки' },
  { href: '/admin/contact-messages', label: 'Звернення', icon: 'messages' as const },
  { href: '/admin/used-equipment/items', label: 'БВ техніка', icon: 'tractor' as const, activePrefix: '/admin/used-equipment' },
  { href: '/admin/clients', label: 'Клієнти' },
  { href: '/admin/companies', label: 'Компанії' },
  { href: '/admin/change-requests', label: 'Запити змін' },
  { href: '/admin/audit-log', label: 'Журнал дій' },
  { href: '/admin/billing-settings', label: 'Реквізити продавця' },
  { href: '/admin/directories', label: 'Довідники' },
  { href: '/admin/settings', label: 'Налаштування' }
];

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

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await requireCrmSession();
  const requestHeaders = await headers();
  const pathname = requestHeaders.get('x-kairos-pathname') ?? '';

  if (ADMIN_INVOICE_PRINT_ROUTE.test(pathname)) {
    return <>{children}</>;
  }

  const [newRequestsCount, newContactMessagesCount, newUsedEquipmentInquiryCount] = hasDatabaseUrl()
    ? await Promise.all([
        prisma.request.count({
          where: {
            status: 'NEW'
          }
        }),
        getNewContactMessagesCount(),
        getNewUsedEquipmentInquiryCount().catch((error) => {
          console.error('Used equipment inquiries navigation count failed.', {
            errorType: error instanceof Error ? error.name : 'UnknownError'
          });

          return 0;
        })
      ])
    : [0, 0, 0];

  const navItems = session.user.role === 'ADMIN'
    ? adminNavItems
    : adminNavItems.filter((item) => !['/admin/change-requests', '/admin/billing-settings', '/admin/settings'].includes(item.href));
  const navItemsWithBadges = navItems.map((item) => {
    if (item.href === '/admin/requests') {
      return { ...item, badge: newRequestsCount };
    }

    if (item.href === '/admin/contact-messages') {
      return { ...item, badge: newContactMessagesCount };
    }

    if (item.href === '/admin/used-equipment/items') {
      return { ...item, badge: newUsedEquipmentInquiryCount };
    }

    return item;
  });

  return (
    <DashboardShell title="CRM менеджера" subtitle={session.user.role === 'ADMIN' ? 'Admin / CRM' : 'Manager / CRM'} navItems={navItemsWithBadges} homeHref="/admin" logoutTarget="staff">
      {children}
    </DashboardShell>
  );
}
