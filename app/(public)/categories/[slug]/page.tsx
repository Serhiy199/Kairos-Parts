import { SkeletonPage } from '@/components/ui/skeleton-page';

export default async function CategoryDetailPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;

  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8">
      <SkeletonPage
        title={`Категорія: ${slug}`}
        description="Детальна сторінка категорії буде наповнена після моделювання категорій і виробників."
      />
    </div>
  );
}
