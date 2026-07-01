import { SkeletonPage } from '@/components/ui/skeleton-page';

export default function ClientRequestsPage() {
  return (
    <SkeletonPage
      title="Мої заявки"
      description="Список заявок клієнта з фільтрами і статусами буде реалізований після API та моделі даних."
    />
  );
}
