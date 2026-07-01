import { SkeletonPage } from '@/components/ui/skeleton-page';

export default async function ClientRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <SkeletonPage
      title={`Заявка ${id}`}
      description="Деталі заявки клієнта, timeline статусів і файли будуть реалізовані пізніше."
    />
  );
}
