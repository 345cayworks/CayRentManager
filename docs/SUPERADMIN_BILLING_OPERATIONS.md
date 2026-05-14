# SuperAdmin Billing Operations Guide

## Overview

This guide provides SuperAdmins with operational procedures for managing subscription billing, invoices, and complimentary accounts in CayRentManager.

## Dashboard Navigation

### Platform Financials Card

The **Platform Financials** card on the SuperAdmin dashboard (`/admin`) provides quick access to subscription billing management.

**Location:** Dashboard → Platform Financials (💰 icon)
**URL:** `/admin/billing`

**What it shows:**
- Expected MRR (Monthly Recurring Revenue)
- Active subscribers
- Complimentary accounts
- Accounts needing attention (grace period, overdue)
- Subscription table with all landlord accounts

## Billing Management Page

### Summary Cards

The billing page displays four key metrics:

| Metric | Definition | Use Case |
|--------|-----------|----------|
| **Active Subscribers** | Count of subscriptions with status `ACTIVE` or `TRIAL` | Monitor active user base |
| **Complimentary** | Count of subscriptions with `isComplimentary = true` | Track free accounts |
| **Expected MRR** | Sum of plan amounts for active paid subscriptions | Forecast platform revenue |
| **Needs Attention** | Count of subscriptions in `GRACE_PERIOD` or `INACTIVE` status | Identify at-risk accounts |

### Subscription Table

The table displays all landlord subscriptions with the following columns:

| Column | Description |
|--------|-------------|
| **Landlord** | Display name of the landlord workspace |
| **Plan** | Subscription plan name (e.g., "Starter Landlord") |
| **Amount** | Monthly subscription price (e.g., "KYD 49.00") or "KYD 0 Complimentary" |
| **Status** | Subscription status with color coding |
| **Billing Dates** | Next invoice date, period end, and complimentary-until date |
| **Latest Invoice** | Most recent invoice number |
| **Payment** | Link to Fygaro payment portal (if applicable) |
| **Quick Actions** | Icon buttons for billing operations |

### Quick Actions

Each subscription row has icon buttons for common operations:

| Icon | Action | Applicable To | Purpose |
|------|--------|---------------|---------|
| 🧾 | Create Invoice | Paid subscriptions | Manually create an invoice if one is missing |
| 🔗 | Regenerate Fygaro Link | Paid subscriptions with invoices | Generate a new payment link (old link expires) |
| ✓ | Mark Paid | Subscriptions with invoices | Record a manual payment (e.g., bank transfer) |
| ⊘ | Waive Invoice | Unpaid invoices | Forgive an invoice (write-off) |
| ⏱ | Extend Billing Period | All subscriptions | Add 30 days to the subscription period |
| 🎁 | Make Complimentary | Paid subscriptions | Convert to free/complimentary account |
| 📅 | Extend Complimentary | Complimentary subscriptions | Extend the complimentary-until date |
| 💳 | Convert to Paid | Complimentary subscriptions | Convert a free account to paid |

## Common Operations

### Creating a New Landlord Account

**Goal:** Invite a new landlord and assign a subscription plan.

**Steps:**

1. Go to **Manage Landlords** (`/admin/landlords`)
2. Click **Invite Landlord**
3. Fill in:
   - Full Name
   - Email
   - Company Name
   - Phone (optional)
4. Click **Send Invitation**
5. Copy the temporary password
6. Share the invitation link and password with the landlord
7. Once the landlord accepts and logs in, their subscription will be created automatically

**Result:** Landlord is assigned the default active plan (currently "Starter Landlord" at KYD 49/month)

### Manually Creating an Invoice

**Goal:** Generate an invoice for a paid subscription if one is missing.

**When to use:**
- Subscription is overdue but no invoice was created
- Need to issue an invoice immediately instead of waiting for the scheduled date

**Steps:**

1. Go to **Platform Financials** (`/admin/billing`)
2. Find the landlord in the subscription table
3. Click the 🧾 (Create Invoice) icon
4. A modal appears confirming the action
5. Click **Create Invoice**
6. The invoice is created and a Fygaro payment link is generated

**Result:** New invoice appears in the table; landlord can pay via the Fygaro link

### Generating a Fygaro Payment Link

**Goal:** Create a new payment link for an existing invoice.

**When to use:**
- Payment link has expired
- Landlord lost the original link
- Need to resend the payment reminder

**Steps:**

