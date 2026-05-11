-- Phase 2 — Rent Ledger & Receipts
-- Adds invoice, receipt, payment proof, payment method, and bank account foundations.

DO $$ BEGIN
  CREATE TYPE "InvoiceStatus" AS ENUM ('NEW', 'SENT', 'PARTIAL', 'PAID', 'OVERDUE', 'VOID');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE "PaymentMethodType" AS ENUM ('BANK_TRANSFER', 'CASH', 'CHEQUE', 'CARD', 'FYGARO_LINK', 'POWERTRANZ_CARD', 'CNB_GATEWAY', 'BUTTERFIELD_GATEWAY', 'OTHER');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "Invoice" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "invoiceNo" TEXT NOT NULL UNIQUE,
  "landlordId" TEXT NOT NULL REFERENCES "LandlordProfile"("id"),
  "tenantId" TEXT NOT NULL REFERENCES "Tenant"("id"),
  "leaseId" TEXT NOT NULL REFERENCES "Lease"("id"),
  "propertyId" TEXT NOT NULL REFERENCES "Property"("id"),
  "unitId" TEXT NOT NULL REFERENCES "Unit"("id"),
  "amount" DECIMAL(65,30) NOT NULL,
  "amountPaid" DECIMAL(65,30) NOT NULL DEFAULT 0,
  "balance" DECIMAL(65,30) NOT NULL,
  "dueDate" TIMESTAMP(3) NOT NULL,
  "sentAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "status" "InvoiceStatus" NOT NULL DEFAULT 'NEW',
  "notes" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "voidedAt" TIMESTAMP(3),
  "voidedBy" TEXT
);

CREATE INDEX IF NOT EXISTS "Invoice_landlordId_dueDate_idx" ON "Invoice"("landlordId", "dueDate");
CREATE INDEX IF NOT EXISTS "Invoice_landlordId_status_idx" ON "Invoice"("landlordId", "status");
CREATE INDEX IF NOT EXISTS "Invoice_tenantId_status_idx" ON "Invoice"("tenantId", "status");

CREATE TABLE IF NOT EXISTS "PaymentMethod" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "landlordId" TEXT NOT NULL REFERENCES "LandlordProfile"("id"),
  "type" "PaymentMethodType" NOT NULL,
  "label" TEXT NOT NULL,
  "details" JSONB,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archivedAt" TIMESTAMP(3),
  "archivedBy" TEXT
);

CREATE INDEX IF NOT EXISTS "PaymentMethod_landlordId_type_idx" ON "PaymentMethod"("landlordId", "type");
CREATE INDEX IF NOT EXISTS "PaymentMethod_landlordId_status_idx" ON "PaymentMethod"("landlordId", "status");

CREATE TABLE IF NOT EXISTS "BankAccount" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "landlordId" TEXT NOT NULL REFERENCES "LandlordProfile"("id"),
  "bankName" TEXT NOT NULL,
  "accountName" TEXT,
  "accountNumberMasked" TEXT NOT NULL,
  "branch" TEXT,
  "swiftCode" TEXT,
  "routingInfo" TEXT,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "status" "RecordStatus" NOT NULL DEFAULT 'ACTIVE',
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "archivedAt" TIMESTAMP(3),
  "archivedBy" TEXT
);

CREATE INDEX IF NOT EXISTS "BankAccount_landlordId_status_idx" ON "BankAccount"("landlordId", "status");

ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "invoiceId" TEXT;
ALTER TABLE "Payment" ADD COLUMN IF NOT EXISTS "paymentMethodId" TEXT;

DO $$ BEGIN
  ALTER TABLE "Payment" ADD CONSTRAINT "Payment_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id");
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "Payment" ADD CONSTRAINT "Payment_paymentMethodId_fkey" FOREIGN KEY ("paymentMethodId") REFERENCES "PaymentMethod"("id");
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE TABLE IF NOT EXISTS "Receipt" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "paymentId" TEXT NOT NULL UNIQUE REFERENCES "Payment"("id"),
  "fileUrl" TEXT,
  "receiptNo" TEXT NOT NULL UNIQUE,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS "PaymentProof" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "paymentId" TEXT NOT NULL REFERENCES "Payment"("id"),
  "fileUrl" TEXT NOT NULL,
  "fileType" TEXT,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
