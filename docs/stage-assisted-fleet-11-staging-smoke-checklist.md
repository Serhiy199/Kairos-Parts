# Stage Assisted Fleet 11 — Staging smoke checklist

Use after deploying the latest `main` to Vercel staging/preview. Do not put credentials, personal data, private URLs, storage keys, or secrets in this file.

For every scenario mark exactly one:

- [ ] PASS
- [ ] FAIL
- [ ] BLOCKED
- [ ] NOT RUN

Record deployment URL/commit privately or with a non-sensitive commit hash. Use a dedicated test Company, personal Client, CompanyMember and foreign Client.

## 1. Deployment and authentication

**Route:** `/admin/login`, `/login`
**Role:** ADMIN, MANAGER, CLIENT, unauthenticated
**Setup:** Latest Stage 11 commit deployed; env and migrations configured.
**Steps:** Verify deployment success; sign in with each test role; open a protected route while signed out.
**Expected:** Correct role redirects; ADMIN/MANAGER enter CRM; CLIENT enters client cabinet; unauthenticated user cannot access protected pages.
**Actual:**
**Notes:**

## 2. Company fleet creation

**Route:** `/admin/companies/[id]`, `/admin/companies/[id]/vehicles/new`
**Role:** ADMIN
**Setup:** Dedicated test Company with active CompanyMember.
**Steps:** Open Company fleet; create Vehicle with synthetic data; return to `#fleet`; inspect owner context.
**Expected:** Vehicle appears only in Company fleet; `clientId` is not user-controlled; CompanyMember can see it; foreign CLIENT cannot.
**Actual:**
**Notes:**

## 3. Personal fleet creation

**Route:** `/admin/clients/[id]`, `/admin/clients/[id]/vehicles/new`
**Role:** MANAGER
**Setup:** Dedicated personal CLIENT not linked to Company.
**Steps:** Create personal Vehicle; return to `#fleet`; sign in as owner and foreign CLIENT.
**Expected:** Vehicle appears only for owner; staff user is not owner; foreign CLIENT is denied.
**Actual:**
**Notes:**

## 4. Vehicle edit and owner immutability

**Route:** `/admin/vehicles/[vehicleId]/edit`
**Role:** ADMIN and MANAGER
**Setup:** One personal and one Company Vehicle.
**Steps:** Edit model/year/comment; save no-op once; inspect owner context; attempt form tampering with owner fields using browser tools.
**Expected:** Editable values persist; no-op is harmless; owner remains unchanged; hidden owner payload is ignored/rejected; CLIENT direct URL/action is denied.
**Actual:**
**Notes:**

## 5. Exact VIN duplicate matrix

**Route:** Vehicle create/edit routes
**Role:** ADMIN or MANAGER
**Setup:** Synthetic VIN `QA-TEST-001`; no real VIN.
**Steps:** Create first Vehicle; try `QA TEST 001` for same owner; create same normalized VIN for another owner; save original unchanged; try changing a second same-owner Vehicle to duplicate VIN; test weak value `N/A`.
**Expected:** Same-owner duplicates blocked; different owner allowed; edit-self allowed; weak VIN stored as empty/null.
**Actual:**
**Notes:**

## 6. Vehicle photos

**Route:** `/admin/vehicles/[vehicleId]/edit`, `/client/vehicles/[vehicleId]`
**Role:** ADMIN/MANAGER; CLIENT read-only
**Setup:** Two safe JPEG/PNG/WebP test files below 8 MB.
**Steps:** Upload two images; change primary; reorder; delete non-primary; delete current primary; inspect CRM thumbnail and client gallery; attempt foreign image ID and client mutation.
**Expected:** First image primary; order/primary persist; fallback selects next; deleted Cloudinary asset disappears; foreign/client mutations denied; no orphan asset after a simulated validation failure.
**Actual:**
**Notes:**

## 7. Vehicle internal and visible documents

