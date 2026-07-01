import Link from 'next/link';

const principles = [
  {
    title: 'Не магазин, а сервіс заявок',
    text: 'Клієнт не шукає товар у кошику. Він залишає потребу, а менеджер Kairos Parts підбирає правильне рішення.'
  },
  {
    title: 'Єдина точка контакту',
    text: 'Замість окремих переговорів з різними постачальниками клієнт працює через один процес і одного відповідального менеджера.'
  },
  {
    title: 'B2B-логіка для техніки',
    text: 'Платформа враховує техніку, документи, статуси, файли та історію заявок, які потрібні бізнес-клієнтам.'
  }
];

const painPoints = [
  'пошук деталей у десятках каналів',
  'ризик замовити несумісну позицію',
  'розрізнені рахунки та постачальники',
  'відсутність прозорого статусу заявки'
];

export default function AboutPage() {
  return (
    <>
      <section className="bg-primary px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase text-accent">Про Kairos Parts</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">
              Сервіс, який бере на себе складність підбору запчастин
            </h1>
            <p className="mt-5 text-base leading-7 text-sidebar-text">
              Kairos Parts — це B2B-платформа для збору й обробки заявок на підбір запчастин для аграрної,
              вантажної, комерційної та спеціальної техніки.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-background px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto grid max-w-7xl gap-8 lg:grid-cols-[1fr_1fr]">
          <div className="rounded-lg border border-border bg-card p-6 shadow-card">
            <p className="text-sm font-bold uppercase text-accent">Проблема</p>
            <h2 className="mt-2 text-3xl font-bold text-foreground">Закупівля запчастин часто розпадається на хаос</h2>
            <div className="mt-6 grid gap-3">
              {painPoints.map((item) => (
                <div key={item} className="rounded-md border border-border bg-surface-muted px-4 py-3 text-sm font-semibold text-foreground">
                  {item}
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-6 shadow-card">
            <p className="text-sm font-bold uppercase text-accent">Рішення</p>
            <h2 className="mt-2 text-3xl font-bold text-foreground">Один запит, один процес, один відповідальний контакт</h2>
            <p className="mt-5 text-sm leading-6 text-muted">
              Kairos Parts допомагає клієнту описати потребу, передати фото чи список позицій, отримати підбір
              і бачити статус без ручного контролю кожного постачальника.
            </p>
            <Link
              href="/request"
              className="mt-6 inline-flex rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-[#DFA600]"
            >
              Створити заявку
            </Link>
          </div>
        </div>
      </section>

      <section className="bg-card px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-2xl">
            <p className="text-sm font-bold uppercase text-accent">Як ми мислимо сервіс</p>
            <h2 className="mt-2 text-3xl font-bold text-foreground">Платформа навколо заявки, а не кошика</h2>
          </div>
          <div className="mt-8 grid gap-4 lg:grid-cols-3">
            {principles.map((principle) => (
              <div key={principle.title} className="rounded-lg border border-border bg-surface-muted p-6">
                <h3 className="text-lg font-bold text-foreground">{principle.title}</h3>
                <p className="mt-3 text-sm leading-6 text-muted">{principle.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
