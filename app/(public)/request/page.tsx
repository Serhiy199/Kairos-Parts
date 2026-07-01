import { SkeletonPage } from '@/components/ui/skeleton-page';

export default function RequestPage() {
  return (
    <div className="px-4 py-10 sm:px-6 lg:px-8">
      <SkeletonPage
        title="Створити заявку"
        description="Форма заявки буде реалізована окремим етапом. Day 1 фіксує маршрут і місце в структурі."
      />
    </div>
  );
}
