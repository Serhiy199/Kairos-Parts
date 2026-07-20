# Stage UI 11.5.1 — Request detail staging checklist

Route: `/admin/requests/[id]`
Role: authenticated `ADMIN` and `MANAGER` where applicable
Current status: browser runtime unavailable locally; all visual cases below are `BLOCKED`.

## Shared setup

Use a non-production test request containing:

- at least 3 selected positions;
- one long part name, catalog number and comment;
- long request description, VIN/serial, email and company name;
- assigned manager and a second unassigned request if available;
- public status token;
- at least 3 history entries;
- at least 3 notifications with multiline content;
- request/client files;
- request documents;
- at least one invoice with multiple line items.

Do not mutate production data merely to satisfy the checklist.

## Shared steps

1. Sign in as ADMIN.
2. Open `/admin/requests/[id]`.
3. Set the viewport to the listed width.
4. Confirm `document.documentElement.scrollWidth === window.innerWidth`.
5. Review header, contact/need/vehicle cards, selected positions, CTA, invoices, documents, comments and sidebar blocks.
6. Open position edit and document metadata controls.
7. Confirm only invoice/document tables have local horizontal scroll.
8. Keyboard-tab through actions and public status link.
9. Repeat access/readability check as MANAGER; do not submit mutations unless using approved test data.

## Width matrix

| Width | Expected layout | Status | Notes |
|---:|---|---|---|
| 375 | Single column; 16 px outer/card padding; header and status cards stack; positions vertical; CTA/actions full width | BLOCKED | Browser kernel assets unavailable |
| 390 | Same as 375; no body scroll; long URL/VIN/email wraps | BLOCKED | Browser kernel assets unavailable |
| 430 | Single column; controls stay inside cards; delete/edit accessible | BLOCKED | Browser kernel assets unavailable |
| 768 | Single-column main/sidebar; info cards may use two columns; positions remain vertical | BLOCKED | Browser kernel assets unavailable |
| 1024 | Single-column main/sidebar; sidebar full width in normal flow; no sticky behavior | BLOCKED | Browser kernel assets unavailable |
| 1280 | Main + sidebar; sidebar 300–360 px and sticky; positions remain vertical | BLOCKED | Browser kernel assets unavailable |
| 1440 | Main + sidebar; no clipping between columns; full notifications/history readable | BLOCKED | Browser kernel assets unavailable |
| 1920 | Main + sidebar; selected positions use structured seven-column desktop row | BLOCKED | Browser kernel assets unavailable |

## Additional widths requested by implementation brief

| Width | Expected | Status |
|---:|---|---|
| 640 | Single column; mobile/tablet controls wrap safely | BLOCKED |
| 820 | Single column; two-column info cards do not overflow | BLOCKED |
| 1536 | Main + sidebar; positions stay vertical because main is not yet wide enough | BLOCKED |

## Pass criteria

Mark a width `PASS` only when all are true:

- no body horizontal scroll;
- request number and metadata are fully visible;
- selected position fields and badges are not clipped;
- approval CTA is fully visible and keyboard accessible;
- sidebar does not compress main below readable width;
- public status URL wraps without changing token/path;
- full history and notification content is readable;
- files and long filenames wrap;
- invoice/document tables scroll only inside their local wrappers;
- action handlers and disabled states behave as before.

Use `FAIL` with a screenshot and exact block name if any criterion fails. Use `NOT RUN` when the environment is available but the case was intentionally skipped.
