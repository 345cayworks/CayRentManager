CREATE TABLE IF NOT EXISTS "SystemSetting" (
  "key" TEXT PRIMARY KEY,
  "value" TEXT NOT NULL,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedBy" TEXT
);

INSERT INTO "SystemSetting" ("key", "value") VALUES
  ('platform.timezone', 'America/Cayman'),
  ('platform.currency', 'KYD')
ON CONFLICT ("key") DO NOTHING;
