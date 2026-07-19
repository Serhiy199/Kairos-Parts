# Stage Assisted Fleet 11 — Final QA and release readiness

## 1. Executive summary

Assisted Fleet пройшов code review, static security review, helper regression checks, production build та read-only аудит Neon. Підтверджено чинні ownership constraints, відсутність некоректних Vehicle/Document owners і дубльованих VIN у наявних даних. Знайдено та виправлено один критичний write-path gap: legacy перенесення Vehicle з personal scope до Company тепер доступне тільки ADMIN, створює AuditLog у тій самій транзакції та оновлює залежні сторінки.

Фінальний статус: **READY WITH MANUAL STAGING CHECKS**. Причина: у Neon немає Company Vehicle, VehicleImage, Vehicle documents, Vehicle ChangeRequest та Vehicle AuditLog test fixtures, а authenticated browser mutation smoke у цьому етапі не виконувався.

## 2. Scope

Перевірено ownership, CRM owner profiles, Vehicle create/edit, VIN, photos, generic documents, client fleet, ChangeRequest, AuditLog, secure downloads, query scoping, revalidation, responsive/accessibility implementation і release configuration. Нові features, schema та migrations не додавалися.

## 3. Commits and completed stages

Поточний baseline містить Stage 1–10, завершуючись commit `b936fae Integrate fleet audit logs and change requests`. Stage 11 не змінює попередню бізнес-модель.

## 4. Current architecture

- PERSONAL Vehicle: `clientId != null`, `companyId = null`.
- COMPANY Vehicle: `clientId = null`, `companyId != null`.
- CompanyMember бачить Company Vehicle і власні personal Vehicle.
- Document має рівно один owner серед Vehicle, Company, Client або Request.
- Client direct PATCH Vehicle заблокований; зміни проходять через ChangeRequest.
- Photo/document mutations доступні staff, клієнт має read-only доступ лише у своєму scope.

## 5. Git state

- Branch: `main`.
- На старті `main` збігався з `origin/main`.
- Pre-existing unrelated change `app/(public)/advantages/page.tsx` не змінювався Stage 11 і не входить у commit.
- Destructive Git commands не виконувалися.

## 6. Prisma and migration status

- Фактична кількість migrations: **23**.
- `prisma migrate status`: database schema is up to date.
- Failed migrations або drift warnings не виявлені.
- `prisma validate` і `prisma generate`: PASS.
- Schema не змінювалася; нова migration не потрібна.

## 7. Neon ownership audit

Read-only audit через unpooled TLS connection:

| Metric | Count |
| --- | ---: |
| Vehicle total | 4 |
| Personal Vehicle | 4 |
| Company Vehicle | 0 |
| Invalid both owners | 0 |
| Invalid orphan owner | 0 |
| Duplicate normalized VIN groups | 0 |

`Vehicle_exactly_one_owner_check` підтверджено у БД.

## 8. VehicleImage data audit

У staging: VehicleImage total 0. Некоректних primary/sortOrder records не виявлено, але data-backed photo regression не може вважатися виконаним без fixtures. Code review підтвердив max 10, JPEG/PNG/WebP, 8 MB, primary fallback, reorder set validation, foreign image scoping і Cloudinary cleanup paths.

## 9. Document owner audit

У staging: Document total 0, invalid ownership 0. `Document_exactly_one_owner_check` підтверджено у БД. Data-backed visibility/download regression залишається у staging checklist.

## 10. ChangeRequest data audit

Vehicle ChangeRequest total 0: PENDING 0, APPROVED 0, REJECTED 0, CANCELLED 0. Forbidden ownership payloads, unknown editable fields, duplicate pending, reviewed-without-reviewer і approved-without-audit: 0. Runtime state transitions потребують manual staging fixtures.

## 11. AuditLog data audit

Vehicle AuditLog events у staging: 0. Sensitive metadata keys: 0. Через відсутність records історичне покриття не підтверджене даними; code review підтвердив audit writes для create/update, photo, document та ChangeRequest actions.

## 12. QA role matrix

| Role/context | CRM owner pages | Client personal fleet | Client company fleet | Mutations | Change review |
| --- | --- | --- | --- | --- | --- |
| ADMIN | Allow | N/A | N/A | Allow | Allow |
| MANAGER | Allow | N/A | N/A | Allow, owner transfer excluded | Deny by current ADMIN-only policy |
| CLIENT personal-only | Deny | Own only | None | Create + ChangeRequest only | Own cancel only |
| CLIENT company-only | Deny | Own personal if present | Current Company only | Create in resolved scope + ChangeRequest | Own cancel only |
| CLIENT mixed | Deny | Own only | Current Company only | Same as above | Own cancel only |
| Unauthenticated | Deny/login | Deny/login | Deny/login | Deny | Deny |
| Foreign CLIENT | Deny | Deny foreign | Deny foreign Company | Deny | Deny |
| Former CompanyMember | Deny | Own personal only | Deny former Company | Deny foreign | Own records only |

