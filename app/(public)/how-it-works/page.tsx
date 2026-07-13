import Link from 'next/link';

const steps = [
  {
    title: 'Створіть особистий кабінет',
    text: 'Додайте реквізити компанії та сформуйте парк своєї техніки. Це дозволить автоматично накопичувати історію замовлень, запчастин і документів для кожної машини.'
  },
  {
    title: 'Створіть заявку',
    text: 'Оберіть техніку зі свого парку або оформіть разову заявку без привʼязки до техніки. Додайте артикул, список, фото або опис потреби.'
  },
  {
    title: 'Менеджер опрацьовує заявку',
    text: 'Уточнюємо деталі, перевіряємо сумісність та аналізуємо доступні варіанти.'
  },
  {
    title: 'Підбираємо рішення',
    text: 'Підбираємо оригінальні запчастини та аналоги серед перевірених постачальників і формуємо комерційну пропозицію.'
  },
  {
    title: 'Узгодження та оплата',
    text: 'Погоджуємо склад замовлення, терміни, спосіб доставки та формуємо рахунок.'
  },
  {
    title: 'Комплектація та доставка',
    text: 'Консолідуємо замовлення та організовуємо відправку у погоджений термін.'
  },
  {
    title: 'Історія оновлюється автоматично',
    text: 'Якщо замовлення оформлено для техніки з вашого парку, платформа автоматично збереже історію запчастин, каталожні номери, рахунки та документи.'
  }
];

export default function HowItWorksPage() {
  return (
    <>
      <section className="bg-primary py-16 text-white">
        <div className="kp-container">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase text-accent">Як це працює</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">
              Повний шлях заявки від кабінету до історії техніки
            </h1>
            <p className="mt-5 text-base leading-7 text-sidebar-text">
              Kairos Parts не змушує клієнта самостійно шукати кожну позицію. Команда приймає заявку,
              уточнює деталі, підбирає рішення, супроводжує постачання й зберігає історію для повторних замовлень.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-background py-16">
        <div className="kp-container">
          <div className="grid gap-4 lg:grid-cols-2">
            {steps.map((step, index) => (
              <article key={step.title} className="rounded-lg border border-border bg-card p-6 shadow-card">
                <div className="flex items-start gap-4">
                  <span className="grid size-11 shrink-0 place-items-center rounded-md bg-primary font-display text-sm font-bold text-accent">
                    {index + 1}
                  </span>
                  <div>
                    <p className="text-xs font-bold uppercase tracking-[0.16em] text-accent">Крок {index + 1}</p>
                    <h2 className="mt-2 text-xl font-bold text-foreground">{step.title}</h2>
                    <p className="mt-3 text-sm leading-6 text-muted">{step.text}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
          <div className="mt-10 rounded-lg border border-border bg-card p-6 text-center shadow-card">
            <h2 className="text-2xl font-bold text-foreground">Почніть із одного запиту</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted">
              Опишіть потребу у зручному форматі. Менеджер Kairos Parts звʼяжеться для уточнення деталей.
            </p>
            <Link
              href="/request"
              className="mt-6 inline-flex rounded-md bg-accent px-5 py-3 text-sm font-bold text-foreground transition hover:bg-accent-hover"
            >
              Створити заявку
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
