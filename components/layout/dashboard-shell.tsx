'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useId, useRef, useState } from 'react';
import {
  TbArrowsExchange,
  TbBuilding,
  TbBuildingStore,
  TbClipboardList,
  TbFileDescription,
  TbHierarchy3,
  TbHistory,
  TbLayoutDashboard,
  TbMenu2,
  TbMessageCircle,
  TbTractor,
  TbUser,
  TbUsers,
  TbUsersGroup,
  TbX
} from 'react-icons/tb';

import { logoutClient, logoutStaff } from '@/app/(auth)/actions';

type NavIcon = keyof typeof NAV_ICONS;

export type DashboardNavItem = {
  href: string;
  label: string;
  badge?: number;
  icon?: NavIcon;
  activePrefix?: string;
};

type LogoutTarget = 'client' | 'staff';
type ContentWidth = 'default' | 'wide';

type DashboardShellProps = {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  navItems: DashboardNavItem[];
  homeHref: string;
  logoutTarget: LogoutTarget;
  contentWidth?: ContentWidth;
};

const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(',');

export function DashboardShell({
  children,
  title,
  subtitle,
  navItems,
  homeHref,
  logoutTarget,
  contentWidth = 'default'
}: DashboardShellProps) {
  const pathname = usePathname();
  const drawerId = useId();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const previousPathnameRef = useRef(pathname);
  const logoutAction = logoutTarget === 'staff' ? logoutStaff : logoutClient;
  const contentMaxWidth = contentWidth === 'wide' ? 'max-w-[1600px]' : 'max-w-[1440px]';

  useEffect(() => {
    if (previousPathnameRef.current !== pathname) {
      previousPathnameRef.current = pathname;
      setDrawerOpen(false);
    }
  }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const drawer = drawerRef.current;
    const focusableElements = drawer?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
    focusableElements?.[0]?.focus();

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault();
        setDrawerOpen(false);
        menuButtonRef.current?.focus();
        return;
      }

      if (event.key !== 'Tab' || !drawer) {
        return;
      }

      const items = Array.from(drawer.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      const first = items[0];
      const last = items.at(-1);

      if (!first || !last) {
        return;
      }

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [drawerOpen]);

  function closeDrawer({ restoreFocus = true } = {}) {
    setDrawerOpen(false);
    if (restoreFocus) {
      requestAnimationFrame(() => menuButtonRef.current?.focus());
    }
  }

  return (
    <div className="min-h-screen overflow-x-clip bg-background text-foreground">
      <a
        href="#cabinet-main-content"
        className="fixed left-4 top-3 z-[70] -translate-y-24 rounded-md bg-accent px-4 py-2 text-sm font-bold text-foreground shadow-lg transition focus:translate-y-0 motion-reduce:transition-none"
      >
        Перейти до основного вмісту
      </a>

      <aside className="fixed inset-y-0 left-0 z-40 hidden w-56 flex-col bg-dark-sidebar text-sidebar-text xl:flex 2xl:w-60">
        <SidebarContent
          navItems={navItems}
          pathname={pathname}
          homeHref={homeHref}
          logoutAction={logoutAction}
        />
      </aside>

      <header className="sticky top-0 z-30 border-b border-white/10 bg-dark-sidebar text-sidebar-text xl:hidden">
        <div className="flex min-h-16 items-center justify-between gap-4 px-4 sm:px-5 lg:px-6">
          <Link href={homeHref} className="min-w-0" aria-label="Kairos Parts">
            <Image
              src="/images/kairos-logo.png"
              alt="Kairos Parts"
              width={172}
              height={40}
              priority
              sizes="172px"
              className="h-10 w-auto max-w-[172px] object-contain"
            />
          </Link>
          <div className="flex min-w-0 items-center gap-3">
            <span className="hidden truncate text-sm font-semibold text-white/75 sm:block">{subtitle}</span>
            <button
              ref={menuButtonRef}
              type="button"
              aria-label="Відкрити меню кабінету"
              aria-expanded={drawerOpen}
              aria-controls={drawerId}
              onClick={() => setDrawerOpen(true)}
              className="inline-flex size-11 shrink-0 items-center justify-center rounded-md border border-white/20 text-white transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-dark-sidebar"
            >
              <TbMenu2 aria-hidden="true" className="size-6" />
            </button>
          </div>
        </div>
      </header>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 xl:hidden">
          <button
            type="button"
            aria-label="Закрити меню"
            className="absolute inset-0 bg-black/65 backdrop-blur-[1px]"
            onClick={() => closeDrawer()}
          />
          <div
            ref={drawerRef}
            id={drawerId}
            role="dialog"
            aria-modal="true"
            aria-label="Навігація кабінету"
            className="relative flex h-dvh w-[min(88vw,320px)] flex-col bg-dark-sidebar text-sidebar-text shadow-2xl motion-safe:animate-[cabinet-drawer-in_180ms_ease-out]"
          >
            <button
              type="button"
              aria-label="Закрити меню"
              onClick={() => closeDrawer()}
              className="absolute right-3 top-3 z-10 inline-flex size-10 items-center justify-center rounded-md border border-white/15 text-white transition hover:border-accent hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              <TbX aria-hidden="true" className="size-6" />
            </button>
            <SidebarContent
              navItems={navItems}
              pathname={pathname}
              homeHref={homeHref}
              logoutAction={logoutAction}
              onNavigate={() => closeDrawer({ restoreFocus: false })}
            />
          </div>
        </div>
      ) : null}

      <div className="min-w-0 w-full xl:pl-56 2xl:pl-60">
        <header className="border-b border-border bg-card">
          <div className={`mx-auto w-full min-w-0 ${contentMaxWidth} px-4 py-4 sm:px-5 sm:py-5 lg:px-6 xl:px-8 xl:py-6`}>
            <p className="text-sm font-semibold text-muted">{subtitle}</p>
            <h1 className="mt-1 text-2xl font-bold text-foreground sm:text-[1.75rem]">{title}</h1>
          </div>
        </header>
        <main
          id="cabinet-main-content"
          tabIndex={-1}
          className={`mx-auto w-full min-w-0 ${contentMaxWidth} px-4 py-4 outline-none sm:px-5 sm:py-5 lg:px-6 lg:py-6 xl:px-8`}
        >
          {children}
        </main>
      </div>
    </div>
  );
}

