# Phase 4 — Lease Tracking & Alerts Completion Notes

Status: **Complete** (closed May 2026 — notification layer landed in sprint 4.5).

Branch: `phase-4-lease-tracking-alerts` (original) + `claude/review-carrentmanager-roadmap-KJD8e` (closure sprint).

## Closure sprint — what shipped

| Roadmap remaining item | Resolution |
|---|---|
| Alert badges in navigation | `src/components/shell.tsx` queries the active-alert count for the landlord workspace and renders a red pill on the Alerts link. Renders nothing for tenant / admin / operational roles. Falls back gracefully if the alerts table is unreachable. |
| Alert preferences | New `AlertPreference` model (per `landlordId`, `userId`): `digestEnabled`, `minSeverity`, `suppressedTypes`. UI at `/account/notifications`. Linked from `/account/profile` and `/alerts`. Server action `updateAlertPreferencesAction` upserts and emits a `notification.preferences_updated` audit log. |
| Daily digest | Scheduled Netlify function `netlify/functions/alert-digest-daily.ts` runs at 07:00 UTC. For each active landlord workspace it filters alerts per recipient's preferences, queues an outbound notification (plaintext + HTML), then drains the outbox via the configured provider. |
| Email/SMS notification layer (foundation) | New `OutboundNotification` outbox model with `NotificationStatus` (`PENDING` / `SENT` / `FAILED` / `SKIPPED`) and `NotificationChannel` (`EMAIL` / `SMS`). `src/lib/notifications/outbox.ts` exposes `queueEmailNotification` and `processOutboundNotifications`. Default driver is `log-only`; setting `NOTIFICATION_PROVIDER=resend` + `RESEND_API_KEY` + `NOTIFICATION_FROM_EMAIL` activates Resend via direct `fetch` (no SDK dependency). |

## Deferred (out of scope, captured as future work)

- **Escalation routing** — requires a rules engine and team-member resolution; reasonable as its own phase once concierge/role assignment expands.
- **Concierge assignment** — depends on the concierge role being wired through the rest of the platform (Phase 5+).

## Schema changes

Forward migration `prisma/migrations/20260515_notification_layer/migration.sql`. Idempotent guards mirror the billing-foundation migration so a partial deploy can be re-run. No backfill required: missing preference rows mean "use defaults" via `resolvePreference()` in `src/lib/notifications/preferences.ts`.

## Operational notes

- Daily digest function is on the cron `0 7 * * *` (07:00 UTC ≈ 02:00 Cayman). Tune via the `schedule` export.
- Default email driver is `log-only`: deploys without notification credentials remain safe and observable (each "sent" notification logs `[notification:log] id=... to=... subject=...`).
- To enable live sends, set in Netlify env:
  - `NOTIFICATION_PROVIDER=resend`
  - `RESEND_API_KEY=re_...`
  - `NOTIFICATION_FROM_EMAIL=alerts@yourdomain.com`
  - `NOTIFICATION_FROM_NAME=CayRentManager` (optional)
- A failed send marks the row `FAILED` with `failureReason`. Retries are not automatic — a manual rerun of `processOutboundNotifications` will pick up `PENDING` rows; `FAILED` rows are surfaced for triage.

---

Branch: `phase-4-lease-tracking-alerts`

## Purpose

Phase 4 upgrades leases from static contract records into operational lifecycle-management infrastructure.

The goal is to provide landlords and property managers with visibility into:

- lease expirations
- renewal readiness
- occupancy and vacancy pipeline
- lease notices
- lifecycle events
- document versions
- future alert automation

---

# Completed Scope

## 1. Prisma Schema Expansion

Updated:

```text
prisma/schema.prisma
```

Added enums:

- `LeaseEventType`
- `LeaseRenewalStatus`
- `LeaseNoticeType`

Added models:

- `LeaseEvent`
- `LeaseRenewal`
- `LeaseNotice`
- `LeaseDocumentVersion`

Expanded `Lease` relations:

- `events`
- `renewals`
- `notices`
- `documentVersions`

## 2. Netlify Database Migration

Added:

```text
netlify/database/migrations/20260511000400_phase4-lease-tracking/migration.sql
```

Migration includes:

- enum creation with duplicate-object protection
- table creation with `IF NOT EXISTS`
- indexes
- foreign keys
- cascade delete relationships from lease lifecycle records to leases

## 3. Lease Operations Dashboard

Updated:

```text
src/app/leases/page.tsx
```

Capabilities:

- active lease count
- leases expiring within 60 days
- renewal pipeline count
- occupied unit count
- vacant unit count
- upcoming expirations panel
- renewal activity panel
- vacancy pipeline panel
- expired lease visibility
- existing lease creation preserved
- existing terminate/expire actions preserved

## 4. Modular Lease Lifecycle Actions

Added:

```text
src/server/lease-lifecycle-actions.ts
```

Actions:

- `createLeaseEventAction`
- `createLeaseRenewalAction`
- `createLeaseNoticeAction`
- `createLeaseDocumentVersionAction`

Security:

- All lifecycle actions call `getCurrentLandlordWorkspace()`.
- All lifecycle actions verify lease ownership through `requireOwnedLease()`.
- All lifecycle actions create audit-log entries.
- All lifecycle actions revalidate `/leases` and `/leases/[leaseId]`.

## 5. Lease Detail Operations Page

Added:

```text
src/app/leases/[leaseId]/page.tsx
```

Capabilities:

- lease overview
- tenant/property/unit context
- days remaining
- rent and deposit display
- lease timeline
- lifecycle events
- renewal workflow display
- notice history
- document version display
- create lifecycle event form
- create renewal form
- create notice form
- upload document version URL form

Security:

- Detail page filters by `landlordId` and `leaseId`.
- If lease does not belong to the current workspace, it returns `notFound()`.

---

# Phase 4 Completion Judgment

Phase 4 is complete as a lease tracking and lifecycle-management foundation.

Status:

```text
Phase 4 Lease Tracking & Alerts Foundation: Complete
```

The module now supports:

- lease dashboard intelligence
- expiration tracking
- vacancy visibility
- renewal pipeline visibility
- per-lease operational command center
- lifecycle event creation
- renewal creation
- notice creation
- document versioning
- audit-backed lifecycle actions

---

# Recommended QA Checklist

Before merging/deploying:

```bash
npx prisma generate
npx tsc --noEmit
npm run build
```

Manual checks:

1. Open `/leases` as landlord.
2. Confirm lease dashboard metrics load.
3. Create a lease using the existing form.
4. Confirm expiring-soon panel renders.
5. Open `/leases/[leaseId]`.
6. Create a lifecycle event.
7. Create a renewal.
8. Create a notice.
9. Add a document version URL.
10. Confirm the lease detail page refreshes and shows the records.
11. Confirm another landlord workspace cannot access the lease detail route.
12. Confirm terminate/expire lease actions still work.

---

# Deferred Enhancements

These should move into later sprints:

- actual email/SMS/WhatsApp alerts
- recurring alert engine
- notice templates
- generated PDF notices
- e-signature integration
- lease amendment workflows
- rent escalation automation
- lease document uploads with secure file storage
- tenant-facing lease detail page
- SuperAdmin lease portfolio oversight

Recommended future phases:

- Phase 8 Payment Gateway + Document Upload Infrastructure
- Phase 9 Automated Alerts
- Phase 10 Concierge/Vendor Operations
- Phase 11 Vacation Rentals
