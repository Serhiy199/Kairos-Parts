import { SkeletonPage } from '@/components/ui/skeleton-page';

export default function LoginPage() {
  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8">
      <SkeletonPage title="Вхід" description="Auth.js flow буде реалізований на окремому етапі." />
    </div>
  );
}
