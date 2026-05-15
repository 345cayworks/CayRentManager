# Phase 3 — Maintenance Foundation Completion Report

## Status

```text
Complete (sprint closeout)
```

Phase 3 closes with vendor management, dispatch workflow, SLA tracking, and a
vendor portal login. Photo uploads and the global vendor marketplace are
intentionally deferred to later phases.

## What shipped

### 1. Richer vendor UI

- `/maintenance/vendors` now splits active and archived vendors.
- Vendors can be created with address, licence number, and insurance expiry.
- `/maintenance/vendors/[vendorId]` provides a full edit form, open
  assignments, work order history (last 20), and metadata.
- Vendors can be archived and restored from either the list page or the
  detail page.

### 2. Work-order dispatch workflow

- `WorkOrderStatus` is now a database-backed enum with the lifecycle:
  `OPEN → DISPATCHED → IN_PROGRESS → COMPLETED` plus `CANCELLED`.
- Allowed transitions are guarded by `src/lib/maintenance/workorder.ts`.
- Work-order rows on `/maintenance/[id]` expose inline forms to dispatch,
  start, complete (with actual cost + completion notes), and cancel.
- The maintenance board surfaces a "Dispatch" button on cards whose latest
  work order is still `OPEN` and has a vendor assigned.
- Completing the last open work order on a request auto-resolves the parent
  `MaintenanceRequest`.

### 3. Maintenance SLA tracking

- Per-priority targets: `URGENT 4h`, `HIGH 24h`, `MEDIUM 72h`, `LOW 168h`.
- New columns on `MaintenanceRequest`: `slaDueAt`, `slaBreachedAt`,
  `firstResponseAt`, `resolvedAt`.
- `src/lib/maintenance/sla.ts` exposes `computeSlaDueAt`, `getSlaStatus`, and
  `formatSlaCountdown`.
- SLA badges (on track / at risk / overdue / met) render on the maintenance
  board, the detail page, and the vendor portal.
- The migration backfills `slaDueAt` for existing requests based on priority.

### 4. Vendor portal login

- New `requireVendorUser` auth guard.
- `MaintenanceVendor` can be linked to a `User` via `enableVendorPortalAction`
  (creates a `PENDING_INVITE` user if the email is new). Portal access can be
  disabled at any time.
- New routes:
  - `/vendor/dashboard` — open / in-progress / completed-this-month stats and
    list, with an `?tab=completed` view.
  - `/vendor/work-orders/[id]` — request summary, SLA badge, timestamps,
    accept / complete actions, and update thread.
- Identity session redirect now sends `VENDOR` / `MAINTENANCE_PROVIDER` users
  to `/vendor/dashboard`.
- Shell nav renders a vendor-specific link set for those roles.

## Deferred

- **Before/after photo uploads** — waits on Phase 7 (`@netlify/blobs`).
- **Global vendor marketplace** — tracked as Phase 5.1.

## Migration file

```text
netlify/database/migrations/20260515000100_phase3-sprint-closeout/migration.sql
```

Idempotent. Creates the enum, converts the existing TEXT column when needed,
adds new columns to `MaintenanceRequest`, `MaintenanceVendor`,
`MaintenanceWorkOrder`, adds the FK + unique partial index for the vendor's
linked user, and backfills `slaDueAt`.

## Manual QA checklist

```text
[ ] Create a vendor with the full set of new fields (address, licence,
    insurance expiry, notes).
[ ] Open the vendor detail page and confirm the edit form persists changes.
[ ] Archive an active vendor; confirm it moves to the Archived section and
    no longer appears in assignment dropdowns.
[ ] Restore the archived vendor; confirm it reappears as active.
[ ] Enable portal access for a vendor with a brand-new email; confirm the
    invite user is created (PENDING_INVITE, mustChangePassword).
[ ] Sign in as the vendor portal user once activated; land on
    /vendor/dashboard.
[ ] Disable portal access; confirm the vendor.userId is cleared.
[ ] Create a maintenance request; confirm slaDueAt is set based on priority.
[ ] Create a work order with a vendor; dispatch it from the maintenance
    board; status moves to DISPATCHED and dispatchedAt is set.
[ ] Vendor accepts the work order from the portal; status moves to
    IN_PROGRESS, vendorAcknowledgedAt + startedAt are set.
[ ] Vendor completes the work order with an actual cost; status moves to
    COMPLETED, parent request flips to RESOLVED.
[ ] Verify SLA badges (On track / At risk / Overdue / Met) render on the
    maintenance board, detail page, and vendor portal.
[ ] Confirm a non-vendor user cannot reach /vendor/dashboard.
```
