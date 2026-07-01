import { SkeletonPage } from '@/components/ui/skeleton-page';

export default function ForgotPasswordPage() {
  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8">
      <SkeletonPage title="Відновлення пароля" description="Password reset flow не входить у Day 1 реалізацію." />
    </div>
  );
}
