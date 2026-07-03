import { StaffLoginForm } from './staff-login-form';

const errorMessages: Record<string, string> = {
  validation: 'Вкажіть email і пароль.',
  credentials: 'Email або пароль неправильні, або користувач не має доступу до CRM.',
  'client-login': 'Клієнтський акаунт не має доступу до CRM. Використовуйте кабінет клієнта.'
};

export default async function StaffLoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const errorMessage = params.error ? errorMessages[params.error] ?? 'Не вдалося увійти до CRM.' : null;

  return (
    <div className="min-h-screen bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-6 shadow-card">
        <p className="text-sm font-bold uppercase text-accent">CRM Kairos Parts</p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">Службовий вхід</h1>
        <p className="mt-3 text-sm leading-6 text-muted">Для менеджерів та адміністраторів Kairos Parts.</p>
        {errorMessage ? (
          <div className="mt-5 rounded-md border border-danger/30 bg-[#FEF3F2] p-3 text-sm font-semibold text-danger">
            {errorMessage}
          </div>
        ) : null}
        <StaffLoginForm nextPath={params.next} />
      </div>
    </div>
  );
}
