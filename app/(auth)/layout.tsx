import { PublicLayout } from '@/components/layout/public-layout';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <PublicLayout>{children}</PublicLayout>;
}
