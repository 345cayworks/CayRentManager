-- Phase 3 sprint closeout: vendor management, dispatch workflow, SLA tracking, vendor portal.

DO $$ BEGIN
  CREATE TYPE "WorkOrderStatus" AS ENUM (
    'OPEN',
    'DISPATCHED',
    'IN_PROGRESS',
    'COMPLETED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- Convert MaintenanceWorkOrder.status from TEXT to the enum if it has not been migrated yet.
DO $$
DECLARE
  current_type TEXT;
BEGIN
  SELECT data_type INTO current_type
  FROM information_schema.columns
  WHERE table_name = 'MaintenanceWorkOrder' AND column_name = 'status';

  IF current_type = 'text' THEN
    ALTER TABLE "MaintenanceWorkOrder"
      ALTER COLUMN "status" DROP DEFAULT;

    ALTER TABLE "MaintenanceWorkOrder"
      ALTER COLUMN "status" TYPE "WorkOrderStatus"
      USING "status"::text::"WorkOrderStatus";

    ALTER TABLE "MaintenanceWorkOrder"
      ALTER COLUMN "status" SET DEFAULT 'OPEN';
  END IF;
END $$;

ALTER TABLE "MaintenanceWorkOrder"
  ADD COLUMN IF NOT EXISTS "dispatchedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "cancelReason" TEXT,
  ADD COLUMN IF NOT EXISTS "completionNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "vendorAcknowledgedAt" TIMESTAMP(3);

ALTER TABLE "MaintenanceRequest"
  ADD COLUMN IF NOT EXISTS "slaDueAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "slaBreachedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "firstResponseAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3);

ALTER TABLE "MaintenanceVendor"
  ADD COLUMN IF NOT EXISTS "address" TEXT,
  ADD COLUMN IF NOT EXISTS "licenseNumber" TEXT,
  ADD COLUMN IF NOT EXISTS "insuranceExpiresAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "userId" TEXT,
  ADD COLUMN IF NOT EXISTS "portalEnabledAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "archivedBy" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'MaintenanceVendor_userId_fkey'
  ) THEN
    ALTER TABLE "MaintenanceVendor"
      ADD CONSTRAINT "MaintenanceVendor_userId_fkey"
      FOREIGN KEY ("userId") REFERENCES "User"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS "MaintenanceVendor_userId_key"
  ON "MaintenanceVendor"("userId")
  WHERE "userId" IS NOT NULL;

CREATE INDEX IF NOT EXISTS "MaintenanceVendor_landlordId_archivedAt_idx"
  ON "MaintenanceVendor"("landlordId", "archivedAt");

CREATE INDEX IF NOT EXISTS "MaintenanceRequest_landlordId_slaDueAt_idx"
  ON "MaintenanceRequest"("landlordId", "slaDueAt");

-- Backfill SLA targets for existing maintenance requests.
UPDATE "MaintenanceRequest"
SET "slaDueAt" = "createdAt" + (
  CASE "priority"
    WHEN 'URGENT' THEN INTERVAL '4 hours'
    WHEN 'HIGH'   THEN INTERVAL '24 hours'
    WHEN 'MEDIUM' THEN INTERVAL '72 hours'
    WHEN 'LOW'    THEN INTERVAL '168 hours'
    ELSE INTERVAL '72 hours'
  END
)
WHERE "slaDueAt" IS NULL;
