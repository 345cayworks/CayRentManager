# Billing Phase 2 — Referral / Promo / Access Code System

Greenfield, additive layer on top of Phase 1's invoice-discount and
complimentary-subscription fields. Phase 2 does **not** touch registration,
identity sync, middleware, access enforcement, or subscription creation
(those remain Phase 3).

## Models & enums (`prisma/schema.prisma`)

Enums: `AccessCodeType` (PROMO, REFERRAL, PARTNER, INTERNAL, COMPLIMENTARY),
`AccessCodeRewardType` (PERCENT_DISCOUNT, FIXED_DISCOUNT, FREE_MONTHS,
TRIAL_EXTENSION, COMPLIMENTARY_ACCESS, ACCOUNT_CREDIT, UNIT_LIMIT_BONUS,
MANUAL_REVIEW), `AccessCodeStatus` (ACTIVE, PAUSED, EXPIRED, ARCHIVED),
`AccessCodeRedemptionStatus` (PENDING, APPLIED, REVERSED, REJECTED).

- `AccessCode` — the code definition: reward config, redemption limits,
  scheduling window, optional plan scoping, referrer fields. FK
  `appliesToPlanId → SubscriptionPlan(id)`.
- `AccessCodeRedemption` — a capture/use of a code. **Email-keyed**:
  `registrantEmail` is always set; `registrantUserId` / `registrantLandlordId`
  stay null until Phase 3 links them. FK `accessCodeId → AccessCode(id)`.

Migration `netlify/database/migrations/20260518000100_billing-phase2-access-codes/migration.sql`
is idempotent (DO-block enum guards, `CREATE TABLE IF NOT EXISTS`, indexes,
FKs). A **partial unique index**
`AccessCodeRedemption_code_email_pending (accessCodeId, registrantEmail) WHERE status='PENDING'`
prevents duplicate pending captures per code+email.

## Validation rules (`src/lib/billing/access-codes.ts`, pure, unit-tested)

`validateAccessCode` enforces, in order: status must be ACTIVE; `now` within
`[startsAt, expiresAt]`; `totalRedemptions < maxRedemptions` (null =
unlimited); `emailRedemptions < maxRedemptionsPerEmail`; `appliesToPlanId`
null or equal to the selected plan; self-referral blocked (referrer user or
landlord equals registrant); non-stackable rejected if another non-stackable
code is already applied. `describeRegistrantBenefit` renders a human preview.
`computeDiscountedInvoice` is the only place invoice math happens — money is
rounded to 2 decimals and never goes negative. Server-side
`src/lib/billing/access-code-lookup.ts` wraps it with the DB aggregation
(counts exclude REVERSED/REJECTED).

## Signup capture (best-effort, never blocks)

`src/components/identity-auth-form.tsx` (signup mode only) adds an optional
"Referral or promo code" input. A debounced call to
`POST /api/access-code/validate` shows a green preview or amber reason but
**never blocks submit**. After a successful Netlify `signup(...)` and before
`router.replace('/login?registered=1')`, the form calls
`POST /api/access-code/redeem-intent` inside a try/catch that swallows all
errors. There is no app user at signup time, so the redemption is keyed by
**email** with `status = PENDING`, and **no AuditLog is written** (AuditLog
requires a user actor). The endpoint is idempotent (P2002 from the partial
unique index = success) and never returns 500.

## SuperAdmin Growth center (`/admin/growth`)

Server component, `requireSuperadmin()`, tabbed via `?tab=`:
`promo|referral|partner|internal|complimentary` (code CRUD lists filtered by
type), `redemptions`, `rewards`. Added to `adminLinks` after Billing. Actions
in `src/server/access-code-actions.ts` (all `requireSuperadmin()`, audited,
`revalidatePath('/admin/growth')`):

- `createAccessCodeAction` / `updateAccessCodeAction` — code uppercased &
  trimmed, uniqueness enforced, reward config validated.
- `pauseAccessCodeAction`, `archiveAccessCodeAction`,
  `reactivateAccessCodeAction` (past `expiresAt` → EXPIRED).
- `applyAccessCodeToLandlordAction` — applies a code to an **existing**
  `LandlordSubscription` (this is how benefits are usable now without
  Phase 3), reusing Phase 1 fields:
  - PERCENT/FIXED discount → most-recent unpaid invoice gets
    `originalAmount`, `discountAmount`, `discountCode`, reduced `amount`
    (PAID_BY_PROMO when zero); no open invoice → noted as pending next
    invoice.
  - FREE_MONTHS → extend `currentPeriodEnd` via `computeRenewedPeriodEnd`,
    set `nextInvoiceAt`, create a zero-amount PAID_BY_PROMO invoice.
  - COMPLIMENTARY_ACCESS → `isComplimentary`, status COMPLIMENTARY,
    reason/until/byUserId.
  - ACCOUNT_CREDIT / UNIT_LIMIT_BONUS / TRIAL_EXTENSION / MANUAL_REVIEW →
    recorded as intent in `registrantBenefitApplied` + notes only.
- `reverseRedemptionAction` — best-effort undo (revert complimentary, restore
  discounted *unpaid* invoice); never claws back PAID invoices.
- `applyReferrerRewardAction` — manual referrer payout (FREE_MONTHS extend, or
  recorded intent). Self-referral hard-blocked here and in apply.

## Explicitly deferred to Phase 3

- Auto-applying captured PENDING codes when the landlord/user/subscription is
  created at registration (`registerPublicLandlord` / `syncIdentityUser`).
- Linking email-keyed PENDING redemptions to the newly created landlord/user.
- Automatic referrer payout on the registrant's first paid invoice.
- Any access-enforcement / `/billing-required` integration.
