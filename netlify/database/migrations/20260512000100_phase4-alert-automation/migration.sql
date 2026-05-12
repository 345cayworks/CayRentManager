DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'LeaseAlertSnapshotStatus') THEN
    CREATE TYPE "LeaseAlertSnapshotStatus" AS ENUM ('ACTIVE', 'REVIEWED', 'RESOLVED', 'DISMISSED');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "LeaseAlertSnapshot" (
  "id" TEXT PRIMARY KEY,
  "landlordId" TEXT NOT NULL,
  "alertKey" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "severity" TEXT NOT NULL,
  "title" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "leaseId" TEXT,
  "tenantId" TEXT,
  "propertyId" TEXT,
  "unitId" TEXT,
  "daysRemaining" INTEGER,
  "amount" DECIMAL(65, 30),
  "status" "LeaseAlertSnapshotStatus" NOT NULL DEFAULT 'ACTIVE',
  "firstSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "reviewedAt" TIMESTAMP(3),
  "resolvedAt" TIMESTAMP(3),
  "dismissedAt" TIMESTAMP(3),
  "metadata" JSONB
);

CREATE UNIQUE INDEX IF NOT EXISTS "LeaseAlertSnapshot_landlordId_alertKey_key"
  ON "LeaseAlertSnapshot"("landlordId", "alertKey");

CREATE INDEX IF NOT EXISTS "LeaseAlertSnapshot_landlordId_status_idx"
  ON "LeaseAlertSnapshot"("landlordId", "status");

CREATE INDEX IF NOT EXISTS "LeaseAlertSnapshot_landlordId_severity_idx"
  ON "LeaseAlertSnapshot"("landlordId", "severity");

CREATE INDEX IF NOT EXISTS "LeaseAlertSnapshot_leaseId_idx"
  ON "LeaseAlertSnapshot"("leaseId");

CREATE INDEX IF NOT EXISTS "LeaseAlertSnapshot_lastSeenAt_idx"
  ON "LeaseAlertSnapshot"("lastSeenAt");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LeaseAlertSnapshot_landlordId_fkey'
  ) THEN
    ALTER TABLE "LeaseAlertSnapshot"
      ADD CONSTRAINT "LeaseAlertSnapshot_landlordId_fkey"
      FOREIGN KEY ("landlordId") REFERENCES "LandlordProfile"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
