-- Billing Phase 2: access-code / referral / promo system.
-- Greenfield + additive. Idempotent: safe to run multiple times.

DO $$
BEGIN
  CREATE TYPE "AccessCodeType" AS ENUM ('PROMO', 'REFERRAL', 'PARTNER', 'INTERNAL', 'COMPLIMENTARY');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "AccessCodeRewardType" AS ENUM (
    'PERCENT_DISCOUNT', 'FIXED_DISCOUNT', 'FREE_MONTHS', 'TRIAL_EXTENSION',
    'COMPLIMENTARY_ACCESS', 'ACCOUNT_CREDIT', 'UNIT_LIMIT_BONUS', 'MANUAL_REVIEW'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "AccessCodeStatus" AS ENUM ('ACTIVE', 'PAUSED', 'EXPIRED', 'ARCHIVED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "AccessCodeRedemptionStatus" AS ENUM ('PENDING', 'APPLIED', 'REVERSED', 'REJECTED');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "AccessCode" (
  "id"                            TEXT NOT NULL,
  "code"                          TEXT NOT NULL,
  "type"                          "AccessCodeType" NOT NULL,
  "status"                        "AccessCodeStatus" NOT NULL DEFAULT 'ACTIVE',
  "description"                   TEXT,
  "campaignName"                  TEXT,
  "startsAt"                      TIMESTAMP(3),
  "expiresAt"                     TIMESTAMP(3),
  "maxRedemptions"                INTEGER,
  "maxRedemptionsPerEmail"        INTEGER NOT NULL DEFAULT 1,
  "rewardType"                    "AccessCodeRewardType" NOT NULL,
  "rewardValue"                   DECIMAL(65,30),
  "rewardMonths"                  INTEGER,
  "rewardUnitLimit"               INTEGER,
  "appliesToPlanId"               TEXT,
  "isStackable"                   BOOLEAN NOT NULL DEFAULT false,
  "referrerUserId"                TEXT,
  "referrerLandlordId"            TEXT,
  "registrantBenefitDescription" TEXT,
  "referrerRewardType"            "AccessCodeRewardType",
  "referrerRewardValue"           DECIMAL(65,30),
  "referrerRewardMonths"          INTEGER,
  "createdByUserId"               TEXT,
  "createdAt"                     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"                     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccessCode_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AccessCode_code_key" ON "AccessCode" ("code");
CREATE INDEX IF NOT EXISTS "AccessCode_status_idx" ON "AccessCode" ("status");
CREATE INDEX IF NOT EXISTS "AccessCode_type_idx" ON "AccessCode" ("type");
CREATE INDEX IF NOT EXISTS "AccessCode_code_idx" ON "AccessCode" ("code");

CREATE TABLE IF NOT EXISTS "AccessCodeRedemption" (
  "id"                       TEXT NOT NULL,
  "accessCodeId"             TEXT NOT NULL,
  "code"                     TEXT NOT NULL,
  "registrantEmail"          TEXT NOT NULL,
  "registrantUserId"         TEXT,
  "registrantLandlordId"     TEXT,
  "referrerUserId"           TEXT,
  "referrerLandlordId"       TEXT,
  "subscriptionId"           TEXT,
  "invoiceId"                TEXT,
  "status"                   "AccessCodeRedemptionStatus" NOT NULL DEFAULT 'PENDING',
  "registrantBenefitApplied" JSONB,
  "referrerBenefitApplied"   JSONB,
  "appliedAt"                TIMESTAMP(3),
  "reversedAt"               TIMESTAMP(3),
  "notes"                    TEXT,
  "createdAt"                TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AccessCodeRedemption_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "AccessCodeRedemption_accessCodeId_idx"
  ON "AccessCodeRedemption" ("accessCodeId");
CREATE INDEX IF NOT EXISTS "AccessCodeRedemption_registrantEmail_idx"
  ON "AccessCodeRedemption" ("registrantEmail");
CREATE INDEX IF NOT EXISTS "AccessCodeRedemption_status_idx"
  ON "AccessCodeRedemption" ("status");

-- Prevent duplicate active capture per code+email while still PENDING.
CREATE UNIQUE INDEX IF NOT EXISTS "AccessCodeRedemption_code_email_pending"
  ON "AccessCodeRedemption" ("accessCodeId", "registrantEmail")
  WHERE status = 'PENDING';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'AccessCode_appliesToPlanId_fkey'
  ) THEN
    ALTER TABLE "AccessCode"
      ADD CONSTRAINT "AccessCode_appliesToPlanId_fkey"
      FOREIGN KEY ("appliesToPlanId") REFERENCES "SubscriptionPlan" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'AccessCodeRedemption_accessCodeId_fkey'
  ) THEN
    ALTER TABLE "AccessCodeRedemption"
      ADD CONSTRAINT "AccessCodeRedemption_accessCodeId_fkey"
      FOREIGN KEY ("accessCodeId") REFERENCES "AccessCode" ("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
