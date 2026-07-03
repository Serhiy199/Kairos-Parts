'use client';

import Link from 'next/link';
import { useState } from 'react';

type NavItem = {
  href: string;
  label: string;
};

export function PublicMobileMenu({ navItems }: { navItems: NavItem[] }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="md:hidden">
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
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setIsOpen(false)}
                className="rounded-md px-3 py-2 transition hover:bg-white/10 hover:text-white"
              >
                {item.label}
              </Link>
            ))}
            <Link
              href="/#telegram"
              onClick={() => setIsOpen(false)}
              className="rounded-md px-3 py-2 font-semibold text-accent transition hover:bg-white/10"
            >
              Заявка в Telegram
            </Link>
            <Link
              href="/request"
              onClick={() => setIsOpen(false)}
              className="brand-action mt-2 rounded-md bg-accent px-3 py-2 text-center font-bold text-foreground transition hover:bg-accent-hover"
            >
              Створити заявку
            </Link>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
