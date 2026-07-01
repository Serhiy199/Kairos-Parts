import { SkeletonPage } from '@/components/ui/skeleton-page';

export default function CategoriesPage() {
  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8">
      <SkeletonPage
        title="Категорії техніки"
        description="Запланована структура категорій, підкатегорій і виробників для публічної частини."
        items={['Аграрна техніка', 'Вантажна техніка', 'Комерційна техніка', 'Спеціальна техніка']}
      />
    </div>
  );
}
