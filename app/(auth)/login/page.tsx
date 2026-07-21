import { LoginForm } from './login-form';

const errorMessages: Record<string, string> = {
  validation: 'Невірний email, номер телефону або пароль.',
  credentials: 'Невірний email, номер телефону або пароль.',
  'account-invited': 'Невірний email, номер телефону або пароль.',
  'account-disabled': 'Невірний email, номер телефону або пароль.',
  'session-expired': 'Сесію завершено після зміни доступу. Увійдіть повторно.',
  database: 'DATABASE_URL не налаштований.',
  'staff-login': 'Невірний email, номер телефону або пароль.'
};

export default async function LoginPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; registered?: string; next?: string }>;
}) {
  const params = await searchParams;
  const errorMessage = params.error ? errorMessages[params.error] ?? 'Не вдалося увійти.' : null;

  return (
    <div className="min-h-screen bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-md rounded-lg border border-border bg-card p-6 shadow-card">
        <p className="text-sm font-bold uppercase text-accent">Кабінет клієнта</p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">Вхід</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Увійдіть як клієнт, щоб бачити свої заявки, створювати нові та зберігати історію в кабінеті.
        </p>
        {params.registered ? (
          <div className="mt-5 rounded-md border border-success/30 bg-[#E7F6EC] p-3 text-sm font-semibold text-success">
            Реєстрацію завершено. Тепер можна увійти.
          </div>
        ) : null}
        {errorMessage ? (
          <div className="mt-5 rounded-md border border-danger/30 bg-[#FEF3F2] p-3 text-sm font-semibold text-danger">
            {errorMessage}
          </div>
        ) : null}
        <LoginForm nextPath={params.next} />
      </div>
    </div>
  );
}
