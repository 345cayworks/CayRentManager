-- Phase 3 — Maintenance Requests Foundation

DO $$ BEGIN
  CREATE TYPE "MaintenancePriority" AS ENUM ('LOW', 'MEDIUM', 'HIGH', 'URGENT');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "MaintenanceCategory" AS ENUM (
    'PLUMBING',
    'ELECTRICAL',
    'HVAC',
    'APPLIANCE',
    'GENERAL',
    'PEST_CONTROL',
    'SECURITY',
    'CLEANING',
    'LANDSCAPING',
    'OTHER'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

ALTER TABLE "MaintenanceRequest"
  ADD COLUMN IF NOT EXISTS "priority" "MaintenancePriority" NOT NULL DEFAULT 'MEDIUM',
  ADD COLUMN IF NOT EXISTS "category" "MaintenanceCategory" NOT NULL DEFAULT 'GENERAL',
  ADD COLUMN IF NOT EXISTS "permissionToEnter" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "preferredContactTime" TEXT,
  ADD COLUMN IF NOT EXISTS "estimatedCost" DECIMAL(65,30),
  ADD COLUMN IF NOT EXISTS "assignedVendorId" TEXT;

CREATE TABLE IF NOT EXISTS "MaintenanceAttachment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "maintenanceRequestId" TEXT NOT NULL REFERENCES "MaintenanceRequest"("id") ON DELETE CASCADE,
  "fileUrl" TEXT NOT NULL,
  "fileType" TEXT,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "MaintenanceAttachment_request_idx"
  ON "MaintenanceAttachment"("maintenanceRequestId");

CREATE TABLE IF NOT EXISTS "MaintenanceComment" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "maintenanceRequestId" TEXT NOT NULL REFERENCES "MaintenanceRequest"("id") ON DELETE CASCADE,
  "authorUserId" TEXT NOT NULL REFERENCES "User"("id"),
  "message" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "MaintenanceComment_request_idx"
  ON "MaintenanceComment"("maintenanceRequestId", "createdAt");

CREATE TABLE IF NOT EXISTS "MaintenanceVendor" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "landlordId" TEXT NOT NULL REFERENCES "LandlordProfile"("id"),
  "name" TEXT NOT NULL,
  "email" TEXT,
  "phone" TEXT,
  "specialty" TEXT,
  "approvedStatus" BOOLEAN NOT NULL DEFAULT false,
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "MaintenanceVendor_landlord_idx"
  ON "MaintenanceVendor"("landlordId");

CREATE TABLE IF NOT EXISTS "MaintenanceWorkOrder" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "maintenanceRequestId" TEXT NOT NULL REFERENCES "MaintenanceRequest"("id") ON DELETE CASCADE,
  "vendorId" TEXT REFERENCES "MaintenanceVendor"("id"),
  "status" TEXT NOT NULL DEFAULT 'OPEN',
  "estimatedCost" DECIMAL(65,30),
  "actualCost" DECIMAL(65,30),
  "scheduledDate" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS "MaintenanceWorkOrder_request_idx"
  ON "MaintenanceWorkOrder"("maintenanceRequestId");
