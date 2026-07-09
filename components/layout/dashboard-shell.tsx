'use client';

import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { logoutClient, logoutStaff } from '@/app/(auth)/actions';

type NavItem = {
  href: string;
  label: string;
};

type LogoutTarget = 'client' | 'staff';

type DashboardShellProps = {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  navItems: NavItem[];
  homeHref: string;
  logoutTarget: LogoutTarget;
};

export function DashboardShell({ children, title, subtitle, navItems, homeHref, logoutTarget }: DashboardShellProps) {
  const pathname = usePathname();
  const logoutAction = logoutTarget === 'staff' ? logoutStaff : logoutClient;

  return (
    <div className="min-h-screen bg-background">
      <aside className="bg-dark-sidebar text-sidebar-text lg:fixed lg:inset-y-0 lg:flex lg:w-64 lg:flex-col">
        <div className="flex min-h-16 items-center justify-between px-4 lg:min-h-20">
          <Link href={homeHref} className="flex items-center" aria-label="Kairos Parts">
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
        </div>
        <div className="flex gap-1 overflow-x-auto px-3 pb-3 text-sm lg:flex-1 lg:flex-col lg:overflow-visible lg:pb-4">
          <nav className="flex gap-1 lg:flex-1 lg:flex-col">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== homeHref && pathname.startsWith(`${item.href}/`));

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`whitespace-nowrap rounded-md px-3 py-2 transition lg:whitespace-normal ${
                    isActive ? 'bg-accent text-foreground' : 'hover:bg-white/10 hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>
          <form action={logoutAction} className="lg:border-t lg:border-white/10 lg:pt-3">
            <button
              type="submit"
              className="w-full whitespace-nowrap rounded-md border border-white/15 px-3 py-2 text-left text-sm font-semibold text-sidebar-text transition hover:border-white/25 hover:bg-white/10 hover:text-white lg:whitespace-normal"
            >
              Вийти
            </button>
          </form>
        </div>
      </aside>
      <div className="min-w-0 w-full lg:ml-64 lg:w-auto">
        <header className="border-b border-border bg-card">
          <div className="px-4 py-5 sm:px-6 lg:px-8">
            <p className="text-sm font-semibold text-muted">{subtitle}</p>
            <h1 className="mt-1 text-2xl font-bold text-foreground">{title}</h1>
          </div>
        </header>
        <main className="min-w-0 px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
