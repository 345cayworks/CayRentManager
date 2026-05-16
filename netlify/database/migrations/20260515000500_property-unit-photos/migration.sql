-- Property & Unit photos (reuses Phase 7 Netlify Blobs infra)
-- Idempotent: safe to run multiple times.

CREATE TABLE IF NOT EXISTS "PropertyPhoto" (
  "id"          TEXT NOT NULL,
  "landlordId"  TEXT NOT NULL,
  "propertyId"  TEXT NOT NULL,
  "storageKey"  TEXT NOT NULL,
  "fileName"    TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "fileSize"    INTEGER NOT NULL,
  "isPrimary"   BOOLEAN NOT NULL DEFAULT false,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  "uploadedBy"  TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archivedAt"  TIMESTAMP(3),
  CONSTRAINT "PropertyPhoto_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "UnitPhoto" (
  "id"          TEXT NOT NULL,
  "landlordId"  TEXT NOT NULL,
  "unitId"      TEXT NOT NULL,
  "storageKey"  TEXT NOT NULL,
  "fileName"    TEXT NOT NULL,
  "contentType" TEXT NOT NULL,
  "fileSize"    INTEGER NOT NULL,
  "isPrimary"   BOOLEAN NOT NULL DEFAULT false,
  "sortOrder"   INTEGER NOT NULL DEFAULT 0,
  "uploadedBy"  TEXT NOT NULL,
  "createdAt"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archivedAt"  TIMESTAMP(3),
  CONSTRAINT "UnitPhoto_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "PropertyPhoto_propertyId_idx" ON "PropertyPhoto" ("propertyId");
CREATE INDEX IF NOT EXISTS "PropertyPhoto_landlordId_idx" ON "PropertyPhoto" ("landlordId");
CREATE INDEX IF NOT EXISTS "UnitPhoto_unitId_idx" ON "UnitPhoto" ("unitId");
CREATE INDEX IF NOT EXISTS "UnitPhoto_landlordId_idx" ON "UnitPhoto" ("landlordId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'PropertyPhoto_propertyId_fkey'
  ) THEN
    ALTER TABLE "PropertyPhoto"
      ADD CONSTRAINT "PropertyPhoto_propertyId_fkey"
      FOREIGN KEY ("propertyId") REFERENCES "Property" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'UnitPhoto_unitId_fkey'
  ) THEN
    ALTER TABLE "UnitPhoto"
      ADD CONSTRAINT "UnitPhoto_unitId_fkey"
      FOREIGN KEY ("unitId") REFERENCES "Unit" ("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
