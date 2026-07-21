import type { Metadata } from 'next';
import Image from 'next/image';
import { TbBrandTelegram, TbClock, TbMail, TbPhone } from 'react-icons/tb';


import { ContactForm } from './contact-form';

export const metadata: Metadata = {
  title: 'Контакти Kairos Parts — зв’язок із командою',
  description:
    'Зв’яжіться з Kairos Parts щодо підбору запчастин, комерційної пропозиції, співпраці або статусу заявки.'
};

const telegramBotUrl = 'https://t.me/kairos_parts_bot';

const contacts = [
  {
    label: 'ТЕЛЕФОН',
    value: '+38 (000) 000 00 00',
    description: 'Для оперативного зв’язку з менеджером.',
    icon: TbPhone
  },
  {
    label: 'EMAIL',
    value: 'hello@kairos-parts.example',
    description: 'Для списків позицій, документів і B2B-звернень.',
    icon: TbMail,
    href: 'mailto:hello@kairos-parts.example'
  },
  {
    label: 'TELEGRAM',
    value: '@kairos_parts_bot',
    description: 'Створення заявки після підтвердження номера телефону.',
    icon: TbBrandTelegram,
    href: telegramBotUrl,
    external: true
  },
  {
    label: 'ГРАФІК РОБОТИ',
    value: 'Пн-Пт, 09:00-18:00',
    description: 'Звернення поза графіком опрацьовуються наступного робочого дня.',
    icon: TbClock
  }
];

export default function ContactsPage() {
  return (
    <>
      <section className="relative isolate flex min-h-[620px] overflow-hidden bg-primary text-white sm:min-h-[640px] lg:min-h-[680px]">
        <Image
          src="/images/contacts/hero-bg.png"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[70%_center] sm:object-[66%_center] lg:object-center"
        />
        <div aria-hidden="true" className="absolute inset-0 bg-primary/25" />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(90deg,rgba(5,7,10,0.95)_0%,rgba(5,7,10,0.88)_62%,rgba(5,7,10,0.68)_100%)] md:bg-[linear-gradient(90deg,rgba(5,7,10,0.94)_0%,rgba(5,7,10,0.82)_44%,rgba(5,7,10,0.42)_72%,rgba(5,7,10,0.18)_100%)]"
        />
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[linear-gradient(180deg,rgba(5,7,10,0.08)_55%,rgba(5,7,10,0.88)_100%)]"
        />

        <div className="kp-container relative z-10 flex w-full items-center py-20 sm:py-24 lg:py-28">
          <div className="max-w-[780px]">
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-accent sm:text-sm">КОНТАКТИ</p>
            <h1 className="mt-4 text-4xl font-bold leading-[1.08] text-white sm:text-5xl lg:text-6xl">
              Зв’яжіться з командою
              <span className="mt-1 block text-accent">Kairos Parts</span>
            </h1>
            <p className="mt-6 max-w-3xl text-lg font-semibold leading-8 text-white sm:text-xl sm:leading-9">
              Надішліть запит у зручний спосіб — менеджер уточнить деталі та допоможе сформувати заявку.
            </p>
            <p className="mt-4 max-w-2xl text-base leading-7 text-white/75 sm:text-lg sm:leading-8">
              Ми працюємо із запитами на підбір запчастин, документами, списками позицій, фото деталей та
              зверненнями щодо співпраці.
            </p>
          </div>
        </div>
      </section>

      <section className="bg-public-page py-16 sm:py-20 lg:py-24">
        <div className="kp-container">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent sm:text-sm">
              ЗВ’ЯЖІТЬСЯ З НАМИ
            </p>
            <h2 className="mt-3 text-3xl font-bold leading-tight text-public-primary sm:text-4xl">
              Оберіть зручний спосіб зв’язку
            </h2>
            <p className="mt-4 text-base leading-7 text-public-secondary sm:text-lg sm:leading-8">
              Для підбору запчастин краще створити структуровану заявку. Для загальних питань, партнерства
              або уточнення статусу звернення скористайтеся контактною формою.
            </p>
            <div aria-hidden="true" className="mt-6 h-px w-16 bg-accent" />
          </div>

          <div className="mt-10 overflow-hidden rounded-[22px] border border-public-border bg-public-card shadow-panel lg:grid lg:grid-cols-[minmax(0,0.37fr)_minmax(0,0.63fr)]">
            <div className="border-b border-public-border bg-public-section p-6 sm:p-8 lg:border-b-0 lg:border-r lg:p-10 xl:p-12">
              <h2 className="text-2xl font-bold text-public-primary sm:text-3xl">Контактна інформація</h2>
              <p className="mt-3 text-base leading-7 text-public-muted">
                Оберіть канал залежно від типу звернення.
              </p>

              <div className="mt-8 divide-y divide-public-border">
                {contacts.map((contact) => {
                  const Icon = contact.icon;
                  const valueClassName =
                    'mt-1 inline-block text-lg font-bold leading-7 text-public-primary transition sm:text-xl';

                  return (
                    <div key={contact.label} className="flex gap-4 py-6 first:pt-0 last:pb-0">
                      <Icon aria-hidden="true" className="mt-1 h-8 w-8 shrink-0 text-accent" />
                      <div className="min-w-0">
                        <p className="text-xs font-bold uppercase tracking-[0.18em] text-accent">
                          {contact.label}
                        </p>
                        {contact.href ? (
                          <a
                            href={contact.href}
                            target={contact.external ? '_blank' : undefined}
                            rel={contact.external ? 'noreferrer' : undefined}
                            className={`${valueClassName} break-words hover:text-accent focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent`}
                          >
                            {contact.value}
                          </a>
                        ) : (
                          <p className={`${valueClassName} break-words`}>{contact.value}</p>
                        )}
                        <p className="mt-2 text-sm leading-6 text-public-muted">{contact.description}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <ContactForm />
          </div>
        </div>
      </section>
    </>
  );
}