1. Go to **Platform Financials** (`/admin/billing`)
2. Find the landlord in the subscription table
3. Click the 🔗 (Regenerate Fygaro Link) icon
4. A modal appears confirming the action
5. Click **Regenerate Link**
6. A new Fygaro payment link is generated

**Result:** New payment link is active; old link is invalidated

### Recording a Manual Payment

**Goal:** Mark an invoice as paid when payment is received outside of Fygaro (e.g., bank transfer, check).

**When to use:**
- Landlord paid via bank transfer
- Landlord paid via check or cash
- Payment was received but not automatically confirmed

**Steps:**

1. Go to **Platform Financials** (`/admin/billing`)
2. Find the landlord in the subscription table
3. Click the ✓ (Mark Paid) icon
4. A modal appears confirming the action
5. Click **Mark Paid**
6. The invoice is marked as `PAID`
7. Subscription is renewed for another 30 days

**Result:** Invoice is closed; subscription period is extended; next invoice is scheduled

### Waiving an Invoice

**Goal:** Forgive or write off an invoice (remove the payment obligation).

**When to use:**
- Landlord disputes the charge
- Error in billing
- Promotional discount or credit
- Account closure with outstanding balance

**Steps:**

1. Go to **Platform Financials** (`/admin/billing`)
2. Find the landlord in the subscription table
3. Click the ⊘ (Waive Invoice) icon
4. A modal appears confirming the action
5. Click **Waive Invoice**
6. The invoice is marked as `WAIVED`
7. Fygaro payment link is removed

**Result:** Invoice is closed; no payment is expected; landlord is not charged

### Extending the Billing Period

**Goal:** Add 30 days to a subscription without creating a new invoice.

**When to use:**
- Landlord requests a grace period
- Temporary account extension
- Adjustment before converting to complimentary

**Steps:**

1. Go to **Platform Financials** (`/admin/billing`)
2. Find the landlord in the subscription table
3. Click the ⏱ (Extend Billing Period) icon
4. A modal appears confirming the action
5. Click **Extend 30 Days**
6. Subscription period is extended by 30 days

**Result:** `currentPeriodEnd` is moved forward; next invoice date is also moved forward

### Making an Account Complimentary

**Goal:** Convert a paid subscription to a free/complimentary account.

**When to use:**
- Pilot program
- Founding landlord discount
- Account error or credit
- Promotional offer

**Steps:**

1. Go to **Platform Financials** (`/admin/billing`)
2. Find the landlord in the subscription table
3. Click the 🎁 (Make Complimentary) icon
4. A modal appears with two optional fields:
   - **Reason** (e.g., "Pilot account", "Founding landlord")
   - **Complimentary Until** (optional expiration date)
5. Fill in the reason and/or expiration date
6. Click **Make Complimentary**
7. Subscription status changes to `COMPLIMENTARY`
8. No invoices will be generated while complimentary

**Result:** Account is free; no billing; reason is logged for audit trail

### Extending Complimentary Access

**Goal:** Extend the end date of a complimentary subscription.

**When to use:**
- Pilot program is extended
- Promotional period is extended
- Account remains complimentary longer than originally planned

**Steps:**

1. Go to **Platform Financials** (`/admin/billing`)
2. Find the landlord in the subscription table (look for "COMPLIMENTARY" status)
3. Click the 📅 (Extend Complimentary) icon
4. A modal appears with a date field:
   - **Complimentary Until** (required)
5. Select the new expiration date
6. Click **Extend Complimentary**
7. The complimentary-until date is updated

**Result:** Complimentary account remains free until the new date; no invoices generated

### Converting Complimentary to Paid

**Goal:** Convert a free account back to a paid subscription.

**When to use:**
- Pilot program ends
- Promotional period expires
- Landlord requests to upgrade to paid

**Steps:**

1. Go to **Platform Financials** (`/admin/billing`)
2. Find the landlord in the subscription table (look for "COMPLIMENTARY" status)
3. Click the 💳 (Convert to Paid) icon
4. A modal appears confirming the action
5. Click **Convert to Paid**
6. Subscription status changes to `ACTIVE`
7. First paid invoice is created immediately
8. Invoice amount is based on the assigned plan

**Result:** Account is now paid; first invoice is generated; landlord can pay via Fygaro link

## Subscription Statuses

