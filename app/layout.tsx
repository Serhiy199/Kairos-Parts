import type { Metadata } from 'next';
import { Exo_2, Inter, Orbitron } from 'next/font/google';
import './globals.css';

const inter = Inter({
  subsets: ['latin', 'cyrillic'],
  variable: '--font-ui',
  display: 'swap'
});

const orbitron = Orbitron({
  subsets: ['latin'],
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
    <html lang="uk" className={`${inter.variable} ${orbitron.variable} ${exo2.variable}`}>
      <body className="font-ui">{children}</body>
    </html>
  );
}
