# Billing and Revenue Stabilization

## Overview

CayRentManager manages subscription billing for landlord accounts. This document defines the architecture, pricing source of truth, revenue metrics, and the role of external payment processors.

## Architecture Principles

### 1. CayRentManager Owns Subscription Pricing

**CayRentManager is the internal source of truth for subscription pricing.** All pricing decisions, plan definitions, and pricing changes are managed within the platform.

- **SubscriptionPlan** table stores plan definitions: code, name, amount, currency, interval, and status.
- **LandlordSubscription** links each landlord to an assigned plan and tracks subscription lifecycle (active, complimentary, trial, grace period, etc.).
- **SubscriptionInvoice** snapshots the plan amount and currency at the time an invoice is created, ensuring historical invoices are immutable.

### 2. Fygaro is the Payment Processing Layer

**Fygaro is NOT the source of pricing.** Fygaro is used only for:

- Generating secure, locked JWT payment links
- Processing payments
- Confirming payment status via webhooks

**Fygaro does not determine, override, or influence subscription pricing.** All pricing is determined by CayRentManager's SubscriptionPlan.

### 3. Invoice Snapshots Protect Historical Data

When an invoice is created:

1. The current plan amount and currency are read from `subscription.plan`.
2. Both values are **snapshot into** `SubscriptionInvoice.amount` and `SubscriptionInvoice.currency`.
3. Future changes to the plan price do **not** affect existing invoices.
4. Fygaro payment links are generated from the invoice snapshot, not the current plan.

**Result:** Historical invoices remain accurate and immutable, even if plan pricing changes.

## Pricing Source of Truth

### SubscriptionPlan

| Field | Purpose | Notes |
|-------|---------|-------|
| `code` | Unique plan identifier | e.g., `STARTER`, `PROFESSIONAL`, `PROPERTY_MANAGER` |
| `name` | Human-readable plan name | e.g., "Starter Landlord" |
| `amount` | Monthly subscription price | Decimal; e.g., 49 (KYD) |
| `currency` | Currency code | Default: `KYD` |
| `intervalMonths` | Billing interval | Default: 1 (monthly) |
| `status` | Plan availability | `ACTIVE` or `INACTIVE` |

### Current Plans

| Code | Name | Amount | Currency | Interval |
|------|------|--------|----------|----------|
| `STARTER` | Starter Landlord | 49 | KYD | 1 month |
| `PROFESSIONAL` | Professional Landlord | 79 | KYD | 1 month |
| `PROPERTY_MANAGER` | Property Manager | 149 | KYD | 1 month |

### Adding or Changing Plans

To add or change subscription plans:

1. **Create a new migration** that inserts or updates rows in the `SubscriptionPlan` table.
2. **Do not edit existing migrations** that have already been applied to production.
3. **Document the reason** for the change in the migration comments.
4. **Communicate the change** to SuperAdmins so they understand the new pricing.

Example migration:

```sql
-- Add a new ENTERPRISE plan
INSERT INTO "SubscriptionPlan" ("id", "code", "name", "amount", "currency", "intervalMonths", "status", "createdAt", "updatedAt")
VALUES
  ('plan_enterprise_default', 'ENTERPRISE', 'Enterprise Landlord', 199, 'KYD', 1, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
```

## Subscription Lifecycle

### Paid Subscription Flow

1. **Create Subscription**: SuperAdmin creates a landlord account and assigns a plan.
   - `LandlordSubscription.status` = `ACTIVE`
   - `LandlordSubscription.isComplimentary` = `false`
   - `LandlordSubscription.nextInvoiceAt` = current date + 30 days

2. **Generate Invoice**: When `nextInvoiceAt` is reached:
   - `createInvoiceForSubscription()` is called.
   - Invoice amount is **snapshot from** `subscription.plan.amount`.
   - Invoice currency is **snapshot from** `subscription.plan.currency`.
   - `SubscriptionInvoice.status` = `OPEN`
   - Fygaro payment link is generated using the invoice snapshot.

3. **Payment Received**: When payment is confirmed:
   - `markSubscriptionPaid()` is called.
   - `SubscriptionInvoice.status` = `PAID`
   - `LandlordSubscription.status` = `ACTIVE` (renewed)
   - `LandlordSubscription.currentPeriodEnd` = now + 30 days
   - `LandlordSubscription.nextInvoiceAt` = now + 30 days

4. **Payment Overdue**: If payment is not received by the due date:
   - `SubscriptionInvoice.status` = `OVERDUE`
   - `LandlordSubscription.status` = `GRACE_PERIOD` (optional, configurable)
   - Landlord retains access but is flagged for follow-up.

