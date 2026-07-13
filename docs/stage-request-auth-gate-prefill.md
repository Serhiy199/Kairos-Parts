# Kairos Parts — Stage 3 Request Auth Gate and Client Prefill

## Scope

This stage changes request creation access and client prefill behavior. It does not change Prisma schema, Telegram webhook logic, CRM manual workflows, commercial offers, documents, invoices, PDF generation, ChangeRequest, AuditLog, or used-equipment marketplace logic.

## What Changed

- `/request` now requires an authenticated `CLIENT` user to show the request form.
- Guests see an auth gate instead of the form.
- Staff users do not see the client request form on `/request`.
- Login/register links from the auth gate preserve `next=/request`.
- Client login now allows `/request` as a valid redirect target.
- Registration preserves `next` and redirects to login with the same target after successful registration.
- POST `/api/requests` now blocks unauthenticated users and non-CLIENT roles.
- Request creation now always creates a client-scoped request through this public/client route.

## Guest Behavior

Guests opening `/request` see:

- title: `Створення заявки доступне після входу`;
- explanation of why login is required;
- benefits list;
- buttons:
  - `/login?next=/request`;
  - `/register?next=/request`.

The request form is not rendered for guests.

## Logged-In CLIENT Behavior

A logged-in CLIENT sees the request form `Заявка на підбір запчастин`.

The form is prefilled from:

- `User.name`;
- `User.phone`;
- `User.email`;
- `ClientProfile.contactName`;
- `ClientProfile.firstName` / `lastName`;
- `ClientProfile.phone`;
- `ClientProfile.email`;
- `ClientProfile.companyName`;
- `Company.name` when the user belongs to a company.

Missing optional fields stay empty and can be filled manually.

## Company Context

When a CLIENT belongs to a Company:

- the request receives `companyId`;
- the request remains visible through the existing company-scope access rules;
- company name is used as the company field prefill;
- vehicle/repeat request prefill respects company access.

When a CLIENT does not belong to a Company:

- the request is created in personal scope with `clientId`;
- existing personal access behavior remains unchanged.

## API Protection

`POST /api/requests` now requires:

- authenticated session;
- `CLIENT` role;
- existing client access context.

Responses:

- guest: `401` with Ukrainian message;
- MANAGER/ADMIN: `403` with Ukrainian message;
- missing client profile/access context: `403`;
- validation errors remain `400`.

Telegram is not affected because it uses `/api/telegram/webhook`, not `/api/requests`.

## Login/Register Redirect Back

- `/login?next=/request` redirects a valid CLIENT to `/request`.
- `/register?next=/request` preserves the target and redirects to `/login?registered=1&next=%2Frequest`.
- Invalid or unsafe `next` values are normalized to `/client`.
- Staff login `/admin/login` was not changed.

## Backward Compatibility

- Existing requests remain readable in CRM and client dashboards.
- `/request?mode=file` still works and shows the file upload hint for logged-in CLIENT users.
- `/request?category=...` does not break; category is ignored by the new request model.
- Public CTA links can continue pointing to `/request`.
- Public status page remains unchanged by this stage.

## Verification

Run:

```bash
npx.cmd prisma generate
npx.cmd prisma validate
npm.cmd run typecheck
npm.cmd run lint
npm.cmd run build
```

## Manual Smoke Test Checklist

- Guest opens `/request` and sees auth gate, not form.
- Guest login link goes to `/login?next=/request`.
- Successful CLIENT login from that URL returns to `/request`.
- Register link goes to `/register?next=/request` and preserves redirect target.
- CLIENT sees prefilled request form.
- CLIENT-created request appears in client requests and CRM.
- Unauthenticated POST `/api/requests` is blocked.
- MANAGER/ADMIN POST `/api/requests` is blocked.
- Telegram webhook request creation remains separate.

## Blockers

No known code blocker for the next stage: client picked positions approval UX.
