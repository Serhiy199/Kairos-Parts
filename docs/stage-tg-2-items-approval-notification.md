# Stage TG-2 — Telegram notification when request items are sent for approval

## Scope

TG-2 adds one Telegram notification after a CRM manager successfully makes one or more previously hidden `RequestItem` records visible to the client. It does not change request-item approval, invoice logic, Telegram request creation, email delivery, PDF delivery, or Prisma schema.

## Integration point

The notification is called from `sendAdminRequestItemsForApproval` in `app/admin/actions.ts` only after `requestItem.updateMany` returns `count > 0`.

- If no hidden items exist, the existing `items-send-empty` redirect remains in place and no notification is attempted.
- The notification is sent once per successful action, not once per item.
- `requireCrmSession` remains the authorization gate for the action.

## Message and link

Message:

```text
По вашій заявці {requestNumber} менеджер підібрав позиції.

Перейдіть в особистий кабінет, щоб переглянути варіанти, обрати потрібні позиції та погодити їх для рахунку.
```

The inline button is `Переглянути заявку`. Its URL is:

```text
{APP_BASE_URL}/login?next=%2Fclient%2Frequests%2F{requestId}
```

The base URL uses `APP_BASE_URL`, then `NEXTAUTH_URL`, then the existing production fallback `https://kairos-parts.vercel.app`. No localhost URL is hardcoded.

## Recipient logic

The recipient is selected only from relations belonging to the target request:

1. For a company request, the primary company contact with a linked `ClientProfile.telegramChatId`.
2. The request owner (`request.client`) when that profile has a linked chat ID.
3. The earliest company member with a linked chat ID as a controlled company fallback.

Only one recipient is selected, so one chat ID cannot receive duplicates from the same action. A personal request uses its `request.client` profile.

## Failure handling

- Missing request: notification is skipped.
- Missing Telegram recipient: notification is skipped without changing the successful CRM result.
- Telegram API failure: the `Notification` row is marked `FAILED`; the request items stay visible.
- Notification infrastructure failure: the admin action catches it, writes a generic warning without tokens or secrets, and continues.
- A successful send updates the `Notification` row from `PENDING` to `SENT` and stores `sentAt`.

## Explicitly out of scope

- Item approval from Telegram.
- Invoice approval or rejection from Telegram.
- Invoice/PDF notifications (TG-3).
- Email, WebSocket, or push notifications.
- RequestItem approval or Invoice state changes.
- Prisma schema or migration changes.

## Verification

- `npx.cmd prisma generate` — passed (`Prisma Client 6.19.3`).
- `npx.cmd prisma validate` — passed; schema is valid.
- `npm.cmd run typecheck` — passed.
- `npm.cmd run lint` — passed with no errors or warnings.
- `npm.cmd run build` — passed; 42 static pages generated.
- `git diff --check` — passed.
- Pure local smoke test (no database writes and no Telegram API call) confirmed:
  - personal request selects the request owner;
  - company primary contact has priority;
  - request owner is the next company fallback;
  - a linked company member is the final controlled fallback;
  - no linked chat returns a skip result;
  - message text includes the request number;
  - URL uses `/login?next=/client/requests/{requestId}`.

The live Telegram scenarios were not executed against real clients to avoid sending unsolicited test messages. The production action path, controlled outcomes, and fail-open behavior were verified by code inspection, type checking, and the local pure-function smoke test.

## TG-3 readiness

TG-3 can reuse the Telegram bot helper, recipient pattern, fail-open delivery behavior, and login redirect URL pattern. No TG-2 implementation blocker was found for starting TG-3.
