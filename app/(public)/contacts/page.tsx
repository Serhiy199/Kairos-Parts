import Link from 'next/link';

const contacts = [
  { title: 'Телефон', value: '+38 (000) 000 00 00', note: 'Placeholder для майбутнього робочого номера' },
  { title: 'Email', value: 'hello@kairos-parts.example', note: 'Placeholder для вхідних B2B-звернень' },
  { title: 'Telegram', value: '@kairos_parts_bot', note: 'Бот приймає заявки після підтвердження номера телефону' },
  { title: 'Графік роботи', value: 'Пн-Пт, 09:00-18:00', note: 'Placeholder для операційного графіка' }
];

export default function ContactsPage() {
  return (
    <>
      <section className="bg-primary px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase text-accent">Контакти</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">Залиште заявку, і менеджер зв&apos;яжеться з вами</h1>
            <p className="mt-5 text-base leading-7 text-sidebar-text">
              Для Day 4 контакти показані як placeholders. Реальні канали та інтеграції будуть підключені
              після погодження операційних налаштувань.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-public-page px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {contacts.map((contact) => (
          <div key={contact.title} className="public-card p-6">
              <p className="text-sm font-bold uppercase text-accent">{contact.title}</p>
            <h2 className="mt-3 text-xl font-bold text-public-primary">{contact.value}</h2>
            <p className="mt-3 text-sm leading-6 text-public-muted">{contact.note}</p>
            </div>
          ))}
        </div>
        <div className="public-card mx-auto mt-8 max-w-7xl p-6">
          <div className="grid gap-5 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <h2 className="text-2xl font-bold text-public-primary">Найшвидший старт — заявка на підбір</h2>
              <p className="mt-3 text-sm leading-6 text-public-muted">
                Опишіть техніку, деталь або прикріпіть список позицій на наступному етапі реалізації форми.
              </p>
            </div>
            <Link
              href="/request"
              className="rounded-md bg-accent px-5 py-3 text-center text-sm font-bold text-primary transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Створити заявку
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