### Complimentary Subscription Flow

1. **Make Complimentary**: SuperAdmin marks a subscription as complimentary.
   - `LandlordSubscription.status` = `COMPLIMENTARY`
   - `LandlordSubscription.isComplimentary` = `true`
   - `LandlordSubscription.nextInvoiceAt` = `null` (no invoices generated)
   - `LandlordSubscription.complimentaryReason` = reason (e.g., "Pilot account")
   - `LandlordSubscription.complimentaryUntil` = optional expiration date

2. **No Invoices**: Complimentary subscriptions do **not** generate invoices.
   - `shouldGenerateSubscriptionInvoice()` returns `false` for complimentary accounts.
   - Fygaro payment links are **not** generated.

3. **Convert to Paid**: SuperAdmin converts complimentary account to paid.
   - `LandlordSubscription.status` = `ACTIVE`
   - `LandlordSubscription.isComplimentary` = `false`
   - First paid invoice is created immediately.
   - Amount is snapshot from the assigned plan.

## Revenue Metrics

### Expected MRR (Monthly Recurring Revenue)

**Definition:** Sum of `SubscriptionPlan.amount` for all active paid subscriptions.

**Calculation:**
```
Expected MRR = SUM(subscription.plan.amount) 
WHERE subscription.status IN ('ACTIVE', 'TRIAL')
  AND subscription.isComplimentary = false
```

**Use Case:** Forecast of expected platform revenue if all paid subscriptions remain active.

**Note:** Complimentary subscriptions are **excluded** from Expected MRR.

### Billed Revenue

**Definition:** Sum of `SubscriptionInvoice.amount` for all invoices with status `PAID`.

**Calculation:**
```
Billed Revenue = SUM(invoice.amount) 
WHERE invoice.status = 'PAID'
```

**Use Case:** Actual revenue collected from landlords.

### Outstanding Revenue

**Definition:** Sum of `SubscriptionInvoice.amount` for all invoices with status `OPEN` or `OVERDUE`.

**Calculation:**
```
Outstanding Revenue = SUM(invoice.amount) 
WHERE invoice.status IN ('OPEN', 'OVERDUE')
```

**Use Case:** Revenue at risk; invoices awaiting payment.

### Waived Revenue

**Definition:** Sum of `SubscriptionInvoice.amount` for all invoices with status `WAIVED`.

**Calculation:**
```
Waived Revenue = SUM(invoice.amount) 
WHERE invoice.status = 'WAIVED'
```

**Use Case:** Revenue forgiven or written off.

### Comped MRR Value

**Definition:** Sum of `SubscriptionPlan.amount` for all active complimentary subscriptions.

**Calculation:**
```
Comped MRR Value = SUM(subscription.plan.amount) 
WHERE subscription.status = 'COMPLIMENTARY'
  AND subscription.isComplimentary = true
```

**Use Case:** Value of complimentary accounts; shows potential revenue if accounts were converted to paid.

### Complimentary Accounts

**Definition:** Count of active complimentary subscriptions.

**Calculation:**
```
Complimentary Accounts = COUNT(*) 
WHERE subscription.status = 'COMPLIMENTARY'
  AND subscription.isComplimentary = true
```

**Use Case:** Tracking number of free accounts.

## Fygaro Integration

### Generating Fygaro Payment Links

**Location:** `src/lib/billing/fygaro.ts`

**Function:** `createFygaroPaymentUrl(invoice)`

**Input:** `SubscriptionInvoice` object with:
- `amount`: Decimal amount (snapshot from plan)
- `currency`: Currency code (snapshot from plan)
- `invoiceNumber`: Unique invoice reference
- `dueDate`: Invoice due date

**Output:** Secure JWT-locked Fygaro payment link

**Important:** The function uses `invoice.amount` and `invoice.currency`, **not** the current plan values. This ensures that:

1. Fygaro receives the exact amount that was invoiced.
2. If plan pricing changes, existing payment links remain valid.
3. Historical accuracy is preserved.

### Webhook Handling

When Fygaro confirms a payment:

1. **Webhook received** at `/api/billing/fygaro/webhook`
2. **Signature verified** using `FYGARO_WEBHOOK_SECRET`
3. **Invoice marked paid** via `markSubscriptionPaid()`
4. **Subscription renewed** with new period dates
5. **Payment event logged** in `BillingPaymentEvent`

## Server Actions and Business Logic