Current product policy intentionally keeps `/admin/change-requests` approval/rejection ADMIN-only, despite older generic MANAGER/ADMIN wording.

## 13. CRM company flow

Code review: company profile is staff-guarded, queries Company-owned Vehicle only, includes one ordered thumbnail per Vehicle, exposes create/edit links and Company documents. Missing Company returns `notFound`. Company runtime flow is NOT RUN because Neon currently has zero Company Vehicle fixtures.

## 14. CRM personal flow

Code review: client profile validates CLIENT role and queries only `clientId = profile.id AND companyId = null`. Company Vehicle are excluded. Missing client is handled safely. Browser mutation flow is NOT RUN.

## 15. Vehicle create and edit

- Company/personal owner IDs come from trusted route context, not form fields.
- Owner XOR is enforced in helpers and DB.
- Staff user never becomes owner.
- Edit exposes only type/manufacturer/model/year/VIN/comment.
- Owner context is read-only and absent from editable payload.
- No-op saves do not create Vehicle update audit events.
- Revalidation covers owner profile, edit page, client list and detail.

## 16. VIN duplicate regression

Helper checks passed for case/space/hyphen normalization, weak VIN to null, same-owner scope and edit-self exclusion in production code. Read-only DB duplicate groups: 0. Approval path rechecks current same-owner duplicates inside the transaction.

## 17. Photo regression

Static PASS for MIME/size/count validation, first primary, explicit primary, reorder identity validation, foreign image denial, delete fallback, DB-failure cleanup and Cloudinary delete. Runtime Cloudinary upload/delete/reorder is NOT RUN.

## 18. Vehicle document regression

Static PASS for PDF/JPEG/PNG/WebP signatures, 15 MB, max 25, hidden default, scoped visibility toggle/delete, protected downloads and cleanup. Runtime Cloudinary flow is NOT RUN.

## 19. Company document regression

Generic owner helper creates Company-only ownership. Client queries require active Company scope and `visibleToClient=true`; foreign access is query-level denied. Runtime upload/download/delete is NOT RUN.

## 20. Personal document regression

Client-only ownership, CLIENT role validation, hidden default, own-client scope and separation from Company documents are enforced in code. Runtime flow is NOT RUN.

## 21. Client Vehicle list and detail

- Personal and Company sections are separated from the same scoped result.
- Mixed users receive own personal Vehicle plus current Company Vehicle without duplicates.
- Lists fetch one primary/first image; details fetch ordered gallery.
- Details query visible Vehicle documents only and returns `notFound` for missing/foreign IDs.
- Loading/error/not-found states exist.

## 22. `/client/documents`

Queries filter `visibleToClient` at database level and apply personal/company ownership. Request documents remain separate and protected. Private storage metadata is not selected for client HTML.

## 23. Dashboard and navigation

Dashboard/client layout counts use scoped queries. Fleet detail routes retain the Vehicle navigation namespace. Static review found no duplicate navigation item. Mobile/browser behavior is listed for manual verification.

## 24. ChangeRequest create, approve, reject and cancel

- Create verifies CLIENT session, exact owner scope, strict editable allowlist, canonical old/new values, no-op and duplicate-PENDING guards.
- Direct Vehicle PATCH returns conflict and instructs use of ChangeRequest.
- Approve/reject API and UI are ADMIN-only under current product policy.
- Approve rereads Vehicle, validates stale state and VIN, applies transactionally, and writes ChangeRequest + Vehicle audits.
- Cancel requires requesting CLIENT and PENDING status; Vehicle remains unchanged.

## 25. Stale conflict

Code path compares canonical current value with stored old value before mutation. Mismatch returns safe stale-conflict result; update and success audit are not executed. Browser scenario is NOT RUN.

## 26. Duplicate VIN at approval

Approval computes owner scope from current Vehicle and calls duplicate detection excluding the same Vehicle. Conflict returns safe duplicate result before update/status/audit success. Browser scenario is NOT RUN.

## 27. AuditLog coverage

Code review confirmed metadata event names for Vehicle create/update; photo upload/primary/reorder/delete; Vehicle, Company and Client document upload/visibility/delete; ChangeRequest create/cancel/approve/reject. AuditAction enum remains generic where metadata supplies the specific event.

## 28. Security and IDOR regression

Server pages/actions repeat role checks. Client Vehicle/document queries include owner scope; internal documents are excluded at query level. Foreign image/document IDs are paired with parent Vehicle/owner conditions. No JSX-only authorization was found.

## 29. Download security

Admin downloads require CRM session. Client generic/Vehicle downloads require owner scope and `visibleToClient=true`. Responses use stored MIME, safe RFC 5987 filename, `X-Content-Type-Options: nosniff`, and `Cache-Control: private, no-store`. Storage keys/private Cloudinary URLs are not emitted to HTML.

## 30. Query and revalidation review

