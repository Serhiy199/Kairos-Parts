import { SkeletonPage } from '@/components/ui/skeleton-page';

export default async function AdminRequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  return (
    <SkeletonPage
      title={`CRM заявка ${id}`}
      description="Детальна CRM-картка заявки, OCR-підказки, файли та статуси будуть реалізовані окремо."
    />
  );
}
