# Stage Used Equipment 11 - Notifications and final stabilization

> Historical note: the manager Telegram notification described in this report was removed by the later fix `Remove used equipment manager Telegram notifications`. CRM inquiry creation, the NEW badge, and centralized revalidation remain active.

## 1. Scope

Stage 11 adds a best-effort internal Telegram notification for each newly created used-equipment inquiry and consolidates CRM inquiry badge revalidation.

The stage does not add customer notifications, email, scheduling, search, filters, exports, analytics, real-time polling, or new database models.

## 2. Preconditions

Confirmed before implementation:

- `UsedEquipmentStatus`: `DRAFT`, `PUBLISHED`, `ARCHIVED`;
- `UsedEquipmentInquiryStatus`: `NEW`, `IN_PROGRESS`, `COMPLETED`, `CANCELLED`;
- Stage 9 public inquiry creation is present;
- Stage 10 CRM list/detail workflow is present;
- `npx.cmd prisma migrate status` reported that the Neon database schema is up to date.

## 3. Notification infrastructure audit

The project already has a server-side Telegram Bot API helper in `lib/telegram/bot.ts` and uses HTML parse mode for existing notifications. Stage 11 reuses this helper instead of creating another bot client.

The application base URL is generated through the shared `lib/site-url.ts` helper. Source labels are taken from the shared used-equipment status helper. Phone display uses the shared phone normalization module.

## 4. Manager chat configuration

Stage 11 uses:

```text
TELEGRAM_MANAGER_CHAT_ID
```

The variable name was added to `.env.example` without a value.

Local configuration audit:

- Telegram bot token: configured;
- manager chat ID: missing;
- Cloudinary cloud name: configured;
- Cloudinary API key: configured;
- Cloudinary API secret: configured.

No secret values were printed or added to the repository.

## 5. Notification trigger

The notification runs only after `UsedEquipmentInquiry` has been successfully created with status `NEW`.

It is not called when:

- validation fails;
- the honeypot is populated;
- the equipment is missing or is not `PUBLISHED`;
- the ten-minute duplicate guard finds an existing inquiry;
- the database create fails.

## 6. Telegram message format

The manager receives:

- title: `Нова заявка на перегляд БВ техніки`;
- snapshot equipment title;
- client name;
- normalized phone;
- localized source label;
- short instruction to continue in CRM.

Raw source values, Cloudinary metadata, internal comments, tokens, and database connection data are not included.

## 7. CRM button URL

The inline button is:

```text
Відкрити заявку в CRM
```

It points to:

```text
/admin/used-equipment/inquiries/{inquiryId}
```

The absolute URL is built through the shared site URL helper and is not hardcoded to a production domain.

## 8. Best-effort behavior

The database row is created before Telegram is called and the Telegram request is not part of a Prisma transaction.

If the manager chat is not configured, the notification is skipped and inquiry creation still succeeds.

If Telegram returns an error, the helper returns a structured `failed` result, writes a safe diagnostic, and does not throw into the public form flow. The inquiry remains in the database and the visitor still receives the success state.

## 9. Duplicate notification guard

The existing ten-minute duplicate guard runs before database creation. A duplicate success-like response does not create a second row and therefore does not call the manager notification helper.

## 10. Safe diagnostics

Diagnostics include only:

- event name;
- inquiry ID;
- whether manager chat configuration exists;
- a bounded safe error message.

They do not log the Telegram token, manager chat ID, database URL, Cloudinary credentials, or full customer payload.

## 11. Badge stabilization

The CRM badge continues to use a server-side count of:

```text
UsedEquipmentInquiry.status = NEW
```

No polling or client fetch was introduced.

## 12. Revalidation paths

Public inquiry creation and CRM inquiry updates now reuse one server-only helper that revalidates:

- `/admin` layout;
- `/admin/used-equipment/inquiries`;
- `/admin/used-equipment/inquiries/{id}` when an ID is available.

Public catalog pages are not revalidated because creating or processing an inquiry does not change equipment content.

## 13. Full E2E flow

Code inspection confirms the complete route and action chain for:

- creating and publishing equipment;
- public catalog and detail visibility;
- public inquiry validation, duplicate guard, and create;
- CRM NEW count;
- CRM list/detail processing;
- manager assignment;
- `NEW -> IN_PROGRESS -> COMPLETED`;
- `processedAt` handling.

A live production/staging E2E with an actual Telegram delivery was not run because `TELEGRAM_MANAGER_CHAT_ID` is not configured locally and Stage 11 has not been redeployed.

## 14. Archive, restore, and DRAFT flows

Existing implementation was inspected:

- only `PUBLISHED` equipment is selected by public catalog/detail queries;
- `DRAFT` and `ARCHIVED` equipment are not publicly available;
- inquiry creation checks the current equipment status again;
- historical inquiries retain their equipment relation and snapshot title;
- CRM hides the public link for non-published equipment;
- restoring `ARCHIVED -> PUBLISHED` clears `archivedAt` through the existing status date helper.

