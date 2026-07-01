import { SkeletonPage } from '@/components/ui/skeleton-page';

export default function RegisterPage() {
  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8">
      <SkeletonPage title="Реєстрація" description="Реєстрація клієнта буде реалізована після моделі користувачів і ролей." />
    </div>
  );
}
