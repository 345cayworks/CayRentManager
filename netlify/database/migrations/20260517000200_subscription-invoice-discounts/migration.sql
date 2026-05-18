-- Billing Phase 1: SubscriptionInvoice discount snapshot columns.
-- Idempotent: safe to run multiple times.

ALTER TABLE "SubscriptionInvoice"
  ADD COLUMN IF NOT EXISTS "originalAmount" DECIMAL(65,30),
  ADD COLUMN IF NOT EXISTS "discountAmount" DECIMAL(65,30) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "discountCode" TEXT;
