# Stage 5.2: Billing details foundation

## Scope

Stage 5.2 adds billing details for seller and buyer records and stores invoice billing snapshots at invoice creation time.

PDF generation, print preview, email/Telegram invoice sending, online payments, Excel export, and invoice templates are not included in this stage.

## Prisma changes

Added:

- `SellerBillingDetails`
- `CompanyBillingDetails`
- `Company.billingDetails`
- `Invoice.sellerSnapshot`
- `Invoice.buyerSnapshot`

Migration prepared:

```text
prisma/migrations/20260715070703_add_billing_details/migration.sql
```

The migration was created locally only. It was not applied to Neon/production-like DB in this stage.

## Seller billing details

Seller billing details are managed at:

```text
/admin/billing-settings
```

Only `ADMIN` can open and update this page. `MANAGER` does not see the navigation item.

Fields:

- legal company name;
- ЄДРПОУ;
- ІПН;
- IBAN;
- bank name;
- МФО;
- phone;
- email;
- legal address.

`legalName` is required. Email is validated when filled.

## Buyer billing details

Buyer billing details are managed in:

```text
/admin/companies/[id]
```

`MANAGER` and `ADMIN` can create/update buyer billing details for a company.

Fields:

- legal name;
- ЄДРПОУ;
- ІПН;
- IBAN;
- bank name;
- legal address;
- contact person;
- phone;
- email;
- VAT payer.

`legalName` is required when saving buyer billing details. If details are empty, the company page shows an empty-state warning.

## Invoice snapshots

When CRM creates an invoice from approved request items:

1. The service loads the default `SellerBillingDetails`.
2. If seller details are missing, invoice creation is blocked with:

```text
Спочатку заповніть реквізити продавця.
```

3. The service loads `CompanyBillingDetails` when the request belongs to a company.
4. If company buyer details are missing, it creates a fallback buyer snapshot from Company / ClientProfile / User data.
5. The invoice stores:

- `sellerSnapshot`;
- `buyerSnapshot`.

Snapshots are stored as JSON so old invoices do not change when company or seller billing details are edited later.

## CRM UI

The request invoice block now shows:

- invoice number;
- status;
- total amount;
- seller snapshot;
- buyer snapshot;
- invoice item table.

Existing invoices without snapshots render a warning instead of breaking the page.

## Client UI

Client invoice visibility rules were not changed. CLIENT still sees only allowed `SENT`, `PAID`, and previously-sent `CANCELLED` invoices in request details. Full billing display for client-side PDF/print is deferred to Stage 5.3.

## Permissions

- `ADMIN`: can edit seller billing details.
- `MANAGER`: can view CRM and edit company buyer billing details, but cannot edit seller billing settings.
- `CLIENT`: cannot access admin billing pages and cannot edit billing details in this stage.
- `GUEST`: blocked by existing admin auth.

## Backward compatibility

- Existing companies without `CompanyBillingDetails` still open.
- Existing invoices without snapshots still render.
- Invoice creation requires seller billing details going forward.
- Buyer details are optional at creation time because a fallback snapshot is generated.

## Verification

Run:

```powershell
npx.cmd prisma generate
npx.cmd prisma validate
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

## Blockers for Stage 5.3

Before PDF generation / print preview, apply the Stage 5.2 migration to the target DB and smoke test:

- save seller billing details;
- save company buyer billing details;
- create invoice from approved items;
- confirm `sellerSnapshot` and `buyerSnapshot` are stored;
- confirm old invoice snapshots do not mutate after buyer details change.