No regression fix was required in these flows.

## 15. Image regression QA

Code inspection confirms the existing Stage 5 constraints remain unchanged:

- maximum 15 images;
- maximum 10 MB per image;
- JPEG, PNG, and WebP allowlist;
- primary/fallback image selection;
- CRM and public thumbnails use the existing image relations.

No image functionality was expanded in Stage 11.

## 16. Rich-text regression QA

The existing description sanitizer, length limits, safe renderer, and TipTap integration were not modified. Production build completed without TipTap SSR or type errors.

## 17. Public inquiry regression QA

Confirmed by code inspection and build:

- equipment must be `PUBLISHED`;
- name and phone validation remain active;
- honeypot remains active;
- ten-minute duplicate guard remains active;
- duplicate submissions do not trigger a second notification;
- Telegram failure cannot roll back the created row;
- user-facing errors remain safe.

## 18. CRM inquiry regression QA

Stage 10 behavior remains intact:

- server-side ADMIN/MANAGER access;
- paginated list and detail routes;
- localized source/status labels;
- manager assignment validation;
- internal comment validation;
- `processedAt` set for `COMPLETED` and cleared when leaving it;
- archived equipment inquiries remain accessible in CRM.

## 19. Pagination QA

Existing server-side constants remain:

- public catalog: 12;
- CRM equipment: 25;
- CRM inquiries: 25.

Page parsing normalizes invalid values and queries use server-side `skip`/`take`. No search, filtering, sorting, or page-size selector was added.

## 20. Role and security audit

Stage 11 does not weaken existing server-side role checks:

- ADMIN and MANAGER can access equipment and inquiry CRM routes/actions;
- CLIENT and unauthenticated users cannot use admin inquiry actions;
- the manager notification recipient is server configuration, not user input;
- user-provided Telegram message fields are HTML-escaped;
- public pages do not receive internal comments, assignee data, or Telegram configuration.

## 21. Accessibility QA

No interactive UI component was added in Stage 11. Existing text badges, labelled CRM controls, focus states, and semantic page structure remain unchanged. Browser-driven keyboard verification remains part of the post-redeploy smoke checklist.

## 22. Responsive QA

No layout CSS or responsive component was changed. Production build confirms all affected routes compile. Browser screenshots at the requested widths were not produced in this session because browser automation could not initialize; this is recorded as an unverified manual QA item rather than a passed check.

## 23. Browser and server warnings

The local production server reached `Ready` successfully after the production build.

Browser automation could not be initialized in the current Codex runtime, so hydration overlays, console warnings, and interaction states were not claimed as verified. No build-time React, Next Image, TipTap, Prisma, or hydration errors were reported.

## 24. Production smoke result

Not run.

Required before production acceptance:

1. configure `TELEGRAM_MANAGER_CHAT_ID` in the target Vercel environment;
2. redeploy;
3. create one controlled inquiry;
4. verify the manager Telegram message and CRM button;
5. verify duplicate submit does not send a second message;
6. move `NEW` to `IN_PROGRESS` and verify the badge after server navigation/refresh;
7. clean up the controlled test record if appropriate.

## 25. Technical checks

- `npx.cmd prisma migrate status` - passed, schema up to date;
- `npx.cmd prisma validate` - passed;
- `npx.cmd prisma generate` - passed;
- `npm.cmd run typecheck` - passed;
- `npm.cmd run lint` - passed;
- `npm.cmd run build` - passed;
- targeted notification content check - passed;
- `git diff --check` - passed.

The repository has no configured `test` script or existing test suite, so no project test command was available.

## 26. npm audit result

`npm.cmd audit` reported 3 moderate vulnerabilities in the existing Next.js/PostCSS dependency chain. npm reported no fix available for the PostCSS advisory. No dependency upgrade or `audit fix` was performed in this scope.

## 27. Prisma and migration status

Prisma schema was not changed.

No migration is required for Stage 11.

## 28. Remaining known limitations

- manager Telegram delivery requires `TELEGRAM_MANAGER_CHAT_ID`;
- live Telegram and post-redeploy browser smoke are pending;
- notification delivery is best-effort and has no durable retry queue;
- badge updates after server revalidation/navigation, not in real time;
- rate limiting remains the existing single-database duplicate guard.

## 29. Optional future enhancements

Not implemented:

- email, SMS, or customer Telegram notifications;
- CAPTCHA;
- distributed rate limiting;
- durable notification retries;
- status audit history;
- scheduled viewing date;
- search, filters, custom sorting, exports, sitemap, and analytics.

These are not blockers for the MVP.

## 30. Final readiness conclusion

The Stage 11 code foundation is ready for deployment: notification creation is scoped to newly inserted inquiries, manager delivery is best-effort, user content is escaped, shared labels and URL helpers are reused, and CRM badge revalidation is centralized.

Production acceptance still requires one controlled post-redeploy Telegram/E2E smoke after the manager chat environment variable is configured.