**Route:** `/admin/vehicles/[vehicleId]/edit`, `/client/vehicles/[vehicleId]`, `/client/documents`
**Role:** ADMIN/MANAGER; owner CLIENT; foreign CLIENT
**Setup:** Safe PDF and image below 15 MB, including one Cyrillic filename.
**Steps:** Upload hidden document; verify client absence/direct denial; enable visibility; download as owner; try foreign download; toggle hidden; delete.
**Expected:** Hidden by default; visible only in owner scope; safe filename and headers; `nosniff` and private/no-store; Cloudinary + DB cleanup on delete.
**Actual:**
**Notes:**

## 8. Company documents

**Route:** `/admin/companies/[id]`, `/client/documents`
**Role:** ADMIN/MANAGER; active CompanyMember; foreign CLIENT
**Setup:** Dedicated Company and safe document.
**Steps:** Upload hidden; enable visibility; download as CompanyMember; try foreign Client; delete.
**Expected:** Exactly Company-owned; no personal mixing; active member allowed only when visible; foreign denied; cleanup succeeds.
**Actual:**
**Notes:**

## 9. Personal Client documents

**Route:** `/admin/clients/[id]`, `/client/documents`
**Role:** ADMIN/MANAGER; owner CLIENT; another CLIENT
**Setup:** Dedicated personal Client and safe document.
**Steps:** Upload hidden; enable visibility; download as owner; try another Client; delete.
**Expected:** Exactly Client-owned; Company docs not mixed; owner allowed only when visible; foreign denied; cleanup succeeds.
**Actual:**
**Notes:**

## 10. Client fleet list and mixed scope

**Route:** `/client/vehicles`
**Role:** personal-only CLIENT, CompanyMember with personal Vehicle, foreign CLIENT
**Setup:** Personal and Company Vehicle with/without photos.
**Steps:** Open list for each role/context; inspect sections, counts, thumbnails, placeholders and links.
**Expected:** Separate personal/Company sections; no duplicates or foreign data; correct Company name; primary/first fallback; stable cards.
**Actual:**
**Notes:**

## 11. Client Vehicle detail

**Route:** `/client/vehicles/[id]`
**Role:** owner CLIENT, active CompanyMember, foreign CLIENT
**Setup:** Vehicle with gallery, requests, visible/internal documents and long values.
**Steps:** Open own personal and Company Vehicle; use gallery keyboard; download visible file; try internal/foreign IDs and missing ID.
**Expected:** Correct owner context; ordered gallery; visible documents only; foreign/missing returns safe not-found; no storage metadata in HTML.
**Actual:**
**Notes:**

## 12. Client documents aggregation

**Route:** `/client/documents`
**Role:** mixed CLIENT
**Setup:** Visible personal, Company, Vehicle and Request documents plus hidden equivalents.
**Steps:** Open list and inspect each group/label; download visible records; check duplicates.
**Expected:** Correct groups and labels; no duplicate/hidden/foreign records; all links use protected routes.
**Actual:**
**Notes:**

## 13. ChangeRequest create and direct PATCH denial

**Route:** `/client/vehicles/[id]`, `/client/change-requests`, `/api/client/vehicles/[id]`
**Role:** owner CLIENT and foreign CLIENT
**Setup:** Owned Vehicle with known values.
**Steps:** Request model/year/comment changes; attempt no-op; attempt duplicate PENDING; tamper with owner/unknown/price fields; call direct PATCH; try foreign Vehicle.
**Expected:** Valid requests become PENDING; Vehicle unchanged; no-op/duplicate/forbidden/foreign/direct PATCH blocked with safe messages.
**Actual:**
**Notes:**

## 14. ChangeRequest approve

**Route:** `/admin/change-requests`
**Role:** ADMIN; MANAGER denial check
**Setup:** Valid PENDING Vehicle request.
**Steps:** Inspect old/new; approve; refresh Vehicle and audit log; repeat approve.
**Expected:** ADMIN-only under current policy; transaction updates Vehicle once; reviewed metadata/status/audits exist; repeat denied.
**Actual:**
**Notes:**

## 15. ChangeRequest reject and cancel

