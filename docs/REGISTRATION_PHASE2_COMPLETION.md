# Registration Phase 2 — Professional Onboarding (Completion)

Status: Complete

## What shipped

1. Company profile wizard (`/onboarding/company-profile`) with contact, address, branding, and operational defaults.
2. Dedicated `/properties/new` guided wizard that can chain into the units wizard.
3. Dedicated `/units/new` guided wizard that can chain into the tenants wizard, accepting an optional `?propertyId=` pre-selection.
4. Dedicated `/tenants/new` guided wizard that supports both invite and manual create paths.
5. Onboarding completion persistence via `LandlordProfile.onboardingCompletedAt` / `onboardingCompletedBy` and a "Mark setup complete" action.
6. Skip preference via `LandlordProfile.onboardingDismissedAt` / `onboardingDismissedBy` with dismiss and restore actions.
7. Dashboard onboarding nudge card and sidebar `Onboarding` link badge that reflects the remaining milestone count.

## New routes

- `/onboarding/company-profile`
- `/properties/new`
- `/units/new`
- `/tenants/new`

## New `LandlordProfile` fields

```text
phone                    String?
website                  String?
email                    String?
addressLine1             String?
addressLine2             String?
city                     String?
country                  String?   default("KY")
currency                 String    default("KYD")
timezone                 String    default("America/Cayman")
tagline                  String?
logoUrl                  String?
onboardingCompletedAt    DateTime?
onboardingCompletedBy    String?
onboardingDismissedAt    DateTime?
onboardingDismissedBy    String?
companyProfileCompletedAt DateTime?
```

Migration: `netlify/database/migrations/20260515000200_onboarding-phase2/migration.sql` (idempotent
`ADD COLUMN IF NOT EXISTS` for every new column).

## Manual QA checklist

- [ ] Register a fresh landlord; the onboarding nudge appears on `/dashboard` and the sidebar shows a badge of `5`.
- [ ] Open `/onboarding/company-profile`, fill at least company name + display name, save; the company-profile milestone ticks and the badge drops to `4`.
- [ ] Visit `/properties/new` and submit using "Save & add units"; redirect lands on `/units/new?propertyId=...`.
- [ ] Submit `/units/new` with "Save & invite tenants"; redirect lands on `/tenants/new`.
- [ ] Send a tenant invite from `/tenants/new`; the milestone ticks.
- [ ] Create a maintenance vendor and request so all 5 milestones complete; the "Mark setup complete" button enables on `/onboarding`.
- [ ] Mark setup complete; success card appears with the completion date, dashboard nudge disappears, sidebar badge clears.
- [ ] Click "Re-open setup" to clear the completion state; nudge and badge return.
- [ ] Click "Hide onboarding"; dashboard nudge disappears, sidebar badge clears, banner on `/onboarding` exposes the Restore button.
- [ ] Restore from the `/onboarding` banner; nudge and badge return.
