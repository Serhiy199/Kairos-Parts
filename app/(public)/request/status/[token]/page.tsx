import { SkeletonPage } from '@/components/ui/skeleton-page';

export default async function RequestStatusPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8">
      <SkeletonPage
        title="Статус заявки"
        description={`Публічний статус за унікальним token буде доступний після реалізації доменної моделі. Token: ${token}`}
      />
    </div>
  );
}
