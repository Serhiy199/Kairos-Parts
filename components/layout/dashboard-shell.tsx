import Image from 'next/image';
import Link from 'next/link';

type NavItem = {
  href: string;
  label: string;
};

type DashboardShellProps = {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  navItems: NavItem[];
  homeHref: string;
};

export function DashboardShell({ children, title, subtitle, navItems, homeHref }: DashboardShellProps) {
  return (
    <div className="min-h-screen bg-background lg:flex">
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
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 text-sm lg:flex-1 lg:flex-col lg:overflow-visible lg:pb-0">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="whitespace-nowrap rounded-md px-3 py-2 transition hover:bg-white/10 hover:text-white lg:whitespace-normal"
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0 flex-1 lg:pl-64">
        <header className="border-b border-border bg-card">
          <div className="px-4 py-5 sm:px-6 lg:px-8">
            <p className="text-sm font-semibold text-muted">{subtitle}</p>
            <h1 className="mt-1 text-2xl font-bold text-foreground">{title}</h1>
          </div>
        </header>
        <main className="px-4 py-6 sm:px-6 lg:px-8">{children}</main>
      </div>
    </div>
  );
}
