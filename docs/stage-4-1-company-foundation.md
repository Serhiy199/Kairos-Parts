# Kairos Parts — Stage 4.1: Company Foundation

## Summary

Stage 4.1 adds the foundation for company accounts without introducing the future change approval workflow.

The goal is to support:

- one shared company context for multiple CLIENT users;
- company-level requests;
- company-level vehicles;
- company-related documents;
- admin-side company creation and membership assignment;
- backward compatibility for existing personal client accounts.

## Prisma Models

Added:

- `Company`
- `CompanyMember`

Updated:

- `User.companyMemberships`
- `Request.companyId`
- `Vehicle.companyId`
- `Document.companyId`

`CompanyMember` has:

- `companyId`
- `userId`
- `isPrimaryContact`
- unique membership per company/user;
- unique user membership for Stage 4.1, so one CLIENT user belongs to at most one company.

## Migration

Prepared migration:

```text
prisma/migrations/20260708150000_add_companies/migration.sql
```

The migration creates `Company` and `CompanyMember`, adds optional `companyId` to `Request`, `Vehicle`, and `Document`, and creates indexes/foreign keys.

The migration was not deployed to Neon in this stage. Apply it separately with confirmation, for example:

```bash
npx.cmd prisma migrate deploy
npx.cmd prisma generate
```

## Admin CRM

Added:

- `/admin/companies`
- `/admin/companies/[id]`
- `app/admin/company-actions.ts`

Managers/admins can:

- create a company;
- edit company metadata;
- add existing CLIENT users as company members;
- mark a member as primary contact;
- remove a member;
- manually assign existing requests to a company;
- manually assign existing vehicles to a company.

The admin sidebar now includes `Компанії`.

## Client Company Context

Added `getClientAccessContext(userId)` in:

```text
lib/client/access.ts
```

It returns:

- `userId`
- `clientProfileId`
- `companyId`
- `companyName`
- access mode: `PERSONAL` or `COMPANY`

Helper filters were added for:

- requests;
- vehicles;
- documents.

If a CLIENT has a company membership, client dashboard queries use company scope. If a CLIENT has no company membership, the old personal `clientId` logic remains active.

## Request and Vehicle Creation

Updated:

- `app/api/requests/route.ts`
- `app/client/vehicles/actions.ts`
- `app/api/client/vehicles/route.ts`
- `app/api/client/vehicles/[id]/route.ts`

New client-created requests and vehicles automatically receive `companyId` when the signed-in CLIENT belongs to a company.

Guest request creation remains unchanged and does not set `companyId`.

## Client Dashboard Changes

Updated:

- `/client`
- `/client/requests`
- `/client/requests/[id]`
- `/client/vehicles`
- `/client/vehicles/[id]`
- `/client/documents`
- client document/download APIs
- client commercial offer APIs/actions

Company members can see shared company requests, vehicles, visible request documents, and commercial offers through request company access.

Hidden request documents remain hidden unless `visibleToClient = true`.

## CRM Display

Updated:

- `/admin/requests/[id]`
- `/admin/clients/[id]`

CRM now shows company account information and links to the company detail page when a request/client is linked to a company.

## Permissions Implemented

Implemented in Stage 4.1:

- CLIENT without company sees only personal data.
- CLIENT with company sees company-scoped requests/vehicles/documents/offers.
- CLIENT cannot create or join a company from public/client routes.
- MANAGER/ADMIN can manage company records in CRM.
- Duplicate company membership is prevented.
- One CLIENT user can belong to only one company in Stage 4.1.

Not implemented in Stage 4.1:

- `ChangeRequest`
- approval/reject flow for edits/deletions;
- audit log;
- company roles such as owner/admin/accountant;
- notifications;
- invoice/PDF generation;
- object storage migration.

## Verification

Completed:

- `npx.cmd prisma generate`
- `npx.cmd prisma validate`
- `npm.cmd run typecheck`

Pending final checks after this report update:

- `npm.cmd run lint`
- `npm.cmd run build`

Manual smoke test requires applying the migration to the target DB first.

## Stage 4.2 / 4.3 Readiness

No known code blocker for the next substage after migration is applied.

Recommended next steps:

1. Apply the migration to the intended DB.
2. Smoke test admin company creation and member assignment.
3. Smoke test shared company dashboard visibility for two CLIENT users in one company.
4. Start Stage 4.2 for company dashboard polish or Stage 4.3 for `ChangeRequest` approval workflow.