**Route:** `/admin/change-requests`, `/client/change-requests`
**Role:** ADMIN and requesting CLIENT
**Setup:** Two PENDING requests.
**Steps:** Reject first with comment; cancel second as requester; try cancel as foreign Client and after terminal status.
**Expected:** Vehicle unchanged; correct statuses/review metadata/audits; foreign/repeat operations denied.
**Actual:**
**Notes:**

## 16. Stale request conflict

**Route:** Vehicle edit + `/admin/change-requests`
**Role:** CLIENT, MANAGER, ADMIN
**Setup:** Vehicle model X.
**Steps:** CLIENT requests X→Y; MANAGER changes X→Z; ADMIN attempts approval.
**Expected:** Stale conflict; Vehicle remains Z; request not APPROVED; no successful apply audit.
**Actual:**
**Notes:**

## 17. Duplicate VIN approval conflict

**Route:** Vehicle edit + `/admin/change-requests`
**Role:** CLIENT and ADMIN
**Setup:** PENDING VIN change, then another same-owner Vehicle receives target VIN.
**Steps:** Attempt approval.
**Expected:** Safe duplicate conflict; Vehicle/request remain unapproved; no success audit.
**Actual:**
**Notes:**

## 18. Former CompanyMember access

**Route:** `/client/vehicles`, `/client/documents`, protected download URLs
**Role:** former CompanyMember
**Setup:** Record current membership and test asset URLs privately; remove membership only through approved staging admin flow.
**Steps:** Sign in again; open Company Vehicle/document routes and direct URLs; inspect personal Vehicle.
**Expected:** Company access disappears; personal scope remains; secure downloads denied. Restore membership if required.
**Actual:**
**Notes:**

## 19. Mobile and responsive QA

**Route:** `/client`, `/client/vehicles`, `/client/vehicles/[id]`, `/client/documents`, `/admin/vehicles/[vehicleId]/edit`, owner profiles, ChangeRequest pages
**Role:** ADMIN/MANAGER/CLIENT
**Setup:** Browser widths 1440, 1280, 1024, 768, 430, 390, 375.
**Steps:** Inspect long VIN/company/manufacturer/model/filename; gallery, forms, dialogs, actions and navigation.
**Expected:** No global horizontal scroll, clipping or overlap; local thumbnail/table scrolling only where intended; controls remain reachable.
**Actual:**
**Notes:**

## 20. Accessibility QA

**Route:** Same primary CRM/client routes
**Role:** ADMIN/MANAGER/CLIENT
**Setup:** Keyboard-only pass and accessibility inspector.
**Steps:** Navigate headings/forms/gallery/downloads/dialogs; trigger success/errors/pending; inspect focus return and `aria-live`.
**Expected:** Visible focus, labels/descriptions, status text not color-only, correct current thumbnail/nav state, disabled pending controls, no keyboard trap.
**Actual:**
**Notes:**

## 21. AuditLog coverage and payload safety

**Route:** `/admin/audit-log`
**Role:** ADMIN
**Setup:** Complete scenarios 2–17.
**Steps:** Verify create/update/photo/document/ChangeRequest/owner-transfer events; inspect metadata via safe admin UI only.
**Expected:** Actor/entity/owner context present; changed fields accurate; no storage key, private URL, signature, token, secret, DB URL or binary payload.
**Actual:**
**Notes:**

## 22. Cleanup and release gate

**Route:** Existing admin flows and Cloudinary console only if authorized
**Role:** ADMIN
**Setup:** Private list of synthetic test record IDs/assets.
**Steps:** Delete uploaded assets through product actions; reuse/archive test Vehicle according to policy; verify no orphan assets; retain AuditLog.
**Expected:** No test files or orphan Cloudinary assets; no destructive direct SQL; all release-gate scenarios PASS.
**Actual:**
**Notes:**

## Release decision

- [ ] **READY** — every release-gate scenario passed and cleanup completed.
- [ ] **NOT READY** — any foreign access, internal document leak, ownership violation, broken primary flow, migration/build failure or storage cleanup failure remains.

**Final notes:**