| Status | Meaning | Next Action |
|--------|---------|-------------|
| **ACTIVE** | Paid subscription with current access | Monitor for payment due |
| **TRIAL** | Free trial period (no invoice) | Monitor for trial end date |
| **COMPLIMENTARY** | Free account (no invoice) | Monitor for expiration or conversion |
| **GRACE_PERIOD** | Payment overdue but access retained | Follow up on payment; may convert to INACTIVE |
| **MANUAL_OVERRIDE** | Admin-set status (custom handling) | Verify reason and plan |
| **PAST_DUE** | Invoice significantly overdue | Consider account suspension or waiver |
| **INACTIVE** | Access revoked (no billing) | Contact landlord or reactivate |
| **CANCELLED** | Subscription terminated | Archive or reactivate if needed |

## Invoice Statuses

| Status | Meaning | Next Action |
|--------|---------|-------------|
| **OPEN** | Invoice issued, awaiting payment | Send payment reminder or Fygaro link |
| **PAID** | Payment received | Close invoice; renew subscription |
| **OVERDUE** | Payment not received by due date | Send follow-up reminder; consider grace period |
| **WAIVED** | Invoice forgiven (write-off) | Document reason in audit log |
| **PENDING_VERIFICATION** | Payment received but not yet verified | Wait for Fygaro confirmation |

## Pricing and Plans

### Current Subscription Plans

| Plan Code | Plan Name | Price | Interval |
|-----------|-----------|-------|----------|
| `STARTER` | Starter Landlord | KYD 49 | Monthly |
| `PROFESSIONAL` | Professional Landlord | KYD 79 | Monthly |
| `PROPERTY_MANAGER` | Property Manager | KYD 149 | Monthly |

### Assigning Plans

When creating a new landlord account, the **default plan** (first active plan by creation date) is automatically assigned.

**Current default:** Starter Landlord (KYD 49/month)

### Changing Plans

Currently, plan assignment is automatic and cannot be changed via the UI. To assign a different plan:

1. Contact the development team
2. Provide the landlord ID and desired plan code
3. A developer will update the database directly

**Future enhancement:** Plan management UI for SuperAdmins

## Troubleshooting

### Issue: Invoice not created for a paid subscription

**Cause:** Subscription may be complimentary or in an ineligible status.

**Solution:**
1. Check the subscription status in the table
2. If status is `COMPLIMENTARY`, convert to paid first
3. If status is `ACTIVE`, manually create an invoice using the 🧾 button

### Issue: Fygaro payment link is not working

**Cause:** Link may have expired or been regenerated.

**Solution:**
1. Click the 🔗 (Regenerate Fygaro Link) icon to create a new link
2. Share the new link with the landlord

### Issue: Landlord paid but invoice still shows OPEN

**Cause:** Payment confirmation may not have been received from Fygaro.

**Solution:**
1. Verify payment was actually received (check bank account)
2. If payment is confirmed, click the ✓ (Mark Paid) icon to manually record the payment
3. If payment was not received, follow up with the landlord

### Issue: Expected MRR is lower than expected

**Cause:** Complimentary accounts are excluded from Expected MRR.

**Solution:**
1. Check the "Complimentary" card to see how many free accounts exist
2. If accounts should be paid, convert them using the 💳 (Convert to Paid) button
3. If accounts should remain free, they will not contribute to MRR

### Issue: Landlord account is suspended but still appears in billing

**Cause:** Subscription status is independent of user account status.

**Solution:**
1. Subscription will continue to be billed unless manually changed
2. To stop billing, either:
   - Waive any outstanding invoices using the ⊘ button
   - Convert to complimentary using the 🎁 button
   - Contact development to cancel the subscription

## Audit Trail

All billing actions are logged in the **Audit Logs** section for compliance and troubleshooting.

**Access:** `/admin/audit`

**Logged Actions:**
- Invoice created
- Invoice paid (manual or automatic)
- Invoice waived
- Fygaro link regenerated
- Subscription converted to complimentary
- Subscription converted to paid
- Complimentary access extended
- Subscription period extended

## Best Practices

1. **Document reasons:** Always fill in the "Reason" field when making complimentary accounts
2. **Verify payments:** Before marking an invoice paid, verify the payment was actually received
3. **Monitor grace period:** Accounts in grace period should be contacted within 3-5 days
4. **Review MRR trends:** Check Expected MRR weekly to monitor platform revenue health
5. **Audit regularly:** Review audit logs monthly to catch billing errors
6. **Test before deploying:** Always test billing changes in staging before production

## Contact Support

For billing system issues or questions:

1. Check the **Troubleshooting** section above
2. Review the **Billing and Revenue Stabilization** documentation
3. Contact the development team with:
   - Landlord ID or email
   - Subscription ID (if known)
   - Description of the issue
   - Steps already taken
