# Stage Assisted Fleet 9 - Client cabinet fleet completion and UX QA

## 1. Scope

Completed the client-facing fleet read experience for `/client/vehicles`, `/client/vehicles/[id]`, `/client/documents`, and the `/client` dashboard. No new ownership, upload, edit, notification, or business workflow was introduced.

## 2. Preconditions

Stages 2A, 6, 7, and 8 are present. Neon reports all 23 migrations applied and the database schema is up to date.

## 3. Client routes audited

- `/client`
- `/client/vehicles`
- `/client/vehicles/[id]`
- `/client/vehicles/new`
- `/client/documents`
- `/client/requests`

The existing dashboard shell, navigation, vehicle actions, secure document routes, and CRM revalidation paths were reviewed and reused.

## 4. Access model

All fleet reads use the existing `ClientAccessContext` and `vehicleAccessWhere` helper. Valid personal ownership requires the current `clientProfileId` with `companyId = null`; valid company ownership requires the current membership `companyId` with `clientId = null`. Missing, foreign, orphan, and dual-owner records are excluded defensively.

## 5. Personal fleet behavior

Personal vehicles appear under `Моя техніка`. A client without company membership does not see a company section. Personal cards and detail pages do not expose owner IDs or staff-only metadata.

## 6. Company fleet behavior

Company vehicles appear under `Техніка компанії`, with the company name loaded from the database relation. The section is rendered only when the current client has active company membership.

## 7. Mixed membership behavior

Personal and company vehicles are returned from one scoped query and split into mutually exclusive groups. A client with both scopes sees both sections, and no vehicle can appear twice.

## 8. Vehicle list UX

The list now uses separate fleet sections, responsive cards, clear owner context in mixed mode, archive badges, an actionable empty state, and a stable one-to-three-column grid. Existing client vehicle creation remains available and was not expanded.

## 9. Vehicle card

Each card displays one image or fallback, equipment type, manufacturer/model, optional year, VIN or serial number, request count, archive state, and a clear detail action. Long labels and identifiers wrap without forcing global horizontal scrolling.

## 10. Primary image query

`getClientVehicleOverview` loads at most one image per vehicle, ordered by `isPrimary desc`, `sortOrder asc`, and `createdAt asc`. It does not fetch galleries or documents for the list and does not introduce N+1 queries.

## 11. Vehicle detail UX

The detail page now has back navigation, owner context, a stable title, equipment facts, optional client-visible note, gallery, visible documents, related requests, and selected-parts history. Existing edit/change-request controls remain available but secondary to the read experience. Archived vehicles remain visible with an archive badge to preserve existing history semantics; the new-request CTA is hidden for them.

## 12. Gallery

The reusable gallery shows the primary image first, ordered thumbnails, an active-image counter, keyboard-operable thumbnail buttons, stable aspect ratios, responsive horizontal thumbnail scrolling, and a broken-image fallback. Only the active detail image uses priority loading.

## 13. Vehicle documents

The detail query selects only vehicle documents with `visibleToClient = true` and no competing personal, company, or request owner. The UI shows original filename, type, size, date, and a secure client download link. Storage keys, Cloudinary identifiers, and private URLs are not selected or rendered.

## 14. `/client/documents` regression

The aggregate page keeps personal, company, vehicle, and request groups. Generic documents are assigned to exactly one group by context priority, preventing duplicates. All database queries remain access-scoped and visible-only, with minimal selects that omit private storage fields.

## 15. Client dashboard/navigation

The dashboard now shows the total accessible fleet count and a `Переглянути парк` link. Existing navigation labels remain unchanged. Active navigation links now expose `aria-current="page"`, including nested vehicle detail routes through the existing prefix matching.

## 16. Empty states

Added explicit states for an empty whole fleet, an empty company fleet, missing photos, missing vehicle documents, missing aggregate documents, missing related requests, and missing parts history. Empty personal sections are omitted when a company fleet exists to avoid visual clutter.

## 17. Loading/not-found/error behavior

Added list and detail skeletons, a secure vehicle not-found page, and a client fleet error boundary with retry. Foreign and missing vehicle IDs resolve through the scoped query to `notFound()` without confirming record existence. User-facing errors do not expose Prisma or storage details.

## 18. Query efficiency

The list uses one scoped Prisma query, one image per card, and request counts. The detail uses one scoped query with ordered images, visible documents, recent requests, and visible request items. The aggregate documents page uses three parallel, minimal, server-side queries.

## 19. Photo security regression

Photo metadata is returned only after the owning vehicle passes the existing personal/company access predicate. Client pages are read-only for image management. Foreign vehicle detail requests do not return gallery data.

## 20. Document security regression

Vehicle detail and aggregate queries exclude internal documents at query level. Existing secure download routes re-check CLIENT role, visibility, and exact personal/company ownership. Former company members lose access because membership is resolved from the database for each dynamic request.

## 21. Responsive QA

Layouts were reviewed against the requested 1440, 1280, 1024, 768, 430, 390, and 375 px constraints. Cards use responsive grid tracks, detail switches to one column below desktop, thumbnails scroll locally, filenames and VINs wrap, and actions stack on small screens. Authenticated visual browser verification remains part of the post-deploy smoke checklist.

## 22. Accessibility QA

Pages use semantic headings and sections, labelled navigation, visible focus states, textual status/owner labels, accessible image fallbacks, keyboard thumbnail controls, `aria-current`, status/error live roles, and download accessible names containing filenames.

## 23. Manual QA scenarios

Prepared scenarios cover personal-only, company-only, mixed membership, empty fleets, missing/broken photos, missing/visible/internal documents, foreign records, former membership, long values, and secure downloads. Static code inspection confirms the corresponding access predicates and UI states; authenticated role-by-role browser execution is still required after deployment.

## 24. Browser smoke status

Production build completed successfully. A local runtime probe confirmed that an unauthenticated request to `/client/vehicles` returns the expected `307` auth redirect without a server crash. Authenticated browser smoke for personal-only, company-only, and mixed clients was not claimed in this local pass because separate prepared sessions and records are required. The release smoke should cover list, detail, gallery, visible downloads, foreign URLs, and mobile widths on Vercel/staging.

## 25. Targeted checks

- `npx.cmd prisma validate` - passed.
- `npx.cmd prisma generate` - passed.
- `npx.cmd prisma migrate status` - passed; database schema is up to date.
- `npm.cmd run typecheck` - passed.
- `npm.cmd run lint` - passed.
- `npm.cmd run build` - passed.
- `git diff --check` - run before commit.

The repository has no `npm test` script, so no new test framework was introduced for this UX completion stage.

## 26. Prisma/migration status

Prisma schema was not changed. No migration was created or applied by Stage 9. The configured Neon database reports 23 migrations and an up-to-date schema.

## 27. Remaining gaps

- Complete authenticated browser smoke on Vercel/staging for personal-only, company-only, and mixed clients.
- Verify real secure downloads with existing safe test documents.
- Confirm visual behavior for broken remote images and long production filenames at the requested mobile widths.
- The pre-existing client create/edit flow remains unchanged and intentionally outside the completion scope.

## 28. Blocker for Stage 10

No code or database blocker was found for Stage 10. Authenticated Vercel/staging smoke remains the release verification gate, not a schema or implementation blocker.
