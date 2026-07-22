# Stage Admin Audit Log 3 — Critical CRM Action Coverage

## Baseline and placement audit

Stage 2 (`e8251ca`) supplied the append-only writer, actor snapshots, retention metadata, payload sanitizer and ADMIN-only read surface. Before Stage 3 the database had all 34 migrations applied and the working tree was clean. Stage 3 adds only stable `AuditAction` enum values; no `AuditLog` columns, relations, retention rules or permissions change.

| Module / entrypoint | Function | Actor source | Existing transaction before Stage 3 | Old/new state available | Audit placement |
| --- | --- | --- | --- | --- | --- |
| `app/admin/actions.ts` | `updateAdminRequestStatus` | `requireCrmSession()` | Request + history array transaction | Yes / yes | Converted to callback transaction; audit is the third write |
| `app/api/admin/requests/[id]/status/route.ts` | `PATCH` | `getCrmApiSession()` | Request + history array transaction | Yes / yes | Same callback transaction |
| `app/admin/actions.ts`, assign API | manager assignment functions | ADMIN session | No | Current and target managers | Request update + audit transaction |
| request item server actions and API | create/update/delete | CRM session | No | Create result; full allowlisted state for update/delete | Local callback transaction per mutation |
| `app/client/actions.ts` | `approveClientRequestItemsAction` | `requireClientSession()` | Two `updateMany` calls in one transaction | Previous and selected IDs | One bulk audit event in the same transaction |
| `lib/commercial-offers/service.ts` | create/update/items/send/cancel/delete/approve/reject | Trusted actor context from CRM session or `ClientAccessContext.userId` | No | Offer compact summary before/after | Service owns business + audit transaction; routes do not log again |
| `lib/invoices/service.ts` | create/send/cancel/paid | CRM session actor ID and role | No | Invoice compact summary before/after | Service owns business + audit transaction |
| request document server actions and API | upload/update/delete | CRM session | No | Metadata snapshot; full file data is never logged | DB mutation + audit transaction after storage upload |
| document download routes | `GET` | CRM/client API session | Not applicable read | Authorized document metadata | Audit only after file availability/redirect is confirmed |
| `app/admin/company-actions.ts` | company, billing, member and primary-contact mutations | `requireCrmSession()` | Membership only | Allowlisted current/new values | Each business mutation and audit share a transaction |
| `app/admin/client-billing-actions.ts` | `upsertClientBillingDetails` | `requireCrmSession()` | No | Billing details before/after | Upsert + audit transaction |

No audit call is written before validation or authorization. Financial mutations do not swallow writer errors: an audit failure rejects the transaction and rolls back the business write. Notification delivery remains outside the invoice transaction and retains its previous non-blocking behavior.

## Coverage matrix

### Requests

| Модуль | Операція | Action | Category | Actor | Before/After | Transaction-safe | Реалізовано |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Requests | Зміна статусу, включно з наявними cancel/reopen transitions | `REQUEST_STATUS_CHANGED` | `STANDARD` | ADMIN/MANAGER | `status` | Так, разом з status history | Так, server action + API |
| Requests | Перше призначення менеджера | `REQUEST_MANAGER_ASSIGNED` | `STANDARD` | ADMIN | manager ID/name/email | Так | Так |
| Requests | Перепризначення менеджера | `REQUEST_MANAGER_REASSIGNED` | `STANDARD` | ADMIN | manager ID/name/email | Так | Так |
| Requests | Зняття менеджера | `REQUEST_MANAGER_UNASSIGNED` | `STANDARD` | ADMIN | manager ID/name/email | Так | Так |
| Requests | Прив’язка заявки до компанії | `REQUEST_COMPANY_CHANGED` | `STANDARD` | ADMIN/MANAGER | company ID/name | Так | Так |

Окремих CRM flows для зміни client/vehicle, archive або admin request create у поточному коді немає, тому відповідні actions не додавались.

### Request items

