-- Digital Tenant Application workflow.
-- Idempotent: safe to run multiple times.

DO $$
BEGIN
  CREATE TYPE "TenantApplicationStatus" AS ENUM (
    'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS "TenantApplicationLink" (
  "id"              TEXT NOT NULL,
  "landlordId"      TEXT NOT NULL,
  "propertyId"      TEXT,
  "unitId"          TEXT,
  "token"           TEXT NOT NULL,
  "label"           TEXT,
  "active"          BOOLEAN NOT NULL DEFAULT true,
  "expiresAt"       TIMESTAMP(3),
  "createdByUserId" TEXT,
  "createdAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"       TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TenantApplicationLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TenantApplicationLink_token_key"
  ON "TenantApplicationLink" ("token");

CREATE INDEX IF NOT EXISTS "TenantApplicationLink_landlordId_idx"
  ON "TenantApplicationLink" ("landlordId");

CREATE INDEX IF NOT EXISTS "TenantApplicationLink_token_idx"
  ON "TenantApplicationLink" ("token");

CREATE TABLE IF NOT EXISTS "TenantApplication" (
  "id"                  TEXT NOT NULL,
  "linkId"              TEXT,
  "landlordId"          TEXT NOT NULL,
  "propertyId"          TEXT,
  "unitId"              TEXT,
  "applicantName"       TEXT NOT NULL,
  "email"               TEXT NOT NULL,
  "phone"               TEXT,
  "currentAddress"      TEXT,
  "employer"            TEXT,
  "monthlyIncome"       DECIMAL(65,30),
  "desiredMoveIn"       TIMESTAMP(3),
  "occupants"           INTEGER,
  "references"          TEXT,
  "notes"               TEXT,
  "status"              "TenantApplicationStatus" NOT NULL DEFAULT 'SUBMITTED',
  "decisionByUserId"    TEXT,
  "decisionAt"          TIMESTAMP(3),
  "decisionNote"        TEXT,
  "createdInvitationId" TEXT,
  "createdAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt"           TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "TenantApplication_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "TenantApplication_landlordId_status_idx"
  ON "TenantApplication" ("landlordId", "status");

CREATE INDEX IF NOT EXISTS "TenantApplication_linkId_idx"
  ON "TenantApplication" ("linkId");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'TenantApplicationLink_landlordId_fkey'
  ) THEN
    ALTER TABLE "TenantApplicationLink"
      ADD CONSTRAINT "TenantApplicationLink_landlordId_fkey"
      FOREIGN KEY ("landlordId") REFERENCES "LandlordProfile" ("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'TenantApplicationLink_propertyId_fkey'
  ) THEN
    ALTER TABLE "TenantApplicationLink"
      ADD CONSTRAINT "TenantApplicationLink_propertyId_fkey"
      FOREIGN KEY ("propertyId") REFERENCES "Property" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'TenantApplicationLink_unitId_fkey'
  ) THEN
    ALTER TABLE "TenantApplicationLink"
      ADD CONSTRAINT "TenantApplicationLink_unitId_fkey"
      FOREIGN KEY ("unitId") REFERENCES "Unit" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'TenantApplication_linkId_fkey'
  ) THEN
    ALTER TABLE "TenantApplication"
      ADD CONSTRAINT "TenantApplication_linkId_fkey"
      FOREIGN KEY ("linkId") REFERENCES "TenantApplicationLink" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'TenantApplication_landlordId_fkey'
  ) THEN
    ALTER TABLE "TenantApplication"
      ADD CONSTRAINT "TenantApplication_landlordId_fkey"
      FOREIGN KEY ("landlordId") REFERENCES "LandlordProfile" ("id")
      ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'TenantApplication_propertyId_fkey'
  ) THEN
    ALTER TABLE "TenantApplication"
      ADD CONSTRAINT "TenantApplication_propertyId_fkey"
      FOREIGN KEY ("propertyId") REFERENCES "Property" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'TenantApplication_unitId_fkey'
  ) THEN
    ALTER TABLE "TenantApplication"
      ADD CONSTRAINT "TenantApplication_unitId_fkey"
      FOREIGN KEY ("unitId") REFERENCES "Unit" ("id")
      ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
