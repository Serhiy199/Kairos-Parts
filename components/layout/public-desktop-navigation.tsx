'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type NavItem = {
  href: string;
  label: string;
};

function isCurrentPath(pathname: string, href: string) {
  return pathname === href || (href !== '/' && pathname.startsWith(`${href}/`));
}

export function PublicDesktopNavigation({ navItems }: { navItems: NavItem[] }) {
  const pathname = usePathname();

  return (
    <nav className="hidden items-center gap-6 text-sm text-sidebar-text lg:flex" aria-label="Основна навігація">
      {navItems.map((item) => {
        const isActive = isCurrentPath(pathname, item.href);

        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={isActive ? 'page' : undefined}
            className={`rounded-sm transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent ${
              isActive ? 'font-semibold text-accent' : 'hover:text-white'
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