| Модуль | Операція | Action | Category | Actor | Before/After | Transaction-safe | Реалізовано |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Request items | Створення | `REQUEST_ITEM_CREATED` | `STANDARD` або `FINANCIAL_CRITICAL` за наявності price/нетипової quantity | ADMIN/MANAGER | Allowlisted snapshot | Так | Так, server action + API |
| Request items | Редагування | `REQUEST_ITEM_UPDATED` | `FINANCIAL_CRITICAL` для price/quantity diff, інакше `STANDARD` | ADMIN/MANAGER | Лише diff | Так | Так, server action + API |
| Request items | Видалення | `REQUEST_ITEM_DELETED` | За фінансовим snapshot | ADMIN/MANAGER | Safe snapshot до delete | Так | Так, server action + API |
| Request items | Відправлення на погодження | `REQUEST_ITEMS_SENT_FOR_APPROVAL` | `STANDARD` | ADMIN/MANAGER | Compact count/IDs | Так | Так |
| Request items | Bulk вибір клієнта | `REQUEST_ITEMS_CLIENT_APPROVAL_CHANGED` | `STANDARD` | CLIENT | Попередні/нові approved IDs, counts | Так | Так, один event на submit |

Поточний UI виконує bulk approve/reject одним submit, тому використано один action замість двох штучних events.

### Commercial offers

| Модуль | Операція | Action | Category | Actor | Before/After | Transaction-safe | Реалізовано |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Commercial offers | Create | `COMMERCIAL_OFFER_CREATED` | `FINANCIAL_CRITICAL` | ADMIN/MANAGER | Compact totals/status snapshot | Так | Так |
| Commercial offers | Metadata update | `COMMERCIAL_OFFER_UPDATED` | Financial для currency, інакше `STANDARD` | ADMIN/MANAGER | Лише diff | Так | Так |
| Commercial offers | Item/total change | `COMMERCIAL_OFFER_ITEMS_CHANGED` | `FINANCIAL_CRITICAL` | ADMIN/MANAGER | Item price/quantity + compact totals | Так | Так |
| Commercial offers | Send | `COMMERCIAL_OFFER_SENT` | `STANDARD` | ADMIN/MANAGER | status/sentAt diff | Так | Так |
| Commercial offers | Approve | `COMMERCIAL_OFFER_APPROVED` | `FINANCIAL_CRITICAL` | CLIENT | status/approvedAt diff | Так | Так |
| Commercial offers | Reject | `COMMERCIAL_OFFER_REJECTED` | `STANDARD` | CLIENT | status/rejectedAt diff | Так | Так |
| Commercial offers | Cancel | `COMMERCIAL_OFFER_CANCELLED` | `FINANCIAL_CRITICAL` | ADMIN/MANAGER | status/cancelledAt diff | Так | Так |
| Commercial offers | Delete draft | `COMMERCIAL_OFFER_DELETED` | `FINANCIAL_CRITICAL` | ADMIN/MANAGER | Snapshot до delete | Так | Так |

Окремого add/remove offer item flow немає; наявний flow лише оновлює вже створені позиції.

### Invoices

| Модуль | Операція | Action | Category | Actor | Before/After | Transaction-safe | Реалізовано |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Invoices | Create from approved items | `INVOICE_CREATED` | `FINANCIAL_CRITICAL` | ADMIN/MANAGER | Number/status/currency/subtotal/total/count/request | Так | Так |
| Invoices | Send | `INVOICE_SENT` | `FINANCIAL_CRITICAL` | ADMIN/MANAGER | status/sentAt diff | Так | Так |
| Invoices | Mark paid | `INVOICE_MARKED_PAID` | `FINANCIAL_CRITICAL` | ADMIN/MANAGER | status/paidAt diff | Так | Так |
| Invoices | Cancel | `INVOICE_CANCELLED` | `FINANCIAL_CRITICAL` | ADMIN/MANAGER | status/cancelledAt diff | Так | Так |
| Invoices | Open print/PDF view | `INVOICE_PDF_OPENED` | `CRITICAL_READ` | ADMIN/MANAGER/CLIENT | Safe metadata | Read event | Так; source links have `prefetch={false}` |

Invoice edit/items/delete flows do not exist. VAT, totals and status transition rules were not changed.

### Documents

