import { RegisterForm } from './register-form';

const errorMessages: Record<string, string> = {
  phone: 'Введіть коректний номер телефону у форматі +380XXXXXXXXX.',
  validation: 'Перевірте обовʼязкові поля. Пароль має містити щонайменше 8 символів і збігатися з підтвердженням.',
  exists: 'Користувач з таким email або телефоном уже існує.',
  database: 'DATABASE_URL не налаштований.'
};

export default async function RegisterPage({
  searchParams
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const params = await searchParams;
  const errorMessage = params.error ? errorMessages[params.error] ?? 'Не вдалося зареєструвати клієнта.' : null;

  return (
    <div className="min-h-screen bg-background px-4 py-12 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-2xl rounded-lg border border-border bg-card p-6 shadow-card">
        <p className="text-sm font-bold uppercase text-accent">Новий клієнт</p>
        <h1 className="mt-2 text-3xl font-bold text-foreground">Реєстрація</h1>
        <p className="mt-3 text-sm leading-6 text-muted">
          Створіть CLIENT-акаунт для перегляду історії заявок, документів і швидкого створення нових запитів.
        </p>
        {errorMessage ? (
          <div className="mt-5 rounded-md border border-danger/30 bg-[#FEF3F2] p-3 text-sm font-semibold text-danger">
            {errorMessage}
          </div>
        ) : null}
        <RegisterForm nextPath={params.next} />
      </div>
    </div>
  );
}
