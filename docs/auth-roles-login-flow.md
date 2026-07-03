# Kairos Parts — Auth, Roles and Login Flow

## Login entry points

Kairos Parts uses one Auth.js / NextAuth credentials system and two separate login pages.

- `/login` is the client login page for `CLIENT` users.
- `/admin/login` is the staff login page for `MANAGER` and `ADMIN` users.

These pages do not create separate auth systems. Both submit to server actions that call the same Auth.js credentials provider.

## Public registration

Public registration is available only through `/register`.

Registration creates `CLIENT` accounts with a `ClientProfile`. Public users cannot create `MANAGER` or `ADMIN` accounts.

## Staff account creation

`MANAGER` and `ADMIN` users are created through controlled internal processes, currently via dev seed or direct administrative setup. Public registration must not create staff roles.

## Redirects after login

Client login:

- `CLIENT` on `/login` redirects to `/client`.
- `next=/client` is honored only for `CLIENT` users.
- `MANAGER` or `ADMIN` credentials on `/login` are rejected with a staff-login message.

Staff login:

- `MANAGER` on `/admin/login` redirects to `/admin`.
- `ADMIN` on `/admin/login` redirects to `/admin`.
- `CLIENT` credentials on `/admin/login` are rejected with a client-login message.

## Middleware protection

Middleware protects dashboard routes by role:

- `/client/*` is available only to `CLIENT`.
- `/admin/*` is available to `MANAGER` and `ADMIN`.
- `/admin/settings`, `/admin/categories`, and `/admin/manufacturers` are available only to `ADMIN`.
- `/admin/login` is a public route and is not protected by the CRM dashboard layout.

On production HTTPS, middleware reads the secure Auth.js cookie by enabling secure cookie lookup for `getToken`.

## Role mismatch behavior

Role mismatch is handled before dashboard access:

- A staff user cannot enter the client dashboard through `/login`.
- A client user cannot enter CRM through `/admin/login`.
- If an already authenticated user opens the wrong login page, middleware redirects them to the correct dashboard for their role.

This avoids redirect loops and keeps client and staff UX separate while preserving one shared Auth.js credentials provider.