| Модуль | Операція | Action | Category | Actor | Before/After | Transaction-safe | Реалізовано |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Request documents | Upload | `DOCUMENT_UPLOADED` | `STANDARD` | ADMIN/MANAGER | Safe file metadata | DB create + audit transaction | Так, action + API |
| Request documents | Rename/visibility/combined metadata | `DOCUMENT_RENAMED`, `DOCUMENT_VISIBILITY_CHANGED`, `DOCUMENT_UPDATED` | `STANDARD`; financial type transition is critical | ADMIN/MANAGER | Лише diff | Так | Так |
| Request documents | Delete | `DOCUMENT_DELETED` | Financial for invoice/offer document, otherwise `STANDARD` | ADMIN/MANAGER | Snapshot до delete | Так | Так |
| Owner/vehicle documents | Upload/visibility/delete | Document actions | `STANDARD` | ADMIN/MANAGER | Existing safe metadata | Так | Так, existing coverage normalized |
| Private/financial document | Download | `DOCUMENT_DOWNLOADED` | `CRITICAL_READ` | ADMIN/MANAGER/CLIENT where applicable | Metadata only | Read event | Так |

Storage keys, URLs, signed URLs and file content are never allowlisted. A replace flow is absent.

### Companies

| Модуль | Операція | Action | Category | Actor | Before/After | Transaction-safe | Реалізовано |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Companies | Legal/contact update | `COMPANY_UPDATED` | Financial for name/EDRPOU/legal address, otherwise `STANDARD` | ADMIN/MANAGER | Лише changed allowlisted fields | Так | Так |
| Companies | Billing update | `COMPANY_BILLING_UPDATED` | `FINANCIAL_CRITICAL` | ADMIN/MANAGER | Лише billing diff | Так | Так |
| Companies | Member add/remove | `COMPANY_MEMBER_ADDED`, `COMPANY_MEMBER_REMOVED` | `STANDARD` | ADMIN/MANAGER | Compact member snapshot | Так | Так |
| Companies | Primary contact | `COMPANY_PRIMARY_CONTACT_CHANGED` | `STANDARD` | ADMIN/MANAGER | Previous/new contact | Так | Так |

### Clients

| Модуль | Операція | Action | Category | Actor | Before/After | Transaction-safe | Реалізовано |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Clients | Billing details | `CLIENT_BILLING_UPDATED` | `FINANCIAL_CRITICAL` | ADMIN/MANAGER | Лише billing diff | Так | Так |

Окремого admin flow для name/phone/email/active state у поточному коді немає. Telegram profile synchronization не входить у Stage 3.

### Critical reads

| Модуль | Операція | Action | Category | Actor | Before/After | Transaction-safe | Реалізовано |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Invoice | Explicit print/PDF route | `INVOICE_PDF_OPENED` | `CRITICAL_READ` | CRM/CLIENT | Metadata only | N/A | Так |
| Request document | Private admin or financial client/admin download | `DOCUMENT_DOWNLOADED` | `CRITICAL_READ` | CRM/CLIENT | Metadata only | N/A | Так |
| Request attachment | CRM download | `DOCUMENT_DOWNLOADED` | `CRITICAL_READ` | CRM | Metadata only | N/A | Так |
| Generic/vehicle document | Private CRM download | `DOCUMENT_DOWNLOADED` | `CRITICAL_READ` | CRM | Metadata only | N/A | Так |

Звичайні page views, list APIs і public/visible non-financial downloads не логуються.

## Payload and failure boundaries

- Request items: `name`, `brand`, `catalogNumber`, `analogNumber`, `quantity`, `availability`, `salePrice`, `visibleToClient`, `includeInInvoice`.
- Offers/invoices: stable number, status, currency, decimal totals as strings, item count and lifecycle timestamps. Seller/buyer JSON snapshots and full item arrays are excluded.
- Companies/clients: only approved legal/contact/billing fields. Passwords, tokens, auth data and Telegram identifiers are excluded.
- Documents: file name/type/visibility/size/MIME and owner references; no storage path, URL or content.
- Decimal values are serialized to strings; `Date` values are serialized by the centralized sanitizer.
- HTTP context uses the first `x-forwarded-for` address (or `x-real-ip`) plus bounded user-agent through the centralized writer normalizers.

All financial business writes use callback transactions and await `writeAuditLog`. No catch block suppresses writer failure. Standard mutations were also made transaction-safe where the local architecture allowed it without changing their business rules.

## Deferred coverage

- Request create, client/vehicle reassignment and archive flows: no corresponding CRM mutation exists.
- Invoice edit/items/delete and standalone PDF generation endpoint: no corresponding flow exists.
- Document replacement: no flow exists.
- Full client profile/contact/disable actions: no admin mutation exists.
- Login/technical events, manager-specific history pages, filters, cleanup cron and UI redesign remain separate stages.
