'use client';

import { type FormEvent, useRef, useState } from 'react';

type FieldName = 'name' | 'phone' | 'email' | 'subject' | 'message' | 'consent';
type FieldErrors = Partial<Record<FieldName, string>>;

const fieldBaseClassName =
  'public-field h-[52px] w-full rounded-xl px-4 text-base text-public-primary placeholder:text-public-subtle';

const subjects = [
  'Підбір запчастин',
  'Комерційна пропозиція',
  'Питання щодо заявки',
  'Співпраця',
  'Інше'
];

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;

  return (
    <p id={id} className="mt-2 text-sm leading-5 text-public-danger">
      {message}
    </p>
  );
}

export function ContactForm() {
  const formRef = useRef<HTMLFormElement>(null);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [submissionError, setSubmissionError] = useState('');

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmissionError('');

    const form = event.currentTarget;
    const formData = new FormData(form);
    const values = {
      name: String(formData.get('name') ?? '').trim(),
      phone: String(formData.get('phone') ?? '').trim(),
      email: String(formData.get('email') ?? '').trim(),
      subject: String(formData.get('subject') ?? '').trim(),
      message: String(formData.get('message') ?? '').trim(),
      consent: formData.get('consent') === 'on'
    };
    const nextErrors: FieldErrors = {};

    if (!values.name) nextErrors.name = 'Вкажіть ім’я.';
    if (!values.phone && !values.email) {
      nextErrors.phone = 'Вкажіть телефон або email.';
      nextErrors.email = 'Вкажіть email або телефон.';
    }
    if (values.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
      nextErrors.email = 'Вкажіть коректну email-адресу.';
    }
    if (!values.subject) nextErrors.subject = 'Оберіть тему звернення.';
    if (!values.message) nextErrors.message = 'Опишіть ваше питання.';
    if (!values.consent) nextErrors.consent = 'Потрібна згода на обробку персональних даних.';

    setErrors(nextErrors);

    const firstInvalidField = Object.keys(nextErrors)[0] as FieldName | undefined;
    if (firstInvalidField) {
      const field = form.elements.namedItem(firstInvalidField);
      if (field instanceof HTMLElement) field.focus();
      return;
    }

    setSubmissionError(
      'Зараз ця форма не може доставити повідомлення. Створіть структуровану заявку або напишіть у Telegram.'
    );
  }

  function fieldClassName(field: FieldName) {
    return `${fieldBaseClassName} ${errors[field] ? 'border-danger/60' : ''}`;
  }

  return (
    <div className="bg-public-card p-6 sm:p-8 lg:p-10 xl:p-12">
      <h2 className="text-2xl font-bold text-public-primary sm:text-3xl">Напишіть нам</h2>
      <p className="mt-3 max-w-2xl text-base leading-7 text-public-muted">
        Опишіть питання або залиште контактні дані. Менеджер зв’яжеться з вами для уточнення.
      </p>

      <form ref={formRef} className="mt-8" noValidate onSubmit={handleSubmit}>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="contact-name" className="mb-2 block text-sm font-semibold text-public-primary">
              Ім’я <span className="text-accent">*</span>
            </label>
            <input
              id="contact-name"
              name="name"
              type="text"
              autoComplete="name"
              required
              aria-invalid={Boolean(errors.name)}
              aria-describedby={errors.name ? 'contact-name-error' : undefined}
              className={fieldClassName('name')}
            />
            <FieldError id="contact-name-error" message={errors.name} />
          </div>

          <div>
            <label htmlFor="contact-company" className="mb-2 block text-sm font-semibold text-public-primary">
              Компанія
            </label>
            <input
              id="contact-company"
              name="company"
              type="text"
              autoComplete="organization"
              className={fieldBaseClassName}
            />
          </div>

          <div>
            <label htmlFor="contact-phone" className="mb-2 block text-sm font-semibold text-public-primary">
              Телефон
            </label>
            <input
              id="contact-phone"
              name="phone"
              type="tel"
              inputMode="tel"
              autoComplete="tel"
              aria-invalid={Boolean(errors.phone)}
              aria-describedby={errors.phone ? 'contact-phone-error' : 'contact-details-hint'}
              className={fieldClassName('phone')}
            />
            <FieldError id="contact-phone-error" message={errors.phone} />
          </div>

          <div>
            <label htmlFor="contact-email" className="mb-2 block text-sm font-semibold text-public-primary">
              Email
            </label>
            <input
              id="contact-email"
              name="email"
              type="email"
              autoComplete="email"
              aria-invalid={Boolean(errors.email)}
              aria-describedby={errors.email ? 'contact-email-error' : 'contact-details-hint'}
              className={fieldClassName('email')}
            />
            <FieldError id="contact-email-error" message={errors.email} />
          </div>
        </div>

        <p id="contact-details-hint" className="mt-3 text-sm leading-5 text-public-subtle">
          Вкажіть хоча б один спосіб зв’язку: телефон або email.
        </p>

        <div className="mt-5">
          <label htmlFor="contact-subject" className="mb-2 block text-sm font-semibold text-public-primary">
            Тема звернення <span className="text-accent">*</span>
          </label>
          <select
            id="contact-subject"
            name="subject"
            required
            defaultValue=""
            aria-invalid={Boolean(errors.subject)}
            aria-describedby={errors.subject ? 'contact-subject-error' : undefined}
            className={fieldClassName('subject')}
          >
            <option value="" disabled>
              Оберіть тему
            </option>
            {subjects.map((subject) => (
              <option key={subject} value={subject}>
                {subject}
              </option>
            ))}
          </select>
          <FieldError id="contact-subject-error" message={errors.subject} />
        </div>

        <div className="mt-5">
          <label htmlFor="contact-message" className="mb-2 block text-sm font-semibold text-public-primary">
            Повідомлення <span className="text-accent">*</span>
          </label>
          <textarea
            id="contact-message"
            name="message"
            required
            rows={6}
            aria-invalid={Boolean(errors.message)}
            aria-describedby={errors.message ? 'contact-message-error' : undefined}
            className={`${fieldClassName('message')} min-h-40 resize-y py-3`}
          />
          <FieldError id="contact-message-error" message={errors.message} />
        </div>

        <div className="mt-6">
          <div className="flex items-start gap-3">
            <input
              id="contact-consent"
              name="consent"
              type="checkbox"
              required
              aria-invalid={Boolean(errors.consent)}
              aria-describedby={errors.consent ? 'contact-consent-error' : undefined}
              className="mt-1 h-5 w-5 shrink-0 rounded border-public-border bg-public-section accent-[var(--accent)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            />
            <label htmlFor="contact-consent" className="text-sm leading-6 text-public-secondary">
              Я погоджуюся на обробку персональних даних для отримання відповіді на звернення.
            </label>
          </div>
          <FieldError id="contact-consent-error" message={errors.consent} />
        </div>

        <button
          type="submit"
          className="mt-7 inline-flex w-full items-center justify-center rounded-lg bg-accent px-6 py-3.5 text-sm font-bold text-primary shadow-panel transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent sm:w-auto"
        >
          Надіслати повідомлення
        </button>

        <div aria-live="polite">
          {submissionError ? (
            <p role="alert" className="mt-4 max-w-2xl text-sm leading-6 text-public-danger">
              {submissionError}
            </p>
          ) : null}
        </div>
      </form>
    </div>
  );
}