List queries avoid N+1 with nested selects and `take: 1`; detail loads full ordered gallery. Internal documents are not fetched client-side. Mutations revalidate owner profiles, admin edit, client dashboard/list/detail/documents and ChangeRequest pages as relevant.

## 31. Responsive QA

Static review confirmed constrained grids, `min-w-0`, local thumbnail overflow, responsive one/two-column layouts and mobile-sized controls. Browser viewport verification at 1440/1280/1024/768/430/390/375 is **NOT RUN** and remains mandatory in the staging checklist.

## 32. Accessibility QA

Labels, `aria-invalid`, `aria-describedby`, `aria-live`, accessible download names, gallery thumbnail labels/current state, focus-visible styles and loading semantics are present on primary flows. Dialog/focus behavior and keyboard end-to-end are NOT RUN in browser.

## 33. Static technical checks

| Check | Result |
| --- | --- |
| `prisma migrate status` | PASS, 23 applied/current |
| `prisma validate` | PASS |
| `prisma generate` | PASS |
| `npm run typecheck` | PASS |
| `npm run lint` | PASS |
| `npm run build` | PASS, 42 static pages generated; existing `jose` Edge Runtime warnings remain non-blocking |
| `git diff --check` | PASS |

## 34. Targeted regression checks

- `scripts/check-assisted-fleet-stage10.ts`: PASS.
- `scripts/check-assisted-fleet-stage11.ts`: PASS.
- Stage 11 checks owner/document invariants, VIN/weak values, editable allowlist/no-op, personal/company access predicates, DB constraints, data consistency, ChangeRequest payloads and audit metadata safety.
- Scripts are read-only and output aggregates only.

## 35. Local browser smoke status

NOT RUN. Authenticated mutation smoke would create staging DB and Cloudinary records, while current Neon lacks dedicated Company/photo/document/ChangeRequest fixtures. No claim of visual or end-to-end runtime completion is made.

## 36. Vercel environment checklist

Locally configured without revealing values: `DATABASE_URL`, `DATABASE_URL_UNPOOLED`, `AUTH_SECRET`, `NEXTAUTH_SECRET`, `NEXTAUTH_URL`, `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`. `AUTH_URL` is not used locally because the project currently uses `NEXTAUTH_URL`. Cloudinary secrets are server-only and have no `NEXT_PUBLIC_` prefix. Verify equivalent Production/Preview scopes in Vercel before smoke.

## 37. Manual staging smoke checklist

The executable checklist is in `docs/stage-assisted-fleet-11-staging-smoke-checklist.md`. It covers company, personal, duplicate VIN, ChangeRequest, stale conflict, secure downloads, former membership, roles and mobile viewports.

## 38. Test data cleanup plan

Use a dedicated test Company/Client and synthetic VIN. Record IDs privately. Delete uploaded assets through existing admin actions. Do not use direct destructive SQL. Since Vehicle delete UI is absent, reuse designated test Vehicle or request a separately approved cleanup script; retain AuditLog according to policy.

## 39. Bugs found and fixes

**HIGH, fixed:** exported legacy `assignVehicleToCompany` action used the general CRM guard and changed owner without AuditLog. Root cause was pre-AuditLog code surviving as a production server action. Fix: ADMIN-only guard, transactional `VEHICLE_OWNER_TRANSFERRED` audit, and revalidation of old/new owner plus client fleet routes.

**QA infrastructure, fixed:** Windows Prisma Client could not open Neon TLS sessions although Prisma CLI migration status worked. Stage 10/11 read-only scripts use `pg` as an explicit dev-only PostgreSQL transport with unpooled `verify-full`; this keeps clean-checkout QA reproducible and leaves the production runtime unchanged.

## 40. Remaining known gaps

- No Company Vehicle, VehicleImage, Document, Vehicle ChangeRequest or Vehicle AuditLog fixtures in current Neon data.
- Authenticated browser, Cloudinary mutation, former-member and mobile viewport smoke remain manual.
- Multi-company membership is intentionally not supported (`CompanyMember.userId` unique); “mixed” means personal + one Company scope.
- No Vehicle delete UI; cleanup requires a designated reusable QA record or separately approved cleanup operation.

## 41. Release blocker classification

No open confirmed BLOCKER or HIGH issue after the ownership-transfer fix. Manual staging scenarios are release gates because data-backed photo/document/ChangeRequest behavior was not exercised in this run. Any foreign-access, internal-document leak, failed cleanup, or broken approve flow found there becomes a BLOCKER/HIGH.

## 42. Final release readiness status

**READY WITH MANUAL STAGING CHECKS**

Code, migrations, build and read-only DB invariants are ready. Production release should wait for the mandatory staging checklist to pass, especially Cloudinary, Company scope, ChangeRequest transitions and secure downloads.

## 43. Recommended next safe step

Push this isolated commit, redeploy Vercel staging, then execute `docs/stage-assisted-fleet-11-staging-smoke-checklist.md` with dedicated non-production test owners. Promote only after all release-gate scenarios are PASS and cleanup is confirmed.
