import type { Metadata } from 'next';
import { Exo_2, Inter, Oxanium } from 'next/font/google';
import { UkrainianValidation } from '@/components/ui/ukrainian-validation';
import { ToastProvider } from '@/components/ui/toast-provider';
import { PUBLIC_PAGE_SEO, SITE_LOCALE, SITE_NAME } from '@/lib/seo';
import { PUBLIC_SITE_URL } from '@/lib/site-url';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-ui',
  display: 'swap'
});

const oxanium = Oxanium({
  subsets: ['latin', 'latin-ext'],
  variable: '--font-brand',
  display: 'swap'
});

const exo2 = Exo_2({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-display',
  display: 'swap'
});

export const metadata: Metadata = {
  metadataBase: PUBLIC_SITE_URL,
  title: SITE_NAME,
  description: PUBLIC_PAGE_SEO.home.description,
  openGraph: {
    type: 'website',
    locale: SITE_LOCALE,
    siteName: SITE_NAME,
    title: SITE_NAME,
    description: PUBLIC_PAGE_SEO.home.description
  },
  twitter: {
    card: 'summary',
    title: SITE_NAME,
    description: PUBLIC_PAGE_SEO.home.description
  }
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="uk" className={`${inter.variable} ${oxanium.variable} ${exo2.variable}`}>
      <body className="font-ui">
        <UkrainianValidation />
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