### convertToPaidAction

**Location:** `src/server/billing-actions.ts`

**Purpose:** Convert a complimentary subscription to paid.

**Flow:**
1. Load subscription with plan
2. Set status to `ACTIVE`, clear complimentary flags
3. Call `createInvoiceForSubscription()` to generate first paid invoice
4. Invoice amount is snapshot from plan

**Important:** The action does **not** manually set an amount. It relies on `createInvoiceForSubscription()` to snapshot the plan amount.

### createInvoiceForSubscription

**Location:** `src/lib/billing/subscriptions.ts`

**Purpose:** Generate an invoice for a paid subscription.

**Flow:**
1. Load subscription with plan
2. Verify subscription is not complimentary
3. Read `subscription.plan.amount` and `subscription.plan.currency`
4. Create `SubscriptionInvoice` with snapshot values
5. Generate Fygaro payment link if applicable

**Important:** The function reads from the **current plan** at invoice creation time. Future plan changes do not affect this invoice.

## Preventing Regressions

### Code Review Checklist

When reviewing billing changes:

- [ ] Is pricing always read from `SubscriptionPlan`?
- [ ] Are invoices snapshot with plan amount and currency?
- [ ] Does Fygaro use `invoice.amount`, not `plan.amount` directly?
- [ ] Are complimentary subscriptions excluded from Expected MRR?
- [ ] Are historical invoices immutable after creation?
- [ ] Is there a migration (not a direct schema edit) for plan changes?

### Testing

Before deploying billing changes:

1. **Type check:** `npx tsc --noEmit`
2. **Build:** `npm run build`
3. **Lint:** `npm run lint`
4. **Manual QA:**
   - Create a paid subscription and verify invoice amount matches plan
   - Create a complimentary subscription and verify no invoice is generated
   - Convert complimentary to paid and verify first invoice uses plan amount
   - Change a plan price and verify new invoices use new price, old invoices unchanged
   - Verify Fygaro link uses invoice amount, not plan amount

## Future Enhancements

### Plan Management UI

**Goal:** Allow SuperAdmins to create and modify subscription plans from the platform.

**Scope:**
- View all subscription plans
- Create new plans
- Update plan amount and currency
- Deactivate plans
- View subscription count per plan

**Implementation:** Add `/admin/billing/plans` route with plan CRUD forms.

### Sync with Fygaro

**Goal:** Optionally sync plan metadata with Fygaro (if Fygaro product API is available).

**Scope:**
- Pull Fygaro product IDs and metadata
- Store in `SubscriptionPlan` as optional fields
- Use for audit and reconciliation

**Implementation:** Add optional Fygaro sync fields to schema and implement sync endpoint.

### Revenue Dashboard

**Goal:** Provide detailed revenue analytics and trends.

**Scope:**
- Monthly revenue trends
- Churn analysis
- Lifetime value (LTV) per landlord
- Cohort analysis

**Implementation:** Add `/admin/financials` with advanced charts and filters.

## Troubleshooting

### Issue: Invoices show wrong amount

**Cause:** Likely reading from current plan instead of invoice snapshot.

**Fix:** Verify invoice generation uses `invoice.amount`, not `subscription.plan.amount`.

### Issue: Fygaro links fail with amount mismatch

**Cause:** Fygaro is receiving a different amount than expected.

**Fix:** Verify `createFygaroPaymentUrl()` is called with the `SubscriptionInvoice` object, not plan data.

### Issue: Plan price change affects old invoices

**Cause:** Invoices are not properly snapshot; they reference plan by ID instead of storing amount.

**Fix:** Verify `SubscriptionInvoice.amount` and `SubscriptionInvoice.currency` are populated at creation time.

### Issue: Complimentary accounts appear in revenue calculations

**Cause:** Revenue queries not filtering by `isComplimentary = false`.

**Fix:** Add filter to exclude complimentary subscriptions from Expected MRR and other paid-only metrics.

## References

- **Schema:** `prisma/schema.prisma` (lines 282-357)
- **Migrations:** `prisma/migrations/20260513_billing_foundation/migration.sql`
- **Server Actions:** `src/server/billing-actions.ts`
- **Subscription Logic:** `src/lib/billing/subscriptions.ts`
- **Fygaro Integration:** `src/lib/billing/fygaro.ts`
- **Billing Policy:** `src/lib/billing/policy.ts`
- **Admin UI:** `src/components/admin/billing-management-client.tsx`
- **Billing Page:** `src/app/(admin)/admin/billing/page.tsx`
