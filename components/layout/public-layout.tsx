import Image from 'next/image';
import Link from 'next/link';

import { ActionIcon } from '@/components/ui/action-icons';

import { PublicDesktopNavigation } from './public-desktop-navigation';
import { PublicMobileMenu } from './public-mobile-menu';

const telegramBotUrl = 'https://t.me/kairos_parts_bot';

const navItems = [
  { href: '/about', label: 'Про нас' },
  { href: '/how-it-works', label: 'Як це працює' },
  { href: '/used-equipment', label: 'Майданчик БВ техніки' },
  { href: '/advantages', label: 'Переваги' },
  { href: '/contacts', label: 'Контакти' }
];

export function PublicLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="public-brand-type min-h-screen bg-public-page text-public-primary">
      <header className="sticky top-0 z-40 bg-primary text-white shadow-panel">
        <div className="kp-container flex min-h-16 items-center justify-between gap-4 py-3">
          <Link href="/" className="flex shrink-0 items-center" aria-label="Kairos Parts">
            <Image
              src="/images/kairos-logo.png"
              alt="Kairos Parts"
              width={206}
              height={48}
              priority
              sizes="206px"
              className="h-12 w-auto rounded-md object-contain"
            />
          </Link>
          <PublicDesktopNavigation navItems={navItems} />
          <div className="hidden items-center gap-2 lg:flex">
            <Link
              href="/login"
              className="hidden items-center gap-2 rounded-md border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 sm:inline-flex"
            >
              <ActionIcon name="login" />
              Увійти
            </Link>
            <Link
              href="/request"
              className="brand-action inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-bold text-primary transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <ActionIcon name="plus" />
              Створити заявку
            </Link>
          </div>
          <PublicMobileMenu navItems={navItems} />
        </div>
      </header>
      <main>{children}</main>
      <footer className="border-t border-public-border bg-[#050607]">
        <div className="kp-container grid gap-8 py-10 md:grid-cols-[1.5fr_1fr_1fr]">
          <div>
            <div className="inline-flex">
              <Image
                src="/images/kairos-logo.png"
                alt="Kairos Parts"
                width={206}
                height={48}
                sizes="206px"
                className="h-12 w-auto object-contain"
              />
            </div>
            <p className="mt-4 max-w-md text-sm leading-6 text-public-muted">
              Єдина точка контакту для підбору та постачання запчастин для аграрної, вантажної,
              комерційної та спеціальної техніки.
            </p>
          </div>
          <div>
            <p className="text-sm font-bold text-public-primary">Навігація</p>
            <div className="mt-3 grid gap-2 text-sm text-public-muted">
              {navItems.map((item) => (
                <Link key={item.href} href={item.href} className="transition hover:text-public-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                  {item.label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="text-sm font-bold text-public-primary">Контакти</p>
            <div className="mt-3 grid gap-2 text-sm text-public-muted">
              <a href="tel:+380000000000" className="inline-flex items-center gap-2 transition hover:text-public-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                <ActionIcon name="phone" className="size-4 text-accent" />
                <span>Телефон: +38 (000) 000 00 00</span>
              </a>
              <a href="mailto:hello@kairos-parts.example" className="inline-flex items-center gap-2 transition hover:text-public-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                <ActionIcon name="mail" className="size-4 text-accent" />
                <span>Email: hello@kairos-parts.example</span>
              </a>
              <a href={telegramBotUrl} className="inline-flex items-center gap-2 transition hover:text-public-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent">
                <ActionIcon name="telegram" className="size-4 text-accent" />
                <span>Telegram: @kairos_parts_bot</span>
              </a>
            </div>
          </div>
        </div>
        <div className="border-t border-public-border">
          <div className="kp-container py-4 text-center text-xs text-public-subtle">
            © 2026 Kairos Parts. MVP public website foundation.
          </div>
        </div>
      </footer>
    </div>
  );
}
