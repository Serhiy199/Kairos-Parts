# Stage Used Equipment 10 — CRM inquiry workflow

## 1. Scope

Stage 10 adds CRM processing for public used-equipment inquiries created in Stage 9.

Implemented:

- CRM list route for inquiries;
- CRM detail route for a single inquiry;
- status update;
- assigned manager update;
- internal comment update;
- server-side role checks;
- new inquiry count badge in CRM navigation;
- pagination by 25 inquiries;
- equipment and client contact presentation.

Not implemented in this stage:

- Telegram notifications;
- email notifications;
- customer-facing status notifications;
- calendar or viewing date;
- search and filters;
- exports;
- deletion;
- new Prisma models or migrations.

## 2. Preconditions

Confirmed before implementation:

- `UsedEquipmentStatus` contains `DRAFT`, `PUBLISHED`, `ARCHIVED`.
- `UsedEquipmentInquiryStatus` contains `NEW`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`.
- `npx.cmd prisma migrate status` reported that the database schema is up to date.

## 3. CRM Routes

- `/admin/used-equipment/inquiries`
- `/admin/used-equipment/inquiries/[id]`

Both routes are server-side gated through CRM session checks.

## 4. Navigation

The existing sidebar item `БВ техніка` remains the main entry for `/admin/used-equipment/*`.

Inside the module, secondary navigation links were added:

- `Техніка` → `/admin/used-equipment/items`
- `Заявки на перегляд` → `/admin/used-equipment/inquiries`

## 5. NEW Badge

The CRM sidebar badge for `БВ техніка` uses a server-side count of:

`UsedEquipmentInquiry.status = NEW`

If the count is `0`, no badge is shown.

## 6. Server-side List Query

The list query uses a paginated Prisma query with nested selects for:

- one equipment image;
- used equipment basics;
- assigned manager basics.

It does not load all photos and does not perform per-row follow-up queries.

## 7. Pagination

Page size:

`25`

Query param:

`?page=1`

Invalid or out-of-range pages are normalized and redirected to the valid page.

## 8. List Presentation

The list shows:

- equipment thumbnail or placeholder;
- snapshot `equipmentTitle`;
- current equipment title only when it differs from the snapshot;
- client name;
- phone;
- inquiry status;
- source label;
- assigned manager;
- created date;
- `Відкрити` action.

Raw DB fields, Cloudinary public IDs, and full internal comments are not shown in the list.

## 9. Detail Query

The detail query loads:

- inquiry fields;
- assigned manager;
- related used equipment;
- one primary/fallback image.

If the inquiry is missing, the page returns `notFound()`.

## 10. Equipment Block

The detail page shows:

- primary/fallback image;
- snapshot `equipmentTitle`;
- current equipment title when different;
- equipment type;
- manufacturer;
- year;
- current equipment status;
- CRM edit link;
- public link only for `PUBLISHED` equipment.

For `ARCHIVED` equipment, the inquiry remains visible and the public link is hidden.

## 11. Client Contact Block

The detail page shows:

- name;
- phone;
- source;
- created date;
- updated date;
- processed date.

Phone is rendered as a clickable `tel:` link.

## 12. Status Update Flow

The CRM detail form allows MVP transitions between:

- `NEW`;
- `IN_PROGRESS`;
- `COMPLETED`;
- `CANCELLED`.

No state machine was added.

## 13. processedAt Logic

When status changes to `COMPLETED`:

- `processedAt` is set to `now()` if it was empty.
- Existing `processedAt` is preserved if the inquiry was already completed.

When status changes away from `COMPLETED`:

- `processedAt` is cleared.

## 14. Assigned Manager Logic

The assignee selector allows:

- `MANAGER`;
- `ADMIN`;
- `Не призначено`.

Server action verifies that the selected assignee exists and has an allowed role. `CLIENT` users cannot be assigned.

## 15. Internal Comment

`internalComment` is:

- optional;
- trimmed;
- plain text;
- limited to 5000 characters;
- shown only in CRM;
- not sent to clients.

## 16. Role Checks

Server-side checks are performed in:

- CRM list page;
- CRM detail page;
- update server action.

Allowed roles:

- `ADMIN`;
- `MANAGER`.

## 17. Revalidation

After update, the server action revalidates:

- `/admin`;
- `/admin/used-equipment/inquiries`;
- `/admin/used-equipment/inquiries/[id]`.

Public catalog pages are not revalidated because inquiry processing does not change equipment content.

## 18. Responsive Behavior

List page:

- desktop table;
- mobile cards.

Detail page:

- desktop two-column layout;
- mobile one-column layout.

## 19. Accessibility

Implemented:

- semantic headings;
- text status badges;
- labels for form fields;
- field-level errors;
- `aria-invalid`;
- `aria-describedby`;
- `aria-live` messages;
- keyboard-focusable links and buttons.

## 20. Manual QA

Recommended manual QA:

- ADMIN opens list and detail;
- ADMIN changes `NEW` to `IN_PROGRESS`;
- ADMIN assigns manager/admin;
- ADMIN adds internal comment;
- ADMIN changes status to `COMPLETED` and checks `processedAt`;
- MANAGER opens list/detail and updates allowed fields;
- CLIENT direct admin URL is blocked by current admin route protection;
- archived equipment inquiry remains visible and public link is hidden.

## 21. Technical Checks

Implementation checks:

- `npx.cmd prisma validate` — passed.
- `npx.cmd prisma generate` — passed.
- `npm.cmd run typecheck` — passed.
- `npm.cmd run lint` — passed.
- `npm.cmd run build` — passed.
- `git diff --check` — passed.

## 22. Prisma / Migration Status

Prisma schema was not changed.

Migration is not required.

## 23. Deferred

Deferred to future stages:

- notifications;
- search and filters;
- inquiry status history;
- calendar scheduling;
- exports;
- deletion;
- bulk actions.

## 24. Blocker for Stage 11

No code blocker is expected for Stage 11 after successful checks.
