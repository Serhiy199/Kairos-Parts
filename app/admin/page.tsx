import { SkeletonPage } from '@/components/ui/skeleton-page';

export default function AdminDashboardPage() {
  return (
    <SkeletonPage
      title="CRM панель"
      description="Майбутня CRM-панель менеджера для контролю заявок, клієнтів і довідників."
      items={['Нові заявки', 'В роботі', 'Очікують клієнта', 'Завершено']}
    />
  );
}
