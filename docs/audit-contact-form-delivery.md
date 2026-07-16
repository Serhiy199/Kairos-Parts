# Audit: contact form delivery flow

## Scope

Audited the public contacts page and the contact form flow after removing the duplicate final CTA block from `/contacts`.

Files reviewed:

- `app/(public)/contacts/page.tsx`
- `app/(public)/contacts/contact-form.tsx`
- `app/api`
- `lib`
- `prisma/schema.prisma`

## Contacts page CTA

The `/contacts` page had two request-oriented CTAs:

1. Hero CTA at the top of the page.
2. A duplicate dark CTA block at the bottom of the page.

The bottom CTA block was removed only from `/contacts`.

The hero CTA remains available:

- `Створити заявку` -> `/request`
- `Написати в Telegram` -> `https://t.me/kairos_parts_bot`

Analogous CTA blocks on `/about`, `/how-it-works`, and `/advantages` were not changed.

## Current contact form behavior

The contact form is a client component implemented in:

`app/(public)/contacts/contact-form.tsx`

Current fields:

- name;
- company;
- phone;
- email;
- subject;
- message;
- consent checkbox.

Current validation:

- name is required;
- phone or email is required;
- email format is checked if email is entered;
- subject is required;
- message is required;
- consent is required.

The form prevents browser-native submission with `event.preventDefault()`.

If validation passes, the form does not send data to a backend endpoint. Instead, it shows this Ukrainian error message:

`Зараз ця форма не може доставити повідомлення. Створіть структуровану заявку або напишіть у Telegram.`

This is correct for the current implementation because there is no delivery backend connected to the form.

## Delivery destination audit

### CRM

No CRM destination exists for this contact form.

There is no `ContactInquiry`, `ContactMessage`, or equivalent Prisma model in `prisma/schema.prisma`.

There is no admin page or CRM queue for general contact messages.

### Database

The form does not write to the database.

No Prisma mutation is called from the contact form.

### Email

No email delivery is connected to the contact form.

No contact-form-specific Resend, SMTP, nodemailer, or email provider flow was found.

### Telegram

The contact form does not send messages to Telegram.

Telegram is implemented for bot/webhook flows and invoice/request notifications, but the `/contacts` form does not call those flows.

### API / server action

No `/api/contact` endpoint or contact server action was found.

The form currently has no server-side validation layer because it never submits to the server.

## UX assessment

The current UX is honest: after valid input, the user is told the form cannot deliver the message and is directed to a structured request or Telegram.

This is preferable to showing a fake success state.

However, it means the contact form is not a real communication channel yet. For production, the page should either:

1. connect the form to a real delivery flow; or
2. remove/replace the form with direct request and Telegram actions.

## Recommended next implementation options

### Option A: lightweight email contact form

Add:

- server action or `POST /api/contact`;
- server-side validation with Zod;
- email provider integration;
- success/error states;
- basic anti-spam guard.

Best when contact messages should go directly to an inbox.

### Option B: CRM contact inbox

Add:

- Prisma model, for example `ContactMessage`;
- admin CRM list/detail page;
- optional assignment/status fields;
- optional email/Telegram notification for managers.

Best when messages must be tracked in CRM.

### Option C: remove standalone contact form

Keep only:

- `/request` CTA for structured requests;
- Telegram bot link;
- phone/email direct links.

Best if Kairos Parts wants all operational communication to start as a request.

## Not changed

- No Prisma schema changes.
- No migrations.
- No email provider added.
- No Telegram logic changed.
- No CRM module added.
- No business logic changed.

## Verification checklist

Expected after this cleanup:

- `/contacts` no longer shows the duplicate bottom CTA block.
- The contacts hero still has primary actions.
- Contact information remains visible.
- The contact form remains visible and validates fields.
- A valid form submission shows the existing delivery-unavailable message.
- No hidden fake success state is introduced.

