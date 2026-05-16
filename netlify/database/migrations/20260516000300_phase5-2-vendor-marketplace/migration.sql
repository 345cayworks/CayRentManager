-- Phase 5.2: landlord vendor marketplace (provenance + duplicate protection).
-- Idempotent: safe to run multiple times.

ALTER TABLE "MaintenanceVendor"
  ADD COLUMN IF NOT EXISTS "globalVendorId" TEXT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'MaintenanceVendor_globalVendorId_fkey'
  ) THEN
    ALTER TABLE "MaintenanceVendor"
      ADD CONSTRAINT "MaintenanceVendor_globalVendorId_fkey"
      FOREIGN KEY ("globalVendorId") REFERENCES "GlobalVendor"("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "MaintenanceVendor_globalVendorId_idx"
  ON "MaintenanceVendor" ("globalVendorId");

-- Duplicate protection: a landlord may keep at most one non-archived copy
-- of a given global vendor. Archived copies are exempt (re-add allowed).
CREATE UNIQUE INDEX IF NOT EXISTS "MaintenanceVendor_landlord_globalVendor_key"
  ON "MaintenanceVendor" ("landlordId", "globalVendorId")
  WHERE "globalVendorId" IS NOT NULL AND "archivedAt" IS NULL;
