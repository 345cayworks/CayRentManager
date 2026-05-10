# CayRentManager

Next.js production rewrite for CayRentManager, built with App Router, Prisma, PostgreSQL, Netlify Database, and Netlify Identity.

## Rescue status

Classification: **B. Mostly placeholder shell, but salvageable.**

The repo now has a real database foundation, Netlify Identity login and app-user sync, server-side authorization helpers, seed data, and database-backed MVP pages for the first landlord workflow. Some secondary pages remain thin and need the next build phase before full production launch.

## Setup

```bash
npm install
npx prisma generate
npm run build
npm test
```

For a database-backed local run:

```bash
npx prisma migrate deploy
npx prisma db seed
npm run dev
```

## Required Netlify environment variables

- `DATABASE_URL`
- `APP_SESSION_SECRET`
- `NEXT_PUBLIC_APP_URL`
- `SUPER_ADMIN_EMAIL`
- `SUPERADMIN_MASTER_KEY`

Only `NEXT_PUBLIC_APP_URL` is public. Do not prefix secrets with `NEXT_PUBLIC_`.

Use a long random value for `APP_SESSION_SECRET`. Enable Netlify Identity in the Netlify UI for the `cayrentmanager` site and keep public registration enabled while landlord self-signup is open.

## MVP Netlify Identity setup

Recommended MVP setting:

- Use invite-only or controlled registration while testing.
- Manually create or invite `info@cayworks.com` in Netlify Identity.
- Confirm/verify the Identity user in the Netlify dashboard if possible.
- If confirmation emails are unreliable, temporarily disable required email confirmation for MVP QA.
- After login succeeds, the app bootstraps `info@cayworks.com` as `SUPERADMIN`.

To prepare the app-side Superadmin profile, run:

```bash
node scripts/bootstrap-owner.mjs
```

Run this only after the Netlify Identity user exists or before first login to prepare the app-side Superadmin profile. This script does not create the Netlify Identity login account and never stores passwords in Prisma.

Emergency owner bootstrap endpoint:

- `POST /api/admin/bootstrap-owner` is an emergency repair endpoint only. It is not the normal login system.
- The request body must include `{ "masterKey": "..." }`.
- The endpoint reads `SUPER_ADMIN_EMAIL` and `SUPERADMIN_MASTER_KEY` from server environment variables.
- Use a long random value for `SUPERADMIN_MASTER_KEY`.
- The master key must never be committed, printed, stored in the database, or exposed with `NEXT_PUBLIC_`.
- Disable or remove this endpoint after the owner is confirmed if desired.
- Normal app access still requires Netlify Identity login.

## Auth model

This rewrite uses **Netlify Identity** for authentication and Prisma for app roles, workspaces, tenant records, payments, expenses, leases, audit logs, and dashboards.

- Login, registration, logout, and password recovery are handled by Netlify Identity.
- After Identity login, the app syncs the Identity user to a Prisma `User` and creates a signed app session cookie.
- App database roles and statuses are the source of truth.
- `info@cayworks.com` is bootstrapped server-side as `SUPERADMIN` and `ACTIVE`.
- The primary Superadmin email `info@cayworks.com` must be confirmed in Netlify Identity before it can bootstrap as `SUPERADMIN` in the app through normal login.
- Disabled users are blocked by the app session bridge and server guards.
- Public registration creates `LANDLORD` users and workspaces only.
- Tenant onboarding requires `/invite/[token]`.

## MVP workflow now wired

- `/admin`
- `/admin/users`
- `/admin/landlords`
- `/dashboard`
- `/properties`
- `/units`
- `/tenants`
- `/leases`
- `/payments`
- `/expenses`
- `/invite/[token]`
- `/tenant/dashboard`

Core mutations use server actions and derive workspace access server-side. They do not trust client-submitted role, user id, tenant id, or landlord id as an authority.

## Data lifecycle

Production records should not be hard-deleted. Use:

- disable/reactivate for users
- archive for landlords/properties/units/documents
- deactivate for tenants
- terminate for leases
- void for payments/expenses
- close/archive for maintenance

Lifecycle actions should write `AuditLog` entries. The first MVP create/record flows already write audit logs.

## Demo seed

The seed script creates:

- Superadmin: `info@cayworks.com`
- Landlord A and Landlord B
- Separate properties, units, tenants, leases, payments, and expenses

Demo passwords are not committed. Use Netlify Identity accounts for login, and seed data only for app records and isolation checks.

## Manual QA checklist

- `npm install` completes without ETARGET errors.
- `npx prisma generate` succeeds.
- `npm run build` passes.
- `npm test` passes.
- `info@cayworks.com` becomes `SUPERADMIN`.
- Landlord registration creates a workspace and membership.
- Tenant invite token creates a tenant account only for the invited email.
- Landlord A cannot query or mutate Landlord B records through server actions.
- Tenant A cannot see Tenant B dashboard data.
- Disabled users are blocked.
- Public registration has no role selection.
- Payments and expenses are voided, not hard-deleted.
