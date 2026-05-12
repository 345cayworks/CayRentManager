-- Phase 4 — Lease Tracking & Alerts Foundation

DO $$ BEGIN
  CREATE TYPE "LeaseEventType" AS ENUM (
    'EXPIRATION',
    'RENEWAL_NOTICE',
    'RENEWAL_DEADLINE',
    'DEPOSIT_RETURN',
    'INSPECTION',
    'NOTICE_TO_VACATE',
    'RENT_ESCALATION',
    'DOCUMENT_EXPIRY',
    'CUSTOM'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "LeaseRenewalStatus" AS ENUM (
    'DRAFT',
    'PROPOSED',
    'ACCEPTED',
    'DECLINED',
    'COMPLETED',
    'CANCELLED'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "LeaseNoticeType" AS ENUM (
    'RENEWAL',
    'NON_RENEWAL',
    'NOTICE_TO_VACATE',
    'RENT_INCREASE',
    'INSPECTION',
    'DEPOSIT_RETURN',
    'CUSTOM'
  );
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "LeaseEvent" (
  "id" TEXT NOT NULL,
  "landlordId" TEXT NOT NULL,
  "leaseId" TEXT NOT NULL,
  "eventType" "LeaseEventType" NOT NULL,
  "eventDate" TIMESTAMP(3) NOT NULL,
  "description" TEXT,
  "completedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeaseEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LeaseRenewal" (
  "id" TEXT NOT NULL,
  "landlordId" TEXT NOT NULL,
  "leaseId" TEXT NOT NULL,
  "renewalStartDate" TIMESTAMP(3) NOT NULL,
  "renewalEndDate" TIMESTAMP(3) NOT NULL,
  "proposedRentAmount" DECIMAL(65,30),
  "status" "LeaseRenewalStatus" NOT NULL DEFAULT 'DRAFT',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "acceptedAt" TIMESTAMP(3),
  "completedAt" TIMESTAMP(3),
  CONSTRAINT "LeaseRenewal_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LeaseNotice" (
  "id" TEXT NOT NULL,
  "landlordId" TEXT NOT NULL,
  "leaseId" TEXT NOT NULL,
  "noticeType" "LeaseNoticeType" NOT NULL,
  "noticeDate" TIMESTAMP(3) NOT NULL,
  "content" TEXT NOT NULL,
  "sentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeaseNotice_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "LeaseDocumentVersion" (
  "id" TEXT NOT NULL,
  "landlordId" TEXT NOT NULL,
  "leaseId" TEXT NOT NULL,
  "fileUrl" TEXT NOT NULL,
  "fileName" TEXT,
  "documentType" TEXT,
  "versionNumber" INTEGER NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeaseDocumentVersion_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "LeaseEvent_landlordId_eventDate_idx" ON "LeaseEvent"("landlordId", "eventDate");
CREATE INDEX IF NOT EXISTS "LeaseEvent_leaseId_eventType_idx" ON "LeaseEvent"("leaseId", "eventType");
CREATE INDEX IF NOT EXISTS "LeaseRenewal_landlordId_status_idx" ON "LeaseRenewal"("landlordId", "status");
CREATE INDEX IF NOT EXISTS "LeaseRenewal_leaseId_renewalStartDate_idx" ON "LeaseRenewal"("leaseId", "renewalStartDate");
CREATE INDEX IF NOT EXISTS "LeaseNotice_landlordId_noticeDate_idx" ON "LeaseNotice"("landlordId", "noticeDate");
CREATE INDEX IF NOT EXISTS "LeaseNotice_leaseId_noticeType_idx" ON "LeaseNotice"("leaseId", "noticeType");
CREATE UNIQUE INDEX IF NOT EXISTS "LeaseDocumentVersion_leaseId_versionNumber_key" ON "LeaseDocumentVersion"("leaseId", "versionNumber");
CREATE INDEX IF NOT EXISTS "LeaseDocumentVersion_landlordId_uploadedAt_idx" ON "LeaseDocumentVersion"("landlordId", "uploadedAt");

DO $$ BEGIN
  ALTER TABLE "LeaseEvent" ADD CONSTRAINT "LeaseEvent_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "LeaseRenewal" ADD CONSTRAINT "LeaseRenewal_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "LeaseNotice" ADD CONSTRAINT "LeaseNotice_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "LeaseDocumentVersion" ADD CONSTRAINT "LeaseDocumentVersion_leaseId_fkey" FOREIGN KEY ("leaseId") REFERENCES "Lease"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;
