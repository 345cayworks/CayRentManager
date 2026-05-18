# Billing — Phase 1 (Additive Hardening)

Phase 1 is deliberately low-risk and strictly additive. It does not change
registration, access enforcement, middleware, or the `/billing-required`
redirect, and it does not backfill subscriptions. Those are Phase 3. Access
codes / referrals / promos / `/admin/growth` are Phase 2.

## What shipped

### Legal cleanup
- Removed the `Draft — review by counsel before public launch` amber badge
  from `src/app/terms/page.tsx` and `src/app/privacy/page.tsx`. All legal
  sections, the `<h1>`, and footer/nav links are unchanged. Both pages still
  prerender as static routes.

### Schema + plan catalog
- `SubscriptionPlan` gained `minUnits Int?` and `maxUnits Int?`
  (`maxUnits = null` means an open-ended top tier).
- The 3 official plans are idempotently provisioned (migration + seed):

  | code             | name             | amount (KYD) | intervalMonths | minUnits | maxUnits |
  |------------------|------------------|--------------|----------------|----------|----------|
  | STARTER          | Starter          | 49.00        | 1              | 1        | 4        |
  | PROFESSIONAL     | Professional     | 99.00        | 1              | 5        | 10       |
  | PROPERTY_MANAGER | Property Manager | 149.00       | 1              | 11       | (none)   |

  Stable ids (`plan_starter_default`, `plan_professional_default`,
  `plan_property_manager_default`) are shared between the migration and
  `prisma/seed.ts` so re-running either never duplicates rows.

- `SubscriptionInvoice` gained `originalAmount Decimal?`,
  `discountAmount Decimal? @default(0)`, `discountCode String?` (snapshot
  columns; not consumed by Phase 1 logic — reserved for Phase 2 promos).
- `SubscriptionInvoiceStatus` gained `SENT`, `PAID_BY_PROMO`, `VOID`
  (appended; existing order/values unchanged). The legacy tenant-rent
  `InvoiceStatus` enum is untouched.

### Plan / unit rules (pure)
`src/lib/billing/plan-rules.ts`:
- `planMatchesUnitCount(plan, unitCount)` — range containment.
- `recommendPlanForUnits(unitCount, plans)` — lowest matching ACTIVE plan;
  `null` when nothing matches (incl. `unitCount < 1`).
- `computeRenewedPeriodEnd(currentPeriodEnd, intervalMonths, now)` — future
  end extends from the end; expired end extends from now; real UTC month
  math with month-length clamping and year rollover.

These are wired **non-blocking** into `changeSubscriptionPlanAction`: if a
`unitCount` form field is supplied and the target plan does not match, the
change still proceeds (SuperAdmin override) and a
`{ planMismatch, unitCount, recommended }` note is added to the audit
`details`. Pricing always derives from `SubscriptionPlan.amount`; the
browser amount is never trusted.

### Payment math
`markSubscriptionPaid` now loads the invoice → subscription → plan and uses
`computeRenewedPeriodEnd` (default `intervalMonths = 1`). It sets
`currentPeriodStart = now`, `currentPeriodEnd = nextInvoiceAt = newEnd`,
`status = ACTIVE`, `gracePeriodEndsAt = null`, keeps the owner →
`ACTIVE` user update and the `BillingPaymentEvent`, and writes an
`invoice_marked_paid` `AuditLog` row.

### Cron hardening
`netlify/functions/billing-cron.mts`:
- `export const config = { schedule: '0 6 * * *' }` — modern Netlify
  scheduled function. **Scheduled functions only run on published
  production deploys** (never on branch/deploy previews).
- Pass 0: expired-complimentary resume (`isComplimentary=true` &&
  `complimentaryUntil <= now`) → `isComplimentary=false`, `status=ACTIVE`,
  `nextInvoiceAt=now`, `complimentary_access_expired` audit. Runs first.
- Invoice pass and overdue/grace pass explicitly skip any subscription
  with `isComplimentary === true` or `status === COMPLIMENTARY`.
- A SuperAdmin owner user is never flipped to `INACTIVE` (the subscription
  may still be marked INACTIVE; the platform owner keeps access).
- Each subscription's processing is wrapped in try/catch so one bad row
  (e.g. missing/invalid plan) logs and continues instead of aborting the
  whole run.

## Migrations (3)

Applied in order; all idempotent:

1. `netlify/database/migrations/20260517000100_subscription-plan-unit-ranges/migration.sql`
   — adds `minUnits`/`maxUnits`, upserts the 3 official plans
   (`ON CONFLICT ("code") DO UPDATE`).
2. `netlify/database/migrations/20260517000200_subscription-invoice-discounts/migration.sql`
   — adds `originalAmount`/`discountAmount`/`discountCode`.
3. `netlify/database/migrations/20260517000300_subscription-invoice-status-values/migration.sql`
   — `ALTER TYPE "SubscriptionInvoiceStatus" ADD VALUE IF NOT EXISTS`
   for `SENT`, `PAID_BY_PROMO`, `VOID` (new values consumed only at
   runtime, so no in-transaction enum-use hazard).

`prisma/schema.prisma` is kept in sync; `prisma/seed.ts` upserts the same
3 plans so a local `prisma db seed` matches production.

## Required environment variables

| Variable | Purpose |
|----------|---------|
| `FYGARO_BUTTON_URL` | Base Fygaro payment button URL |
| `FYGARO_SECRET_KEY` | Fygaro JWT signing secret |
| `FYGARO_KID` or `FYGARO_PUBLIC_KEY` | Fygaro key id / public key for JWT |
| `FYGARO_WEBHOOK_SECRET` | Validates inbound Fygaro webhook |
| `NEXT_PUBLIC_APP_URL` | Canonical app base URL (return/links) |

Documentation item (not wired in Phase 1): `FYGARO_CURRENCY` is currently
**unused** — invoice currency derives from `SubscriptionPlan.currency`
(KYD). Do not wire it in Phase 1; flagged here for future cleanup.

## Manual QA checklist

- [ ] `/terms` and `/privacy` render with all legal sections and **no**
      draft banner; footer/nav links still work.
- [ ] After running migrations (or `prisma db seed`), exactly the 3
      official plans exist with the amounts/unit ranges above.
- [ ] Re-running the plan migration or seed does not duplicate plans.
- [ ] `billing-cron` does not invoice, overdue, grace, or inactivate any
      complimentary subscription (`isComplimentary` true or status
      `COMPLIMENTARY`).
- [ ] A complimentary subscription past `complimentaryUntil` resumes
      (`isComplimentary=false`, `status=ACTIVE`, `nextInvoiceAt=now`) with
      a `complimentary_access_expired` audit row.
- [ ] Paying an invoice extends the period by `plan.intervalMonths`:
      future `currentPeriodEnd` extends from the end; expired one extends
      from now. An `invoice_marked_paid` audit row is written.
- [ ] A SuperAdmin owner is never set to `INACTIVE` by the cron even when
      their subscription lapses.
- [ ] Changing a plan with a mismatched `unitCount` still succeeds and the
      audit `details` records `planMismatch`/`recommended`.

## Deferred

- **Phase 2**: access codes, referrals, promos, `/admin/growth`,
  discount application using the new `SubscriptionInvoice` discount columns
  and `PAID_BY_PROMO` status.
- **Phase 3**: subscription creation at registration, access enforcement /
  `/billing-required` redirect / middleware, subscription backfill for
  existing landlords.
