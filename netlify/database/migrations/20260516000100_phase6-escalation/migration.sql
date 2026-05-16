-- Phase 6: alert escalation engine + SMS/WhatsApp channel abstraction
-- Idempotent: safe to run multiple times.

-- Add WHATSAPP to NotificationChannel. ADD VALUE IF NOT EXISTS is safe and is
-- only consumed at runtime (never in this migration), so no transaction issue.
ALTER TYPE "NotificationChannel" ADD VALUE IF NOT EXISTS 'WHATSAPP';

ALTER TABLE "OutboundNotification"
  ADD COLUMN IF NOT EXISTS "recipientPhone" TEXT,
  ADD COLUMN IF NOT EXISTS "notificationKind" TEXT NOT NULL DEFAULT 'GENERAL';

CREATE TABLE IF NOT EXISTS "EscalationPolicy" (
  "id"             TEXT NOT NULL,
  "landlordId"     TEXT NOT NULL,
  "enabled"        BOOLEAN NOT NULL DEFAULT true,
  "minSeverity"    TEXT NOT NULL DEFAULT 'URGENT',
  "thresholdHours" INTEGER NOT NULL DEFAULT 24,
  "repeatHours"    INTEGER,
  "notifyRoles"    TEXT[] NOT NULL DEFAULT ARRAY['LANDLORD', 'PROPERTY_MANAGER']::TEXT[],
  "channels"       TEXT[] NOT NULL DEFAULT ARRAY['EMAIL']::TEXT[],
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedBy"      TEXT,
  CONSTRAINT "EscalationPolicy_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "EscalationPolicy_landlordId_key"
  ON "EscalationPolicy" ("landlordId");

CREATE TABLE IF NOT EXISTS "AlertEscalation" (
  "id"              TEXT NOT NULL,
  "landlordId"      TEXT NOT NULL,
  "alertKey"        TEXT NOT NULL,
  "level"           INTEGER NOT NULL,
  "severity"        TEXT NOT NULL,
  "notifiedUserIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "channels"        TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "sentAt"          TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AlertEscalation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AlertEscalation_landlordId_alertKey_level_key"
  ON "AlertEscalation" ("landlordId", "alertKey", "level");

CREATE INDEX IF NOT EXISTS "AlertEscalation_landlordId_alertKey_idx"
  ON "AlertEscalation" ("landlordId", "alertKey");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'EscalationPolicy_landlordId_fkey'
  ) THEN
    ALTER TABLE "EscalationPolicy"
      ADD CONSTRAINT "EscalationPolicy_landlordId_fkey"
      FOREIGN KEY ("landlordId") REFERENCES "LandlordProfile" ("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'AlertEscalation_landlordId_fkey'
  ) THEN
    ALTER TABLE "AlertEscalation"
      ADD CONSTRAINT "AlertEscalation_landlordId_fkey"
      FOREIGN KEY ("landlordId") REFERENCES "LandlordProfile" ("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
