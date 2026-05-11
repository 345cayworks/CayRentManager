-- Phase 3 Stabilization — Maintenance enum compatibility
-- Purpose: protect production/preview databases where MaintenanceRequest.priority
-- or category may already exist as TEXT before the Phase 3 enum migration.

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

DO $$
DECLARE
  priority_type text;
  category_type text;
BEGIN
  SELECT udt_name INTO priority_type
  FROM information_schema.columns
  WHERE table_name = 'MaintenanceRequest'
    AND column_name = 'priority';

  IF priority_type IS NULL THEN
    ALTER TABLE "MaintenanceRequest"
      ADD COLUMN "priority" "MaintenancePriority" NOT NULL DEFAULT 'MEDIUM';
  ELSIF priority_type <> 'MaintenancePriority' THEN
    ALTER TABLE "MaintenanceRequest"
      ALTER COLUMN "priority" DROP DEFAULT;

    ALTER TABLE "MaintenanceRequest"
      ALTER COLUMN "priority" TYPE "MaintenancePriority"
      USING (
        CASE upper(coalesce("priority"::text, 'MEDIUM'))
          WHEN 'LOW' THEN 'LOW'::"MaintenancePriority"
          WHEN 'MEDIUM' THEN 'MEDIUM'::"MaintenancePriority"
          WHEN 'HIGH' THEN 'HIGH'::"MaintenancePriority"
          WHEN 'URGENT' THEN 'URGENT'::"MaintenancePriority"
          WHEN 'NORMAL' THEN 'MEDIUM'::"MaintenancePriority"
          ELSE 'MEDIUM'::"MaintenancePriority"
        END
      );

    ALTER TABLE "MaintenanceRequest"
      ALTER COLUMN "priority" SET DEFAULT 'MEDIUM';

    ALTER TABLE "MaintenanceRequest"
      ALTER COLUMN "priority" SET NOT NULL;
  END IF;

  SELECT udt_name INTO category_type
  FROM information_schema.columns
  WHERE table_name = 'MaintenanceRequest'
    AND column_name = 'category';

  IF category_type IS NULL THEN
    ALTER TABLE "MaintenanceRequest"
      ADD COLUMN "category" "MaintenanceCategory" NOT NULL DEFAULT 'GENERAL';
  ELSIF category_type <> 'MaintenanceCategory' THEN
    ALTER TABLE "MaintenanceRequest"
      ALTER COLUMN "category" DROP DEFAULT;

    ALTER TABLE "MaintenanceRequest"
      ALTER COLUMN "category" TYPE "MaintenanceCategory"
      USING (
        CASE upper(coalesce("category"::text, 'GENERAL'))
          WHEN 'PLUMBING' THEN 'PLUMBING'::"MaintenanceCategory"
          WHEN 'ELECTRICAL' THEN 'ELECTRICAL'::"MaintenanceCategory"
          WHEN 'HVAC' THEN 'HVAC'::"MaintenanceCategory"
          WHEN 'APPLIANCE' THEN 'APPLIANCE'::"MaintenanceCategory"
          WHEN 'GENERAL' THEN 'GENERAL'::"MaintenanceCategory"
          WHEN 'PEST_CONTROL' THEN 'PEST_CONTROL'::"MaintenanceCategory"
          WHEN 'SECURITY' THEN 'SECURITY'::"MaintenanceCategory"
          WHEN 'CLEANING' THEN 'CLEANING'::"MaintenanceCategory"
          WHEN 'LANDSCAPING' THEN 'LANDSCAPING'::"MaintenanceCategory"
          WHEN 'OTHER' THEN 'OTHER'::"MaintenanceCategory"
          ELSE 'GENERAL'::"MaintenanceCategory"
        END
      );

    ALTER TABLE "MaintenanceRequest"
      ALTER COLUMN "category" SET DEFAULT 'GENERAL';

    ALTER TABLE "MaintenanceRequest"
      ALTER COLUMN "category" SET NOT NULL;
  END IF;
END $$;
