-- Phase 5.3: vendor monetization layer (billing status + lead tracking).
-- Idempotent: safe to run multiple times.

ALTER TABLE "GlobalVendor"
  ADD COLUMN IF NOT EXISTS "billingStatus" TEXT NOT NULL DEFAULT 'NONE',
  ADD COLUMN IF NOT EXISTS "billingNotes" TEXT,
  ADD COLUMN IF NOT EXISTS "paidThrough" TIMESTAMP(3);

CREATE TABLE IF NOT EXISTS "GlobalVendorLead" (
  "id" TEXT NOT NULL,
  "globalVendorId" TEXT NOT NULL,
  "landlordId" TEXT NOT NULL,
  "type" TEXT NOT NULL,
  "note" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GlobalVendorLead_pkey" PRIMARY KEY ("id")
);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'GlobalVendorLead_globalVendorId_fkey'
  ) THEN
    ALTER TABLE "GlobalVendorLead"
      ADD CONSTRAINT "GlobalVendorLead_globalVendorId_fkey"
      FOREIGN KEY ("globalVendorId") REFERENCES "GlobalVendor"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'GlobalVendorLead_landlordId_fkey'
  ) THEN
    ALTER TABLE "GlobalVendorLead"
      ADD CONSTRAINT "GlobalVendorLead_landlordId_fkey"
      FOREIGN KEY ("landlordId") REFERENCES "LandlordProfile"("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS "GlobalVendorLead_globalVendorId_idx"
  ON "GlobalVendorLead" ("globalVendorId");

CREATE INDEX IF NOT EXISTS "GlobalVendorLead_globalVendorId_type_idx"
  ON "GlobalVendorLead" ("globalVendorId", "type");

CREATE INDEX IF NOT EXISTS "GlobalVendorLead_landlordId_idx"
  ON "GlobalVendorLead" ("landlordId");
