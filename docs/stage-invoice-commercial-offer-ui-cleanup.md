# Kairos Parts — Fix 1: CommercialOffer UI cleanup and invoice visibility

## Summary

This fix removes the legacy CommercialOffer user interface from request details and keeps the current customer flow focused on:

```text
RequestItem -> client approval -> Invoice
```

CommercialOffer remains in the codebase as a legacy/future backend module, but it is no longer shown in the main CRM/client request detail flow.

## CRM UI Changes

Removed from `app/admin/requests/[id]/page.tsx`:

- CommercialOffer query include;
- CommercialOffer section;
- “Пропозиції на основі підібраних позицій” block;
- “Сформувати пропозицію” button;
- CommercialOffer send/cancel/delete/edit controls;
- CommercialOffer item table;
- CommercialOffer status badge helper.

Still visible in CRM request detail:

- request data;
- request files;
- OCR hints;
- picked request items;
- request documents;
- invoices;
- comments, status history, manager actions.

MANAGER and ADMIN still see all invoices in CRM:

- `DRAFT`;
- `SENT`;
- `PAID`;
- `CANCELLED`, including cancelled drafts.

## Client UI Changes

Removed from `app/client/requests/[id]/page.tsx`:

- CommercialOffer query include;
- CommercialOffer block;
- CommercialOffer approve/reject UI;
- CommercialOffer status badge helper.

Still visible in client request detail:

- request data;
- picked positions;
- “Включити у рахунок” checkbox;
- “Погодити вибрані позиції” action;
- edit clarification flow for request items;
- invoices visible to the client;
- request documents;
- attached files.

## Why CommercialOffer Backend Remains

CommercialOffer Prisma models, API routes, services, actions, and previous reports were not deleted.

They remain as a legacy/future module because removing them would be a larger data and API cleanup. The current customer-approved business flow now uses invoices built from approved `RequestItem` records.

## Client Invoice Visibility Fix

Client-visible invoice logic now allows:

```ts
status === 'SENT'
|| status === 'PAID'
|| (status === 'CANCELLED' && sentAt !== null)
```

Client-hidden invoice logic:

```ts
status === 'DRAFT'
status === 'CANCELLED' && sentAt === null
```

This means:

- `DRAFT` invoice is hidden from the client;
- `DRAFT -> CANCELLED` invoice is hidden from the client;
- `DRAFT -> SENT` invoice is visible to the client;
- `SENT -> PAID` invoice is visible to the client;
- `SENT -> CANCELLED` invoice is visible to the client as cancelled.

The visibility fix was applied in:

- client request detail query;
- invoice service client list/get helpers.

## Security Expectations

Expected behavior after this fix:

- CLIENT does not see draft invoices;
- CLIENT does not see invoices cancelled before sending;
- CLIENT sees sent invoices;
- CLIENT sees paid invoices;
- CLIENT sees cancelled invoices only if they were previously sent;
- CLIENT scope is still restricted by personal/company request access;
- MANAGER/ADMIN invoice visibility is unchanged;
- GUEST has no access to protected client/admin pages.

## Out Of Scope

Not included in this fix:

- PDF generation;
- print layout;
- email/Telegram invoice sending;
- seller/buyer requisites;
- new Prisma models;
- migrations;
- deleting CommercialOffer schema/API/service;
- database cleanup;
- RequestItem approval changes;
- invoice creation logic changes.

## Verification

Completed checks:

```bash
npx.cmd prisma generate
npx.cmd prisma validate
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

Result: all checks passed.

Manual smoke test should confirm:

- CommercialOffer block is absent in CRM request detail;
- CommercialOffer block is absent in client request detail;
- CRM still shows the invoice block;
- client still shows picked positions and invoice block;
- client does not see `DRAFT -> CANCELLED` invoices;
- client sees `SENT`, `PAID`, and `SENT -> CANCELLED` invoices.

## Blockers

No Prisma migration is required for this fix.

Full runtime invoice visibility smoke should be completed against a deployed environment or a local environment where Prisma Client can connect to Neon successfully.
