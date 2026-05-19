# Billing Phase 3 — Subscription Bootstrap + Dark-Gated Enforcement

Phase 3 is the gated, highest-risk billing track. The single most important
rule: **nothing here may break login/signup or lock anyone out by default.**
Every new behavior in the auth path is best-effort/non-fatal, and access
enforcement is **shipped dark** behind an environment flag that defaults OFF.

## 1. Subscription bootstrap

`src/lib/billing/subscription-bootstrap.ts → ensureLandlordSubscription(db, landlordId, now?)`

- Creates a `LandlordSubscription` with `status = TRIAL` on the `STARTER`
  plan, a 30-day window (`currentPeriodStart/End`, `trialStartsAt/EndsAt`,
  `nextInvoiceAt = now + 30d`).
- **Idempotent**: if the landlord already has a subscription, the existing one
  is returned and nothing is created.
- **Non-fatal**: if the STARTER plan is missing or anything throws, it returns
  `null` and never raises. Callers run in the auth path.
- A TRIAL subscription has full access via `hasBillingAccess`, and the 30-day
  window means a freshly-enabled billing cron will not immediately invoice or
  deactivate a newly created landlord.

## 2. Creation hooks (both non-fatal)

- **`syncIdentityUser`** (`src/lib/identity/sync.ts`), `createdWorkspace`
  branch: inside the existing `$transaction`, after the `landlordProfile` is
  created, `ensureLandlordSubscription(tx, landlord.id)` is called in its own
  try/catch so the user + landlord still commit even if subscription creation
  fails. After commit, captured promo codes are linked (best-effort, separate
  try/catch). Return shape, audit rows, and other branches are unchanged.
- **`registerPublicLandlord`** (`src/lib/services/registration.ts`): same
  non-fatal bootstrap inside its `$transaction`; post-commit code-link is
  best-effort and only runs for a freshly created landlord.

Neither subscription nor redemption work can prevent user/landlord creation
or throw out of the auth path.

## 3. Captured access-code linking + benefit application

`src/lib/billing/access-code-apply.ts` (shared service, extracted from the
Phase 2 SuperAdmin actions):

- `applyRegistrantBenefitForRedemption(redemptionId, options?)` — the Phase 2
  registrant-benefit core: PERCENT/FIXED discount on an open invoice,
  FREE_MONTHS (extend period + zero `PAID_BY_PROMO` invoice),
  COMPLIMENTARY_ACCESS (set `isComplimentary` / `status COMPLIMENTARY` /
  reason / until), all others note-only; then redemption → `APPLIED` with
  links + `registrantBenefitApplied`. Idempotent (skips non-PENDING unless
  `force`).
- `applyReferrerRewardForRedemption(redemptionId, options?)` — Phase 2
  referrer-reward core; idempotent (no-op if `referrerBenefitApplied` set);
  hard self-referral block preserved.
- `linkCapturedRedemptionsForLandlord(landlordId, email, userId)` — finds
  `AccessCodeRedemption` rows with `registrantEmail = email.toLowerCase()`,
  `status = PENDING`, `registrantUserId IS NULL`; links
  `registrantUserId/registrantLandlordId/subscriptionId`; applies the
  registrant benefit per redemption (best-effort per row — one failure does
  not block the others or the caller). Returns the count linked.

The Phase 2 SuperAdmin actions (`applyAccessCodeToLandlordAction`,
`applyReferrerRewardAction`) now call this shared service. Their audits stay
in `src/server/access-code-actions.ts`; admin behavior is unchanged.

`syncIdentityUser` writes an `access_code_redeemed` audit (actor = the new
landlord owner user) only when at least one redemption was linked.

## 4. Referrer payout on the first paid invoice

`src/lib/billing/subscriptions.ts → markSubscriptionPaid`: after the existing
transaction/logic succeeds, a best-effort block (try/catch swallow — payment
confirmation can never fail because of this) checks whether this is the
subscription's first PAID invoice (`PAID` count === 1). If so it finds an
`AccessCodeRedemption` for the subscription with `status = APPLIED`,
`referrerUserId` not null, and `referrerBenefitApplied` null, calls
`applyReferrerRewardForRedemption`, and writes a `referral_reward_applied`
audit (actor = landlord owner). Self-referral is blocked inside the helper.

## 5. Access enforcement — SHIPPED DARK

`src/lib/billing/enforcement.ts` (pure):

- `billingEnforcementEnabled(env)` — true only when
  `BILLING_ENFORCEMENT_ENABLED === 'true'`.
- `shouldRedirectToBillingRequired({ enabled, subscription })` — false if
  disabled, no subscription, or complimentary. **Blocks ONLY when
  `status === 'INACTIVE'` and not complimentary.** PAST_DUE, GRACE_PERIOD,
  TRIAL, ACTIVE, CANCELLED, and no-subscription all pass.

Wired into `getCurrentLandlordWorkspace(options?: { skipBillingGate?: boolean })`
(`src/lib/auth/guards.ts`): after the active landlord is resolved and before
returning, if `!skipBillingGate && billingEnforcementEnabled()`, the
landlord's `LandlordSubscription` is loaded with a safe query (billing-table
errors via `isBillingTableMissingError` are treated as no subscription → not
blocked); if `shouldRedirectToBillingRequired` is true it redirects to
`/billing-required`. `requireRole` excludes SUPERADMIN, so SuperAdmin never
reaches this code.

**Loop prevention**: `src/app/billing-required/page.tsx` and
`src/app/account/billing/page.tsx` call
`getCurrentLandlordWorkspace({ skipBillingGate: true })` so a blocked landlord
can still reach the payment / billing pages. The skip is used nowhere else.

Default behavior is unchanged because `BILLING_ENFORCEMENT_ENABLED` is unset.

## 6. Backfill migration

`netlify/database/migrations/20260519000100_backfill-landlord-subscriptions/migration.sql`
— idempotent data-only migration: for every ACTIVE `LandlordProfile` with no
`LandlordSubscription`, insert a TRIAL subscription on the STARTER plan with a
30-day window. No schema changes. No-ops cleanly if the STARTER plan is
absent or all landlords already have a subscription.

## Required environment

- Existing Fygaro vars (unchanged): `FYGARO_BUTTON_URL`, `FYGARO_KID`,
  `FYGARO_PUBLIC_KEY`, `FYGARO_SECRET_KEY`, `FYGARO_WEBHOOK_SECRET`.
- **New: `BILLING_ENFORCEMENT_ENABLED`** — unset / any non-`"true"` value =
  enforcement OFF (default). `"true"` = enforcement ON. Ships OFF; it is not
  set anywhere in code or config.

## Operator rollout checklist

1. **Deploy** this branch (enforcement remains OFF — flag unset).
2. Confirm all migrations, **including the
   `20260519000100_backfill-landlord-subscriptions` backfill**, ran on the
   published Netlify deploy.
3. Confirm every active landlord now has a TRIAL `LandlordSubscription` and
   that SuperAdmin accounts are unaffected.
4. **ONLY THEN** set `BILLING_ENFORCEMENT_ENABLED=true` in the Netlify
   dashboard (no redeploy of code logic required; it is read at request time).
5. Verify: an INACTIVE non-complimentary landlord is redirected to
   `/billing-required`; PAST_DUE / GRACE_PERIOD / complimentary / no-subscription
   landlords are **not** blocked; SUPERADMIN is never blocked; the
   `/billing-required` and `/account/billing` pages remain reachable (no
   redirect loop).

To roll back enforcement, unset (or set to `false`)
`BILLING_ENFORCEMENT_ENABLED` in the Netlify dashboard — no code change.