type SidebarContentProps = {
  navItems: DashboardNavItem[];
  pathname: string;
  homeHref: string;
  logoutAction: (formData: FormData) => void | Promise<void>;
  onNavigate?: () => void;
};

function SidebarContent({ navItems, pathname, homeHref, logoutAction, onNavigate }: SidebarContentProps) {
  return (
    <>
      <div className="flex min-h-20 items-center px-4 pr-14 xl:pr-4">
        <Link href={homeHref} onClick={onNavigate} className="flex items-center" aria-label="Kairos Parts">
          <Image
            src="/images/kairos-logo.png"
            alt="Kairos Parts"
            width={206}
            height={48}
            priority
            sizes="206px"
            className="h-12 w-auto max-w-full object-contain"
          />
        </Link>
      </div>
      <div className="flex min-h-0 flex-1 flex-col px-3 pb-4 text-sm">
        <nav aria-label="Навігація кабінету" className="min-h-0 flex-1 space-y-1 overflow-y-auto overscroll-contain py-1">
          {navItems.map((item) => {
            const activeTarget = item.activePrefix ?? item.href;
            const isActive =
              pathname === item.href ||
              (activeTarget !== homeHref && pathname.startsWith(`${activeTarget}/`)) ||
              (activeTarget !== homeHref && pathname === activeTarget);
            const Icon = item.icon ? NAV_ICONS[item.icon] : null;

            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={onNavigate}
                aria-current={isActive ? 'page' : undefined}
                className={`block rounded-md px-3 py-2.5 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${
                  isActive ? 'bg-accent text-foreground' : 'hover:bg-white/10 hover:text-white'
                }`}
              >
                <span className="flex w-full min-w-0 items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2.5">
                    {Icon ? <Icon aria-hidden="true" className="size-[18px] shrink-0" /> : null}
                    <span className="min-w-0 leading-5">{item.label}</span>
                  </span>
                  {item.badge && item.badge > 0 ? (
                    <span
                      aria-label={`${item.badge} нових`}
                      className={`inline-flex min-w-6 shrink-0 items-center justify-center rounded-full px-2 py-0.5 text-xs font-bold ${
                        isActive ? 'bg-foreground text-accent' : 'bg-[#E7F6EC] text-success'
                      }`}
                    >
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  ) : null}
                </span>
              </Link>
            );
          })}
        </nav>
        <form action={logoutAction} className="mt-3 border-t border-white/10 pt-3">
          <button
            type="submit"
            className="w-full rounded-md border border-white/15 px-3 py-2.5 text-left text-sm font-semibold text-sidebar-text transition hover:border-white/25 hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            Вийти
          </button>
        </form>
      </div>
    </>
  );
}

const NAV_ICONS = {
  dashboard: TbLayoutDashboard,
  requests: TbClipboardList,
  messages: TbMessageCircle,
  tractor: TbTractor,
  clients: TbUsers,
  companies: TbBuilding,
  changes: TbArrowsExchange,
  history: TbHistory,
  billing: TbBuildingStore,
  directories: TbHierarchy3,
  team: TbUsersGroup,
  documents: TbFileDescription,
  profile: TbUser
} as const;
