-- Vendor portal request/approval governance: landlords request, superadmin approves.
-- Idempotent: safe to run multiple times.

CREATE TABLE IF NOT EXISTS "VendorPortalRequest" (
  "id"                  TEXT NOT NULL,
  "landlordId"          TEXT NOT NULL,
  "maintenanceVendorId" TEXT NOT NULL,
  "requestedByUserId"   TEXT NOT NULL,
  "requestedEmail"      TEXT NOT NULL,
  "status"              TEXT NOT NULL DEFAULT 'PENDING',
  "note"                TEXT,
  "reviewedByUserId"    TEXT,
  "reviewedAt"          TIMESTAMP(3),
  "decisionNote"        TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "VendorPortalRequest_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "VendorPortalRequest_status_idx"
  ON "VendorPortalRequest" ("status");

CREATE INDEX IF NOT EXISTS "VendorPortalRequest_landlordId_idx"
  ON "VendorPortalRequest" ("landlordId");

CREATE INDEX IF NOT EXISTS "VendorPortalRequest_maintenanceVendorId_idx"
  ON "VendorPortalRequest" ("maintenanceVendorId");

-- Prevent duplicate open requests for the same vendor.
CREATE UNIQUE INDEX IF NOT EXISTS "VendorPortalRequest_one_pending_per_vendor"
  ON "VendorPortalRequest" ("maintenanceVendorId")
  WHERE status = 'PENDING';

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'VendorPortalRequest_landlordId_fkey'
  ) THEN
    ALTER TABLE "VendorPortalRequest"
      ADD CONSTRAINT "VendorPortalRequest_landlordId_fkey"
      FOREIGN KEY ("landlordId") REFERENCES "LandlordProfile" ("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'VendorPortalRequest_maintenanceVendorId_fkey'
  ) THEN
    ALTER TABLE "VendorPortalRequest"
      ADD CONSTRAINT "VendorPortalRequest_maintenanceVendorId_fkey"
      FOREIGN KEY ("maintenanceVendorId") REFERENCES "MaintenanceVendor" ("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;
