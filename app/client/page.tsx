import { SkeletonPage } from '@/components/ui/skeleton-page';

export default function ClientDashboardPage() {
  return (
    <SkeletonPage
      title="Панель керування клієнта"
      description="Майбутній dashboard з останніми заявками, статусами, технікою та документами."
      items={['Останні заявки', 'Парк техніки', 'Документи', 'Повторна заявка']}
    />
  );
}
