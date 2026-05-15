-- Registration Phase 2 — Professional Onboarding.
-- Adds optional company profile fields and onboarding completion / dismissal tracking
-- to LandlordProfile. All new columns are nullable or have defaults, so no backfill
-- is required.

ALTER TABLE "LandlordProfile"
  ADD COLUMN IF NOT EXISTS "phone" TEXT,
  ADD COLUMN IF NOT EXISTS "website" TEXT,
  ADD COLUMN IF NOT EXISTS "email" TEXT,
  ADD COLUMN IF NOT EXISTS "addressLine1" TEXT,
  ADD COLUMN IF NOT EXISTS "addressLine2" TEXT,
  ADD COLUMN IF NOT EXISTS "city" TEXT,
  ADD COLUMN IF NOT EXISTS "country" TEXT DEFAULT 'KY',
  ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'KYD',
  ADD COLUMN IF NOT EXISTS "timezone" TEXT NOT NULL DEFAULT 'America/Cayman',
  ADD COLUMN IF NOT EXISTS "tagline" TEXT,
  ADD COLUMN IF NOT EXISTS "logoUrl" TEXT,
  ADD COLUMN IF NOT EXISTS "onboardingCompletedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "onboardingCompletedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "onboardingDismissedAt" TIMESTAMP(3),
  ADD COLUMN IF NOT EXISTS "onboardingDismissedBy" TEXT,
  ADD COLUMN IF NOT EXISTS "companyProfileCompletedAt" TIMESTAMP(3);
