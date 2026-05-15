-- Notification layer for Phase 4 closure: per-user alert preferences and a
-- provider-agnostic outbound notification outbox. Defensive guards mirror the
-- billing-foundation migration so a partial deploy can be re-run safely.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'NotificationStatus'
  ) THEN
    CREATE TYPE "NotificationStatus" AS ENUM (
      'PENDING',
      'SENT',
      'FAILED',
      'SKIPPED'
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type WHERE typname = 'NotificationChannel'
  ) THEN
    CREATE TYPE "NotificationChannel" AS ENUM (
      'EMAIL',
      'SMS'
    );
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "AlertPreference" (
  "id" TEXT NOT NULL,
  "landlordId" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "digestEnabled" BOOLEAN NOT NULL DEFAULT true,
  "minSeverity" TEXT NOT NULL DEFAULT 'WARNING',
  "suppressedTypes" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "AlertPreference_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "AlertPreference_landlordId_userId_key"
  ON "AlertPreference"("landlordId", "userId");

CREATE INDEX IF NOT EXISTS "AlertPreference_landlordId_idx"
  ON "AlertPreference"("landlordId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AlertPreference_landlordId_fkey'
  ) THEN
    ALTER TABLE "AlertPreference"
    ADD CONSTRAINT "AlertPreference_landlordId_fkey"
    FOREIGN KEY ("landlordId") REFERENCES "LandlordProfile"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'AlertPreference_userId_fkey'
  ) THEN
    ALTER TABLE "AlertPreference"
    ADD CONSTRAINT "AlertPreference_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "User"("id")
    ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "OutboundNotification" (
  "id" TEXT NOT NULL,
  "landlordId" TEXT,
  "recipientUserId" TEXT,
  "recipientEmail" TEXT NOT NULL,
  "channel" "NotificationChannel" NOT NULL DEFAULT 'EMAIL',
  "subject" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "bodyHtml" TEXT,
  "relatedAlertKeys" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "status" "NotificationStatus" NOT NULL DEFAULT 'PENDING',
  "provider" TEXT,
  "providerMessageId" TEXT,
  "failureReason" TEXT,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "sentAt" TIMESTAMP(3),

  CONSTRAINT "OutboundNotification_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "OutboundNotification_status_createdAt_idx"
  ON "OutboundNotification"("status", "createdAt");

CREATE INDEX IF NOT EXISTS "OutboundNotification_landlordId_createdAt_idx"
  ON "OutboundNotification"("landlordId", "createdAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OutboundNotification_landlordId_fkey'
  ) THEN
    ALTER TABLE "OutboundNotification"
    ADD CONSTRAINT "OutboundNotification_landlordId_fkey"
    FOREIGN KEY ("landlordId") REFERENCES "LandlordProfile"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'OutboundNotification_recipientUserId_fkey'
  ) THEN
    ALTER TABLE "OutboundNotification"
    ADD CONSTRAINT "OutboundNotification_recipientUserId_fkey"
    FOREIGN KEY ("recipientUserId") REFERENCES "User"("id")
    ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
