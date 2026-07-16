'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

import { ActionIcon } from '@/components/ui/action-icons';

type NavItem = {
  href: string;
  label: string;
};

export function PublicMobileMenu({ navItems }: { navItems: NavItem[] }) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-expanded={isOpen}
        aria-controls="public-mobile-menu"
        onClick={() => setIsOpen((current) => !current)}
        className="inline-flex size-10 items-center justify-center rounded-md border border-white/20 text-sm font-bold text-white transition hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-accent/60"
      >
        <span className="sr-only">Відкрити меню</span>
        {isOpen ? '×' : '☰'}
      </button>
      {isOpen ? (
        <div
          id="public-mobile-menu"
          className="absolute inset-x-4 top-16 z-30 rounded-lg border border-white/10 bg-primary p-3 shadow-panel"
        >
          <nav className="grid gap-1 text-sm text-sidebar-text">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(`${item.href}/`));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={isActive ? 'page' : undefined}
                  onClick={() => setIsOpen(false)}
                  className={`rounded-md px-3 py-2 transition hover:bg-white/10 hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
                    isActive ? 'bg-white/10 font-semibold text-accent' : ''
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            <Link
              href="/login"
              onClick={() => setIsOpen(false)}
              className="inline-flex items-center gap-2 rounded-md px-3 py-2 font-semibold text-white transition hover:bg-white/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <ActionIcon name="login" />
              Увійти
            </Link>
            <Link
              href="/request"
              onClick={() => setIsOpen(false)}
              className="brand-action mt-2 inline-flex items-center justify-center gap-2 rounded-md bg-accent px-3 py-2 text-center font-bold text-primary transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <ActionIcon name="plus" />
              Створити заявку
            </Link>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
