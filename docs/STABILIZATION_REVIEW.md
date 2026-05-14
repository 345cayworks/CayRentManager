# Stabilization Review — Issue #35

Date: 2026-05-13
Branch: `stabilization-pass`

## Scope

Fresh-eyes stabilization pass for CayRentManager billing, Prisma migrations, auth guards, shared shell, and Netlify deployment wiring. No new product features were added.

## Reviewed

- `prisma/schema.prisma`
- `prisma/migrations/20260513_billing_foundation/migration.sql`
- `scripts/netlify-prisma-migrate.mjs`
- `src/lib/auth/guards.ts`
- `src/lib/auth/workspace.ts`
- `src/lib/billing/policy.ts`
- `src/lib/billing/subscriptions.ts`
- `src/lib/billing/fygaro.ts`
- `src/lib/billing/safe-query.ts`
- `src/server/billing-actions.ts`
- `src/server/admin-billing-actions.ts`
- `src/app/(admin)/admin/billing/page.tsx`
- `src/app/account/billing/page.tsx`
- `src/components/shell.tsx`
- `netlify.toml`

## Findings and fixes

### Prisma migration recovery

The Netlify migration script previously attempted to resolve `20260513_billing_foundation` as rolled back on every deploy. That was useful during recovery but too broad for normal production deploys.

Fixed: the script now checks `prisma migrate status` first and only runs the rollback resolution when that specific migration appears failed.

### Billing schema and seed plans

The schema includes `SubscriptionPlan`, `LandlordSubscription`, `SubscriptionInvoice`, and `BillingPaymentEvent`. The billing migration creates the billing enums and tables defensively and seeds the default `STARTER`, `PROFESSIONAL`, and `PROPERTY_MANAGER` plans.

Live database verification is still required because this review only had source access.

### Missing billing cron

`netlify.toml` scheduled `billing-cron`, but the repository did not contain `netlify/functions/billing-cron.ts`. The existing scheduled function is `rent-ledger-automation.mts`, which is rent-ledger automation, not SaaS billing automation.

Fixed: removed the stale `billing-cron` schedule from `netlify.toml`.

Deferred: implement a real SaaS billing cron after the build is stable, using the centralized billing policy helper.

### Duplicate billing actions

`src/server/admin-billing-actions.ts` duplicated and drifted from the canonical `src/server/billing-actions.ts`. The admin billing page already imports `src/server/billing-actions.ts`.

Fixed: removed the duplicate action module so billing mutations stay centralized.

### Fygaro JWT key ID

Fygaro JWT creation now reads `FYGARO_KID` first and falls back to `FYGARO_PUBLIC_KEY` for compatibility.

### Complimentary subscription protection

`src/lib/billing/policy.ts` centralizes complimentary account checks. The canonical billing actions use this policy to prevent active complimentary subscriptions from receiving invoices or Fygaro links.

### Billing routes and shell

`/admin/billing` uses `Shell`, requires SuperAdmin access, and imports canonical billing actions.

`/account/billing` uses `Shell`, uses `getCurrentLandlordWorkspace()`, and loads records for the current landlord workspace only.

`src/components/shell.tsx` includes sidebar links for both `/admin/billing` and `/account/billing`.

## Required validation still pending

These commands still need to run in CI, Netlify, or a working checkout:

```bash
npx prisma generate
npx tsc --noEmit
npm run build
node scripts/netlify-prisma-migrate.mjs && npx prisma generate && npm run build
```

I could not run them in this environment because GitHub cloning and live Netlify database access were unavailable.

## Deferred

- Verify production `_prisma_migrations` state.
- Confirm billing tables and seeded plans in the live database.
- Implement a safe SaaS billing cron.
- Add tests for complimentary subscription handling.
- Add tests for `/admin/billing` and `/account/billing` access boundaries.
- Verify whether Prisma should remain on `^5.16.1` or move to the version expected by the handoff.
