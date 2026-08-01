import Image from 'next/image';
import Link from 'next/link';
import { TbMapPin } from 'react-icons/tb';

import { ActionIcon } from '@/components/ui/action-icons';
import { getPublicHeaderCta } from '@/lib/public/header-auth';
import { siteContacts } from '@/lib/site-contacts';

import { PublicDesktopNavigation } from './public-desktop-navigation';
import { PublicMobileMenu } from './public-mobile-menu';

const navItems = [
  { href: '/about', label: 'Про нас' },
  { href: '/how-it-works', label: 'Як це працює' },
  { href: '/logistics', label: 'Логістика' },
  { href: '/used-equipment', label: 'БВ техніка' },
  { href: '/contacts', label: 'Контакти' }
];

export async function PublicLayout({ children }: { children: React.ReactNode }) {
  const headerCta = await getPublicHeaderCta();

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
              href={headerCta.href}
              className="hidden items-center gap-2 rounded-md border border-white/20 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/10 sm:inline-flex"
            >
              <ActionIcon name={headerCta.icon} />
              {headerCta.label}
            </Link>
            <Link
              href="/request"
              className="brand-action inline-flex items-center gap-2 rounded-md bg-accent px-4 py-2 text-sm font-bold text-primary transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              <ActionIcon name="plus" />
              Створити заявку
            </Link>
          </div>
          <PublicMobileMenu navItems={navItems} headerCta={headerCta} />
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
              Єдина точка контакту для підбору та постачання запчастин для аграрної, вантажної та
              спеціальної техніки.
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
            <address className="mt-3 grid min-w-0 gap-2 text-sm not-italic text-public-muted">
              <a
                href={siteContacts.phone.href}
                aria-label={`Зателефонувати за номером ${siteContacts.phone.display}`}
                className="inline-flex min-h-9 min-w-0 items-center gap-2 transition hover:text-public-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <ActionIcon name="phone" className="size-4 text-accent" />
                <span>Телефон: {siteContacts.phone.display}</span>
              </a>
              <a
                href={siteContacts.email.href}
                aria-label={`Написати на email ${siteContacts.email.display}`}
                className="inline-flex min-h-9 min-w-0 items-center gap-2 transition hover:text-public-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <ActionIcon name="mail" className="size-4 text-accent" />
                <span className="min-w-0 break-all">Email: {siteContacts.email.display}</span>
              </a>
              <a
                href={siteContacts.address.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Відкрити адресу ${siteContacts.address.display} у Google Maps`}
                className="inline-flex min-h-9 min-w-0 items-center gap-2 transition hover:text-public-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <TbMapPin aria-hidden="true" className="size-4 shrink-0 text-accent" />
                <span className="min-w-0 break-words">Адреса: {siteContacts.address.display}</span>
              </a>
              <a
                href={siteContacts.telegram.href}
                target="_blank"
                rel="noopener noreferrer"
                aria-label={`Відкрити Telegram ${siteContacts.telegram.display}`}
                className="inline-flex min-h-9 min-w-0 items-center gap-2 transition hover:text-public-primary focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                <ActionIcon name="telegram" className="size-4 text-accent" />
                <span>Telegram: {siteContacts.telegram.display}</span>
              </a>
            </address>
          </div>
        </div>
        <div className="border-t border-public-border">
          <div className="kp-container flex flex-col items-center justify-between gap-3 py-4 text-center text-xs text-public-subtle sm:flex-row sm:text-left">
            <span>© 2026 Kairos Parts. MVP public website foundation.</span>
            <nav aria-label="Правова інформація" className="flex flex-wrap items-center justify-center gap-x-4 gap-y-2 sm:justify-end">
              <Link
                href="/privacy-policy"
                className="transition hover:text-public-primary focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
              >
                Політика конфіденційності
              </Link>
              <Link
                href="/terms-of-use"
                className="transition hover:text-public-primary focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
              >
                Умови користування
              </Link>
              <Link
                href="/contacts"
                className="transition hover:text-public-primary focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
              >
                Контакти
              </Link>
            </nav>
          </div>
        </div>
      </footer>
    </div>
  );
}
