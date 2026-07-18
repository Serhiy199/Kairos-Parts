'use client';

import { type FormEvent, useActionState, useEffect, useRef, useState } from 'react';

import { submitContactMessage, type ContactFormActionState } from './actions';
import {
  CONTACT_MESSAGE_TOPIC_LABELS,
  CONTACT_MESSAGE_TOPICS,
  type ContactMessageField,
  type ContactMessageFieldErrors,
  parseContactMessageFormData
} from '@/lib/contact-messages';

const fieldBaseClassName =
  'public-field h-[52px] w-full rounded-xl px-4 text-base text-public-primary placeholder:text-public-subtle';

const initialState: ContactFormActionState = {
  status: 'idle',
  message: '',
  fieldErrors: {},
  values: {
    name: '',
    company: '',
    phone: '',
    email: '',
    topic: '',
    message: '',
    consent: false
  },
  submissionId: 0
};

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
  const [state, formAction, isPending] = useActionState(submitContactMessage, initialState);
  const [errors, setErrors] = useState<ContactMessageFieldErrors>({});

  useEffect(() => {
    if (state.submissionId === 0) return;

    setErrors(state.fieldErrors);

    if (state.status === 'success') return;

    const firstInvalidField = Object.keys(state.fieldErrors)[0] as ContactMessageField | undefined;
    if (!firstInvalidField) return;

    const field = formRef.current?.elements.namedItem(firstInvalidField);
    if (field instanceof HTMLElement) field.focus();
  }, [state]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const parsed = parseContactMessageFormData(new FormData(event.currentTarget));

    if (parsed.ok || parsed.isHoneypot) {
      setErrors({});
      return;
    }

    event.preventDefault();
    setErrors(parsed.errors);

    const firstInvalidField = Object.keys(parsed.errors)[0] as ContactMessageField | undefined;
    if (!firstInvalidField) return;

    const field = event.currentTarget.elements.namedItem(firstInvalidField);
    if (field instanceof HTMLElement) field.focus();
  }

  function fieldClassName(field: ContactMessageField) {
    return `${fieldBaseClassName} ${errors[field] ? 'border-danger/60' : ''}`;
  }

  return (
    <div className="bg-public-card p-6 sm:p-8 lg:p-10 xl:p-12">
      <h2 className="text-2xl font-bold text-public-primary sm:text-3xl">Напишіть нам</h2>
      <p className="mt-3 max-w-2xl text-base leading-7 text-public-muted">
        Опишіть питання або залиште контактні дані. Менеджер зв’яжеться з вами для уточнення.
      </p>

      <form key={state.submissionId} ref={formRef} action={formAction} className="mt-8" noValidate onSubmit={handleSubmit}>
        <div aria-hidden="true" className="absolute left-[-10000px] top-auto h-px w-px overflow-hidden">
          <label htmlFor="contact-website">Вебсайт</label>
          <input id="contact-website" name="website" type="text" tabIndex={-1} autoComplete="off" />
        </div>

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
              minLength={2}
              maxLength={100}
              defaultValue={state.values.name}
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
              maxLength={150}
              defaultValue={state.values.company}
              aria-invalid={Boolean(errors.company)}
              aria-describedby={errors.company ? 'contact-company-error' : undefined}
              className={fieldClassName('company')}
            />
            <FieldError id="contact-company-error" message={errors.company} />
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
              maxLength={50}
              defaultValue={state.values.phone}
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
              maxLength={254}
              defaultValue={state.values.email}
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
          <label htmlFor="contact-topic" className="mb-2 block text-sm font-semibold text-public-primary">
            Тема звернення <span className="text-accent">*</span>
          </label>
          <select
            id="contact-topic"
            name="topic"
            required
            defaultValue={state.values.topic}
            aria-invalid={Boolean(errors.topic)}
            aria-describedby={errors.topic ? 'contact-topic-error' : undefined}
            className={fieldClassName('topic')}
          >
            <option value="" disabled>
              Оберіть тему
            </option>
            {CONTACT_MESSAGE_TOPICS.map((topic) => (
              <option key={topic} value={topic}>
                {CONTACT_MESSAGE_TOPIC_LABELS[topic]}
              </option>
            ))}
          </select>
          <FieldError id="contact-topic-error" message={errors.topic} />
        </div>

        <div className="mt-5">
          <label htmlFor="contact-message" className="mb-2 block text-sm font-semibold text-public-primary">
            Повідомлення <span className="text-accent">*</span>
          </label>
          <textarea
            id="contact-message"
            name="message"
            required
            minLength={10}
            maxLength={5000}
            defaultValue={state.values.message}
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
              defaultChecked={state.values.consent}
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
          disabled={isPending}
          className="mt-7 inline-flex w-full items-center justify-center rounded-lg bg-accent px-6 py-3.5 text-sm font-bold text-primary shadow-panel transition hover:bg-accent-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent disabled:cursor-not-allowed disabled:opacity-65 sm:w-auto"
        >
          {isPending ? 'Надсилаємо…' : 'Надіслати повідомлення'}
        </button>

        <div aria-live="polite">
          {state.message ? (
            <p
              role={state.status === 'error' ? 'alert' : 'status'}
              className={`mt-4 max-w-2xl text-sm leading-6 ${
                state.status === 'success' ? 'text-public-success' : 'text-public-danger'
              }`}
            >
              {state.message}
            </p>
          ) : null}
        </div>
      </form>
    </div>
  );
}
