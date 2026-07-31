import type { Metadata } from 'next';

import { NOINDEX_METADATA } from '@/lib/seo';

export const metadata: Metadata = NOINDEX_METADATA;

export default function StaffAuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
