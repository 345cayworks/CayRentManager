# Platform Time Preferences

## Why this change

Server-rendered pages used `Date.prototype.toLocaleDateString()` and
`Date.prototype.toLocaleString()` without an explicit timezone. Netlify
defaults the Node runtime to UTC, so every visible timestamp was off by up
to five hours for Cayman users (and was simply wrong for anyone else).

This change introduces a resolved timezone preference that flows from the
landlord workspace down to every server-rendered page, plus a platform
fallback configurable by superadmins.

## Resolution order

`getEffectiveTimezone()` (`src/lib/time/effective.ts`) resolves a timezone
per request in the following order:

1. **Landlord workspace** — for `LANDLORD`, `PROPERTY_MANAGER`,
   `ACCOUNTANT` roles, the active workspace's `LandlordProfile.timezone`.
2. **Tenant's landlord** — for `TENANT` users, the timezone of the
   landlord their tenant record belongs to.
3. **Vendor's landlord** — for `VENDOR`/`MAINTENANCE_PROVIDER` users, the
   timezone of the linked landlord.
4. **Platform default** — `SystemSetting` with key `platform.timezone`
   (managed at `/admin/settings`).
5. **Hard-coded fallback** — `America/Cayman`.

The same precedence applies to currency (`getEffectiveTimePrefs()` returns
both).

## How to change defaults

- **Superadmin**: `/admin/settings` lets you set the platform timezone and
  currency. These apply to superadmins themselves and as the fallback for
  any user whose workspace timezone is unset.
- **Landlord**: `/account/profile` exposes a "Workspace Settings" section
  for `LANDLORD`/`PROPERTY_MANAGER`/`ACCOUNTANT` roles. Changes take
  effect immediately for the entire workspace (tenants and vendors
  included).

## Where it does NOT apply

- **Number formatting** — counts and currency amounts continue to use the
  existing formatting; this change only affects `Date` displays.
- **Stored dates** — Postgres `TIMESTAMP(3)` columns still hold UTC.
  Only the rendering layer was changed.
- **Email recipients** — daily digest emails (`netlify/functions/alert-digest-daily.ts`)
  now render in the recipient landlord's timezone. Receipts (`/api/receipts/[receiptId]`)
  render in the receipt's landlord timezone.

## Migration

`netlify/database/migrations/20260515000300_system-settings/migration.sql`
creates the `SystemSetting` table and seeds the two platform defaults.

## Adding more options

The timezone and currency pickers are sourced from the curated lists in
`src/lib/time/format.ts` (`SUPPORTED_TIMEZONES`, `SUPPORTED_CURRENCIES`).
Extend those constants to expose more options.
