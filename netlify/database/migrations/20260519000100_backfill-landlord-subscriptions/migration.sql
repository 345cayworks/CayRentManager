-- Billing Phase 3: backfill TRIAL subscriptions for existing landlords.
--
-- For every ACTIVE LandlordProfile that has NO LandlordSubscription row,
-- insert a TRIAL subscription on the STARTER plan with a 30-day window.
--
-- Idempotent: the NOT EXISTS guard means re-running inserts nothing for
-- landlords that already have a subscription. If the STARTER plan is absent
-- the CROSS JOIN with the empty subquery yields zero rows (clean no-op).
--
-- No schema changes. Column casing / enum casts match the init schema and the
-- Phase 1 plan-seed migration. gen_random_uuid() is built into PostgreSQL 13+
-- (Netlify DB / Neon); ensure pgcrypto is available as a safety net.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

INSERT INTO "LandlordSubscription"
  ("id", "landlordId", "planId", "status",
   "currentPeriodStart", "currentPeriodEnd",
   "trialStartsAt", "trialEndsAt", "nextInvoiceAt",
   "isComplimentary", "complimentarySeats", "createdAt", "updatedAt")
SELECT
  gen_random_uuid()::text,
  lp."id",
  sp."id",
  'TRIAL'::"SubscriptionStatus",
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP + INTERVAL '30 days',
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP + INTERVAL '30 days',
  CURRENT_TIMESTAMP + INTERVAL '30 days',
  false,
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "LandlordProfile" lp
CROSS JOIN (SELECT "id" FROM "SubscriptionPlan" WHERE "code" = 'STARTER' LIMIT 1) sp
WHERE lp."status" = 'ACTIVE'::"RecordStatus"
  AND NOT EXISTS (
    SELECT 1 FROM "LandlordSubscription" ls WHERE ls."landlordId" = lp."id"
  );
