-- Phase 7: real upload infrastructure (Netlify Blobs)
-- Idempotent: safe to run multiple times.

DO $$
BEGIN
  CREATE TYPE "DocumentVisibility" AS ENUM ('LANDLORD_ONLY', 'TENANT_VISIBLE');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE TYPE "DocumentSource" AS ENUM ('EXTERNAL', 'STORED', 'BROKEN_PLACEHOLDER');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Document: simple nullable columns
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "storageKey" TEXT;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "fileSize" INTEGER;
ALTER TABLE "Document" ADD COLUMN IF NOT EXISTS "contentType" TEXT;

-- Document: enum-typed columns with defaults
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Document' AND column_name = 'visibility'
  ) THEN
    ALTER TABLE "Document" ADD COLUMN "visibility" "DocumentVisibility" NOT NULL DEFAULT 'LANDLORD_ONLY';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'Document' AND column_name = 'source'
  ) THEN
    ALTER TABLE "Document" ADD COLUMN "source" "DocumentSource" NOT NULL DEFAULT 'EXTERNAL';
  END IF;
END $$;

-- MaintenanceAttachment: nullable columns + relax fileUrl
ALTER TABLE "MaintenanceAttachment" ADD COLUMN IF NOT EXISTS "landlordId" TEXT;
ALTER TABLE "MaintenanceAttachment" ADD COLUMN IF NOT EXISTS "storageKey" TEXT;
ALTER TABLE "MaintenanceAttachment" ADD COLUMN IF NOT EXISTS "fileSize" INTEGER;
ALTER TABLE "MaintenanceAttachment" ADD COLUMN IF NOT EXISTS "uploadedBy" TEXT;
ALTER TABLE "MaintenanceAttachment" ALTER COLUMN "fileUrl" DROP NOT NULL;

-- Backfill: flag the data-losing placeholders for re-upload
UPDATE "Document"
  SET "source" = 'BROKEN_PLACEHOLDER'
  WHERE "fileUrl" LIKE 'pending-blob-upload://%' AND "source" = 'EXTERNAL';

-- Backfill (defensive): ensure real external links are EXTERNAL
UPDATE "Document"
  SET "source" = 'EXTERNAL'
  WHERE ("fileUrl" IS NOT NULL AND "fileUrl" NOT LIKE 'pending-blob-upload://%')
    AND "source" IS NULL;

-- Backfill MaintenanceAttachment.landlordId from the parent request
UPDATE "MaintenanceAttachment" ma
  SET "landlordId" = mr."landlordId"
  FROM "MaintenanceRequest" mr
  WHERE ma."maintenanceRequestId" = mr."id" AND ma."landlordId" IS NULL;
