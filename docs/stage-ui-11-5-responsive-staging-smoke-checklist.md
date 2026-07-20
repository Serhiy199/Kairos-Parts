# Stage UI 11.5 - Responsive staging smoke checklist

## Test roles

- ADMIN
- MANAGER
- CLIENT

Використовувати тільки staging/test accounts і sanitized records.

## Viewports

- [ ] 375 x 812
- [ ] 390 x 844
- [ ] 430 x 932
- [ ] 768 x 1024
- [ ] 820 x 1180
- [ ] 1024 x 768
- [ ] 1280 x 800
- [ ] 1440 x 900
- [ ] 1536 x 960
- [ ] 1920 x 1080

## Shared shell

- [ ] Below 1280px persistent sidebar is absent.
- [ ] Mobile top bar has logo and 44px menu button.
- [ ] Drawer opens without changing page width.
- [ ] Overlay click closes drawer.
- [ ] Escape closes drawer.
- [ ] Focus stays inside drawer while open.
- [ ] Focus returns to menu button after close.
- [ ] Selecting a nav link closes drawer.
- [ ] Body does not scroll behind drawer.
- [ ] Badges fit and show `99+` when required.
- [ ] From 1280px sidebar is persistent and 224px wide.
- [ ] From 1536px sidebar is 240px wide.
- [ ] Logout works for staff and client.
- [ ] No global horizontal scroll.

## ADMIN / MANAGER routes

- [ ] `/admin`
- [ ] `/admin/requests`
- [ ] `/admin/requests/[id]`
- [ ] `/admin/contact-messages`
- [ ] `/admin/contact-messages/[id]`
- [ ] `/admin/used-equipment/items`
- [ ] `/admin/used-equipment/items/new`
- [ ] `/admin/used-equipment/items/[id]/edit`
- [ ] `/admin/used-equipment/inquiries`
- [ ] `/admin/used-equipment/inquiries/[id]`
- [ ] `/admin/clients`
- [ ] `/admin/clients/[id]`
- [ ] `/admin/companies`
- [ ] `/admin/companies/[id]`
- [ ] `/admin/change-requests` as ADMIN
- [ ] `/admin/audit-log` as ADMIN
- [ ] `/admin/billing-settings`
- [ ] `/admin/directories/equipment-types`
- [ ] `/admin/directories/manufacturers`

For every list route:

- [ ] Cards are used below 1280px.
- [ ] Full table is used from 1280px.
- [ ] Primary action/status remains visible.
- [ ] Long values wrap without clipping.

## CLIENT routes

- [ ] `/client`
- [ ] `/client/requests`
- [ ] `/client/requests/[id]`
- [ ] `/client/vehicles`
- [ ] `/client/vehicles/new`
- [ ] `/client/vehicles/[id]`
- [ ] `/client/vehicles/[id]/photos`
- [ ] `/client/documents`
- [ ] `/client/change-requests`
- [ ] `/client/profile`

## Forms and actions

- [ ] Form fields are one column on mobile.
- [ ] Two-column forms do not clip at tablet/laptop widths.
- [ ] Labels, validation and helper text remain visible.
- [ ] Buttons wrap without overlap.
- [ ] Rich-text toolbar wraps and each control remains usable.
- [ ] Request and ChangeRequest actions submit unchanged payloads.

## Local overflow exceptions

- [ ] Invoice/line-item horizontal scroll is local to its card.
- [ ] Rich-text table scroll is local to editor/content.
- [ ] Gallery thumbnail scroll is local to gallery.
- [ ] Page/sidebar itself never scrolls horizontally.

## Accessibility

- [ ] Skip link is visible on keyboard focus.
- [ ] Active navigation uses `aria-current`.
- [ ] Drawer has an accessible name.
- [ ] Keyboard Tab order is coherent.
- [ ] Focus-visible styles are present.
- [ ] Status is communicated by text, not color only.

## Regression

- [ ] Role visibility is unchanged.
- [ ] Badge counts are unchanged.
- [ ] Logout redirects are unchanged.
- [ ] Print routes remain shell-free.
- [ ] Public pages are visually unchanged.
- [ ] No hydration, React key or controlled-input warnings.
