import type { Metadata } from 'next';
import Image from 'next/image';
import { TbBrandTelegram, TbClock, TbMail, TbMapPin, TbPhone } from 'react-icons/tb';

import { companyLegalDetails } from '@/lib/company-details';
import { siteContacts } from '@/lib/site-contacts';
import { createPublicMetadata, PUBLIC_PAGE_SEO } from '@/lib/seo';

import { ContactForm } from './contact-form';

export const metadata: Metadata = createPublicMetadata(PUBLIC_PAGE_SEO.contacts);

const contacts = [
  {
    label: 'ТЕЛЕФОН',
    value: siteContacts.phone.display,
    description: 'Для оперативного зв’язку з менеджером.',
    icon: TbPhone,
    href: siteContacts.phone.href,
    ariaLabel: `Зателефонувати за номером ${siteContacts.phone.display}`
  },
  {
    label: 'EMAIL',
    value: siteContacts.email.display,
    description: 'Для списків позицій, документів, B2B-звернень та загальних питань.',
    icon: TbMail,
    href: siteContacts.email.href,
    ariaLabel: `Написати на email ${siteContacts.email.display}`
  },
  {
    label: 'ОФІС, СКЛАД, БАЗА, ПУНКТ ОБСЛУГОВУВАННЯ ТА ВИДАЧІ',
    value: siteContacts.address.display,
    description: 'Відвідування можливе без попереднього погодження у робочі години.',
    icon: TbMapPin,
    href: siteContacts.address.href,
    external: true,
    ariaLabel: `Відкрити адресу ${siteContacts.address.display} у Google Maps`
  },
  {
    label: 'TELEGRAM',
    value: siteContacts.telegram.display,
    description: 'Створення заявки після підтвердження номера телефону.',
    icon: TbBrandTelegram,
    href: siteContacts.telegram.href,
    external: true,
    ariaLabel: `Відкрити Telegram ${siteContacts.telegram.display}`
  },
  {
    label: 'ГРАФІК РОБОТИ',
    value: siteContacts.workingHours.display,
    description: 'Звернення поза графіком опрацьовуються наступного робочого дня.',
    icon: TbClock,
    ariaLabel: undefined
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

              <address className="mt-8 not-italic">
                <div className="divide-y divide-public-border">
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
                              rel={contact.external ? 'noopener noreferrer' : undefined}
                              aria-label={contact.ariaLabel}
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
              </address>
            </div>

            <ContactForm />
          </div>
        </div>
      </section>

      <section
        className="border-t border-public-border bg-public-section py-16 sm:py-20 lg:py-24"
        aria-labelledby="legal-information-title"
      >
        <div className="kp-container">
          <div className="max-w-3xl">
            <p className="text-xs font-bold uppercase tracking-[0.22em] text-accent sm:text-sm">
              ОПЕРАТОР СЕРВІСУ
            </p>
            <h2
              id="legal-information-title"
              className="mt-3 text-3xl font-bold leading-tight text-public-primary sm:text-4xl"
            >
              Юридична інформація
            </h2>
            <p className="mt-4 text-base leading-7 text-public-secondary sm:text-lg sm:leading-8">
              Відомості про юридичну особу, яка керує сервісом Kairos Parts та є володільцем персональних даних.
            </p>
            <div aria-hidden="true" className="mt-6 h-px w-16 bg-accent" />
          </div>

          <div className="mt-10 overflow-hidden rounded-[22px] border border-public-border bg-public-card shadow-panel">
            <div className="border-b border-public-border bg-primary px-6 py-7 text-white sm:px-8 lg:px-10">
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-accent">Назва юридичної особи</p>
              <p className="mt-3 break-words text-2xl font-bold leading-tight sm:text-3xl">
                {companyLegalDetails.shortName}
              </p>
            </div>

            <dl className="grid min-w-0 gap-px bg-public-border sm:grid-cols-2">
              <LegalDetail label="Повна назва" value={companyLegalDetails.fullName} />
              <LegalDetail label="Код ЄДРПОУ" value={companyLegalDetails.edrpou} />
              <LegalDetail
                label="Юридична адреса та адреса для листування"
                value={companyLegalDetails.legalAddress.display}
              />
              <LegalDetail
                label="Телефон у реквізитах"
                value={companyLegalDetails.legalPhone.display}
                href={companyLegalDetails.legalPhone.href}
              />
              <LegalDetail
                label="Email для офіційних звернень"
                value={companyLegalDetails.email.display}
                href={companyLegalDetails.email.href}
              />
              <LegalDetail
                label="Володілець персональних даних"
                value={companyLegalDetails.personalDataController}
              />
              <LegalDetail
                label="Запити щодо персональних даних"
                value={companyLegalDetails.email.display}
                href={companyLegalDetails.email.href}
              />
            </dl>

            <div className="border-t border-public-border px-6 py-7 sm:px-8 lg:px-10">
              <h3 className="text-lg font-bold text-public-primary">Письмові претензії</h3>
              <p className="mt-3 max-w-5xl text-sm leading-7 text-public-muted sm:text-base">
                Письмові претензії приймаються поштою за юридичною адресою {companyLegalDetails.shortName}:{' '}
                {companyLegalDetails.legalAddress.display}.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

function LegalDetail({ label, value, href }: { label: string; value: string; href?: string }) {
  return (
    <div className="min-w-0 bg-public-card px-6 py-6 sm:px-8 lg:px-10">
      <dt className="text-xs font-bold uppercase tracking-[0.16em] text-accent">{label}</dt>
      <dd className="mt-2 break-words text-base font-semibold leading-7 text-public-primary">
        {href ? (
          <a
            href={href}
            className="transition hover:text-accent focus-visible:rounded-sm focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
          >
            {value}
          </a>
        ) : (
          value
        )}
      </dd>
    </div>
  );
}
