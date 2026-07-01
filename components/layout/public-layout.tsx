import Link from 'next/link';

import { PublicMobileMenu } from './public-mobile-menu';

const navItems = [
  { href: '/about', label: 'Про нас' },
  { href: '/how-it-works', label: 'Як це працює' },
  { href: '/categories', label: 'Категорії' },
  { href: '/#advantages', label: 'Переваги' },
  { href: '/contacts', label: 'Контакти' }
];

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-primary text-white shadow-panel">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="flex shrink-0 items-center gap-3 font-bold">
            <span className="grid size-9 place-items-center rounded-md border border-accent text-accent">KP</span>
            <span>Kairos Parts</span>
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-sidebar-text md:flex">
            {navItems.map((item) => (
              <Link key={item.href} href={item.href} className="transition hover:text-white">
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="hidden items-center gap-2 md:flex">
            <Link
              href="/#telegram"
              className="rounded-md border border-accent/50 px-4 py-2 text-sm font-semibold text-accent transition hover:bg-accent/10"
            >
              Telegram
            </Link>
            <Link
              href="/login"
              className="hidden rounded-md border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 sm:inline-flex"
            >
              Увійти
            </Link>
            <Link
              href="/request"
              className="rounded-md bg-accent px-4 py-2 text-sm font-bold text-foreground transition hover:bg-[#DFA600]"
            >
              Створити заявку
            </Link>
          </div>
          <PublicMobileMenu navItems={navItems} />
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-border bg-card">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 sm:px-6 md:grid-cols-[1.5fr_1fr_1fr] lg:px-8">
          <div>
            <div className="flex items-center gap-3 font-bold text-foreground">
              <span className="grid size-9 place-items-center rounded-md border border-accent bg-primary text-accent">KP</span>
              <span>Kairos Parts</span>
            </div>
            <p className="mt-4 max-w-md text-sm leading-6 text-muted">
              Єдина точка контакту для підбору та постачання запчастин для аграрної, вантажної,
              комерційної та спеціальної техніки.
            </p>
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Навігація</p>
            <div className="mt-3 grid gap-2 text-sm text-muted">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} className="transition hover:text-foreground">
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">Контакти</p>
            <div className="mt-3 grid gap-2 text-sm text-muted">
              <span>Телефон: +38 (000) 000 00 00</span>
              <span>Email: hello@kairos-parts.example</span>
              <span>Telegram: @kairos_parts_bot</span>
            </div>
          </div>
        </div>
        <div className="border-t border-border px-4 py-4 text-center text-xs text-muted">
          © 2026 Kairos Parts. MVP public website foundation.
        </div>
      </footer>
    </div>
  );
}
