-- Create new user status values and password change metadata for SuperAdmin landlord controls
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'PENDING_INVITE';
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'INACTIVE';
ALTER TYPE "UserStatus" ADD VALUE IF NOT EXISTS 'SUSPENDED';

ALTER TABLE "User"
  ADD COLUMN IF NOT EXISTS "mustChangePassword" boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS "temporaryPasswordHash" text,
  ADD COLUMN IF NOT EXISTS "temporaryPasswordSetAt" timestamp;
