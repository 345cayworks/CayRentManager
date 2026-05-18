-- Billing Phase 1: extend SubscriptionInvoiceStatus.
-- Idempotent: safe to run multiple times.

-- Add SENT/PAID_BY_PROMO/VOID to SubscriptionInvoiceStatus. ADD VALUE IF NOT
-- EXISTS is safe and the new values are only consumed at runtime (never in
-- this migration), so no transaction issue.
ALTER TYPE "SubscriptionInvoiceStatus" ADD VALUE IF NOT EXISTS 'SENT';
ALTER TYPE "SubscriptionInvoiceStatus" ADD VALUE IF NOT EXISTS 'PAID_BY_PROMO';
ALTER TYPE "SubscriptionInvoiceStatus" ADD VALUE IF NOT EXISTS 'VOID';
