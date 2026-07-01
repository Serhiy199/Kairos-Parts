import Link from 'next/link';

const steps = [
  'Клієнт залишає заявку.',
  'Менеджер уточнює деталі.',
  'Проводиться підбір запчастин.',
  'За потреби підбираються аналоги.',
  'Формується пропозиція.',
  'Kairos Parts організовує постачання.',
  'Клієнт отримує замовлення.'
];

export default function HowItWorksPage() {
  return (
    <>
      <section className="bg-primary px-4 py-16 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="max-w-3xl">
            <p className="text-sm font-bold uppercase text-accent">Як це працює</p>
            <h1 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">
              Від запиту до постачання через зрозумілий B2B-процес
            </h1>
            <p className="mt-5 text-base leading-7 text-sidebar-text">
              Kairos Parts не змушує клієнта самостійно шукати кожну позицію. Команда приймає заявку,
              уточнює деталі, підбирає рішення й супроводжує постачання.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-background px-4 py-16 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-4xl">
          <div className="relative grid gap-4">
            {steps.map((step, index) => (
              <div key={step} className="grid grid-cols-[48px_1fr] gap-4">
                <div className="relative flex justify-center">
                  <div className="z-10 grid size-11 place-items-center rounded-md bg-primary text-sm font-bold text-accent">
                    {index + 1}
                  </div>
                  {index < steps.length - 1 ? <div className="absolute top-11 h-full w-px bg-border" /> : null}
                </div>
                <div className="rounded-lg border border-border bg-card p-5 shadow-card">
                  <h2 className="text-lg font-bold text-foreground">{step}</h2>
                  <p className="mt-2 text-sm leading-6 text-muted">
                    {index === 0
                      ? 'Заявку можна почати із сайту, списку, фото або звернення до менеджера.'
                      : 'Детальна бізнес-логіка цього етапу буде реалізована після Day 4.'}
                  </p>
                </div>
              </div>
            ))}
          </div>
          <div className="mt-10 rounded-lg border border-border bg-card p-6 text-center shadow-card">
            <h2 className="text-2xl font-bold text-foreground">Почніть із одного запиту</h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm leading-6 text-muted">
              Опишіть потребу у зручному форматі. Менеджер Kairos Parts зв&apos;яжеться для уточнення деталей.
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
    </>
  );
}
