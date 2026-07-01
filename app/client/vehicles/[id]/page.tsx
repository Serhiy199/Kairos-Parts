import { SkeletonPage } from '@/components/ui/skeleton-page';

export default async function ClientVehicleDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <SkeletonPage title={`Техніка ${id}`} description="Деталі одиниці техніки будуть реалізовані після Day 2 моделі." />
  );
}
