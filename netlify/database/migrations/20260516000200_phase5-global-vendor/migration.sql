-- Phase 5.1: global vendor foundation (platform-level vendor listings).
-- Idempotent: safe to run multiple times.

CREATE TABLE IF NOT EXISTS "GlobalVendor" (
  "id"             TEXT NOT NULL,
  "name"           TEXT NOT NULL,
  "email"          TEXT,
  "phone"          TEXT,
  "website"        TEXT,
  "specialty"      TEXT,
  "serviceAreas"   TEXT,
  "description"    TEXT,
  "logoUrl"        TEXT,
  "approvedStatus" BOOLEAN NOT NULL DEFAULT false,
  "featured"       BOOLEAN NOT NULL DEFAULT false,
  "sponsored"      BOOLEAN NOT NULL DEFAULT false,
  "monthlyFee"     DECIMAL(65,30),
  "status"         "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archivedAt"     TIMESTAMP(3),
  "archivedBy"     TEXT,
  "createdBy"      TEXT,
  CONSTRAINT "GlobalVendor_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "GlobalVendor_status_idx"
  ON "GlobalVendor" ("status");

CREATE INDEX IF NOT EXISTS "GlobalVendor_approvedStatus_idx"
  ON "GlobalVendor" ("approvedStatus");
