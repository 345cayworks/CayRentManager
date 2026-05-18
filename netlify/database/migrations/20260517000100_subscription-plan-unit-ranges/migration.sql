-- Billing Phase 1: SubscriptionPlan unit-range columns + official plan catalog.
-- Idempotent: safe to run multiple times.

ALTER TABLE "SubscriptionPlan"
  ADD COLUMN IF NOT EXISTS "minUnits" INTEGER,
  ADD COLUMN IF NOT EXISTS "maxUnits" INTEGER;

-- Idempotently upsert the 3 official plans. Stable ids match the
-- billing_foundation seed so re-running does not create duplicates.
-- "RecordStatus" is a Postgres enum type; cast the literal explicitly.
INSERT INTO "SubscriptionPlan"
  ("id", "code", "name", "amount", "currency", "intervalMonths", "minUnits", "maxUnits", "status", "createdAt", "updatedAt")
VALUES
  ('plan_starter_default', 'STARTER', 'Starter', 49.00, 'KYD', 1, 1, 4, 'ACTIVE'::"RecordStatus", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plan_professional_default', 'PROFESSIONAL', 'Professional', 99.00, 'KYD', 1, 5, 10, 'ACTIVE'::"RecordStatus", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('plan_property_manager_default', 'PROPERTY_MANAGER', 'Property Manager', 149.00, 'KYD', 1, 11, NULL, 'ACTIVE'::"RecordStatus", CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("code") DO UPDATE SET
  "name" = EXCLUDED."name",
  "amount" = EXCLUDED."amount",
  "currency" = EXCLUDED."currency",
  "intervalMonths" = EXCLUDED."intervalMonths",
  "minUnits" = EXCLUDED."minUnits",
  "maxUnits" = EXCLUDED."maxUnits",
  "status" = EXCLUDED."status",
  "updatedAt" = CURRENT_TIMESTAMP;
