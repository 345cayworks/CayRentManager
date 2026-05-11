# Stabilization Completion Checklist

Branch: `phase-3-stabilization`

## Completed in This Stabilization Sprint

- Created `phase-3-stabilization` from current `main`.
- Reviewed Phase 3 roadmap against implemented work.
- Added Phase 2 and Phase 3 routes to navigation.
- Added tenant maintenance route to tenant navigation.
- Added landlord maintenance and payment-settings routes to landlord navigation.
- Added `docs/PHASE3_STABILIZATION_REVIEW.md`.
- Added maintenance enum compatibility migration:
  - `netlify/database/migrations/20260511000300_phase3-maintenance-enum-compatibility/migration.sql`
- Reduced production migration risk for legacy `MaintenanceRequest.priority` and `MaintenanceRequest.category` columns.

## High-Priority Items Still Requiring Build/Runtime Validation

These must be verified through Netlify deploy preview or local build:

```bash
npx prisma generate
npx tsc --noEmit
npm run build
```

## Deferred High-Priority Items

The following are still important, but should be done as controlled follow-up branches because they require wider code changes:

### Split `src/server/actions.ts`

Reason for deferral:

- The file is large and active.
- A direct hardening patch already hit a GitHub SHA conflict.
- Splitting it should be done in a dedicated refactor branch with build verification after each domain extraction.

Recommended branch:

```text
stabilization-actions-refactor
```

Recommended target structure:

```text
src/server/actions/admin.ts
src/server/actions/landlord.ts
src/server/actions/payments.ts
src/server/actions/maintenance.ts
src/server/actions/index.ts
```

### Harden Maintenance Ownership Mutations

Reason for deferral:

- Should be completed during or immediately after extracting `maintenance.ts` from `actions.ts`.
- This avoids repeated SHA conflicts and reduces risk of accidentally truncating server actions.

Target actions:

- `assignMaintenanceVendorAction`
- `createMaintenanceWorkOrderAction`
- `updateMaintenanceStatusAction`
- `addMaintenanceAttachmentAction`
- `addMaintenanceCommentAction`

### Add Maintenance Detail Page

Recommended route:

```text
/maintenance/[maintenanceId]
```

Reason for deferral:

- Should be added after build verification confirms Phase 3 stabilization is clean.

### Add Comments Thread UI

Reason for deferral:

- Depends naturally on the maintenance detail page.

## Recommended Merge Gate

Before merging `phase-3-stabilization` to `main`, verify:

- Netlify deploy preview succeeds.
- Migration applies successfully.
- Landlord sidebar shows Payment Settings and Maintenance.
- Tenant sidebar shows Maintenance.
- Tenant can submit a maintenance request.
- Landlord can add vendor.
- Landlord can assign vendor.
- Landlord can update status.
- Landlord can create work order.

## Completion Judgment

This stabilization sprint completes the safest high-priority tasks that do not require risky large-file refactoring.

Status:

```text
Phase 3 Stabilization Sprint 1: Complete
Actions Refactor / Ownership Hardening: Follow-up required
```
