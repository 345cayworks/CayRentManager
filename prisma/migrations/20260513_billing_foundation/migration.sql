-- Billing foundation tables for CayRentManager SaaS subscription management.
-- This migration is intentionally defensive because some billing enums/models were added
-- to schema.prisma before the production database received the physical tables.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'SubscriptionStatus'
  ) THEN
    CREATE TYPE "SubscriptionStatus" AS ENUM (
      'TRIAL',
      'ACTIVE',
      'COMPLIMENTARY',
      'MANUAL_OVERRIDE',
      'PAST_DUE',
      'GRACE_PERIOD',
      'INACTIVE',
      'CANCELLED'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'SubscriptionInvoiceStatus'
  ) THEN
    CREATE TYPE "SubscriptionInvoiceStatus" AS ENUM (
      'DRAFT',
      'OPEN',
      'PAID',
      'WAIVED',
      'OVERDUE',
      'PENDING_VERIFICATION'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "SubscriptionPlan" (
  "id" TEXT NOT NULL,
  "code" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "amount" DECIMAL(65,30) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'KYD',
  "intervalMonths" INTEGER NOT NULL DEFAULT 1,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SubscriptionPlan_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionPlan_code_key" ON "SubscriptionPlan"("code");

CREATE TABLE IF NOT EXISTS "LandlordSubscription" (
  "id" TEXT NOT NULL,
  "landlordId" TEXT NOT NULL,
  "planId" TEXT NOT NULL,
  "status" "SubscriptionStatus" NOT NULL DEFAULT 'ACTIVE',
  "currentPeriodStart" TIMESTAMP(3) NOT NULL,
  "currentPeriodEnd" TIMESTAMP(3) NOT NULL,
  "nextInvoiceAt" TIMESTAMP(3),
  "gracePeriodEndsAt" TIMESTAMP(3),
  "isComplimentary" BOOLEAN NOT NULL DEFAULT false,
  "complimentarySeats" INTEGER NOT NULL DEFAULT 0,
  "complimentaryReason" TEXT,
  "complimentaryUntil" TIMESTAMP(3),
  "complimentaryByUserId" TEXT,
  "trialStartsAt" TIMESTAMP(3),
  "trialEndsAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "LandlordSubscription_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LandlordSubscription_landlordId_key" ON "LandlordSubscription"("landlordId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LandlordSubscription_landlordId_fkey'
  ) THEN
    ALTER TABLE "LandlordSubscription"
    ADD CONSTRAINT "LandlordSubscription_landlordId_fkey"
    FOREIGN KEY ("landlordId") REFERENCES "LandlordProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LandlordSubscription_planId_fkey'
  ) THEN
    ALTER TABLE "LandlordSubscription"
    ADD CONSTRAINT "LandlordSubscription_planId_fkey"
    FOREIGN KEY ("planId") REFERENCES "SubscriptionPlan"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "SubscriptionInvoice" (
  "id" TEXT NOT NULL,
  "subscriptionId" TEXT NOT NULL,
  "landlordId" TEXT NOT NULL,
  "invoiceNumber" TEXT NOT NULL,
  "amount" DECIMAL(65,30) NOT NULL,
  "currency" TEXT NOT NULL DEFAULT 'KYD',
  "status" "SubscriptionInvoiceStatus" NOT NULL DEFAULT 'OPEN',
  "dueDate" TIMESTAMP(3) NOT NULL,
  "paidAt" TIMESTAMP(3),
  "waivedAt" TIMESTAMP(3),
  "fygaroCustomRef" TEXT,
  "fygaroPaymentUrl" TEXT,
  "fygaroPaymentId" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "SubscriptionInvoice_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionInvoice_invoiceNumber_key" ON "SubscriptionInvoice"("invoiceNumber");
CREATE UNIQUE INDEX IF NOT EXISTS "SubscriptionInvoice_fygaroCustomRef_key" ON "SubscriptionInvoice"("fygaroCustomRef");
CREATE INDEX IF NOT EXISTS "SubscriptionInvoice_subscriptionId_status_idx" ON "SubscriptionInvoice"("subscriptionId", "status");
CREATE INDEX IF NOT EXISTS "SubscriptionInvoice_landlordId_status_idx" ON "SubscriptionInvoice"("landlordId", "status");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SubscriptionInvoice_subscriptionId_fkey'
  ) THEN
    ALTER TABLE "SubscriptionInvoice"
    ADD CONSTRAINT "SubscriptionInvoice_subscriptionId_fkey"
    FOREIGN KEY ("subscriptionId") REFERENCES "LandlordSubscription"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'SubscriptionInvoice_landlordId_fkey'
  ) THEN
    ALTER TABLE "SubscriptionInvoice"
    ADD CONSTRAINT "SubscriptionInvoice_landlordId_fkey"
    FOREIGN KEY ("landlordId") REFERENCES "LandlordProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "BillingPaymentEvent" (
  "id" TEXT NOT NULL,
  "subscriptionInvoiceId" TEXT NOT NULL,
  "eventType" TEXT NOT NULL,
  "provider" TEXT NOT NULL DEFAULT 'FYGARO',
  "providerReference" TEXT,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "BillingPaymentEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "BillingPaymentEvent_subscriptionInvoiceId_createdAt_idx" ON "BillingPaymentEvent"("subscriptionInvoiceId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'BillingPaymentEvent_subscriptionInvoiceId_fkey'
  ) THEN
    ALTER TABLE "BillingPaymentEvent"
    ADD CONSTRAINT "BillingPaymentEvent_subscriptionInvoiceId_fkey"
    FOREIGN KEY ("subscriptionInvoiceId") REFERENCES "SubscriptionInvoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

-- Seed default plans so SuperAdmin subscription assignment has something usable immediately.
INSERT INTO "SubscriptionPlan" ("id", "code", "name", "amount", "currency", "intervalMonths", "status", "createdAt", "updatedAt")
VALUES
  ('plan_starter_default', 'STARTER', 'Starter Landlord', 49, 'KYD', 1, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plan_professional_default', 'PROFESSIONAL', 'Professional Landlord', 79, 'KYD', 1, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plan_property_manager_default', 'PROPERTY_MANAGER', 'Property Manager', 149, 'KYD', 1, 'ACTIVE', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO NOTHING;
