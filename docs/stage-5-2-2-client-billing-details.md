# Stage 5.2.2: Client Billing Details Fallback

## Why This Was Added

Stage 5.2 added seller billing details and company-level buyer billing details. During testing, a UX gap appeared for standalone clients such as FOP / legal entity clients that are not necessarily attached to a Company.

This stage adds `ClientBillingDetails` so a CRM manager can store buyer billing details directly in the client card.

## Buyer Details Priority

New invoice `buyerSnapshot` is created with this priority:

1. `CompanyBillingDetails`, when the request has a company and company billing details are filled.
2. `ClientBillingDetails`, when company billing details are missing or the request is not company-scoped.
3. `ClientProfile` / `User` fallback with company name, contact name, phone and email.

The invoice keeps the snapshot created at invoice creation time. Later edits to company or client billing details do not mutate old invoices.

## CRM Client Card

`/admin/clients/[id]` now has a "Реквізити покупця" block.

Managers and admins can edit:

- company / legal name;
- EDRPOU;
- IPN;
- IBAN;
- bank;
- legal address;
- contact person;
- phone;
- email;
- VAT payer flag.

If the client belongs to a Company, the page shows that company billing details have priority and links to `/admin/companies/[id]`. Client billing details remain available as fallback details.

## Company Card

Company-level billing details remain managed in `/admin/companies/[id]`. They were not removed or changed.

## Client Profile

Clients do not edit billing details in `/client/profile` in this stage. Billing details are CRM-managed by MANAGER / ADMIN.

## Prisma Migration

Prepared migration:

```text
prisma/migrations/20260715110000_add_client_billing_details/migration.sql
```

It creates `ClientBillingDetails` and links it to `ClientProfile`.

The migration was prepared but not applied to Neon / production-like DB in this implementation step.

## Verification

Completed:

- `npx.cmd prisma generate`
- `npx.cmd prisma validate`
- `npm.cmd run typecheck`
- `npm.cmd run lint`
- `npm.cmd run build`

Pending:

- manual smoke test after applying migration to the target DB.

## Smoke Test Checklist

Client without company:

- Open `/admin/clients/[id]`.
- Fill buyer billing details.
- Create invoice for this client.
- Confirm `buyerSnapshot` uses `ClientBillingDetails`.

Client with company but no company billing:

- Fill client billing details.
- Create invoice.
- Confirm `buyerSnapshot` uses `ClientBillingDetails`.

Client with company billing:

- Fill company billing details.
- Optionally fill client billing details too.
- Create invoice.
- Confirm `buyerSnapshot` uses `CompanyBillingDetails`.

Snapshot immutability:

- Create invoice.
- Change client or company billing details.
- Confirm old invoice snapshot is unchanged.

## Stage 5.3 Readiness

No code blocker is expected for Stage 5.3 PDF generation after this migration is applied and the smoke test passes.
