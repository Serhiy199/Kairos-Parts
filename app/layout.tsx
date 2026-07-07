import type { Metadata } from 'next';
import { Exo_2, Inter, Oxanium } from 'next/font/google';
import { UkrainianValidation } from '@/components/ui/ukrainian-validation';
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
  title: 'Kairos Parts',
  description: 'B2B platform for spare parts requests and manager CRM workflows.'
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
        {children}
      </body>
    </html>
  );
}
