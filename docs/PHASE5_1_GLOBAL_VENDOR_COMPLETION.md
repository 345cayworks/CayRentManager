# Phase 5.1 — Global Vendor Foundation — Completion

Status: Complete

## What shipped

- `GlobalVendor` Prisma model — platform-level vendor listing, intentionally
  **not landlord-owned** (no `landlordId`, no relation to `LandlordProfile`).
- Netlify database migration `20260516000200_phase5-global-vendor` —
  idempotent `CREATE TABLE IF NOT EXISTS "GlobalVendor"` plus
  `GlobalVendor_status_idx` and `GlobalVendor_approvedStatus_idx`. `status`
  uses the existing `"RecordStatus"` Postgres enum, matching prior migrations.
- Superadmin CRUD at `/admin/vendors` (server component, `requireSuperadmin()`,
  `force-dynamic`):
  - Create global vendor (name required; email/phone/website/specialty/
    serviceAreas/description/logoUrl optional; monthlyFee; approve/feature/
    sponsor checkboxes).
  - Inline edit of all editable fields per vendor (in a `<details>` panel).
  - Quick approve / feature / sponsor flag toggles.
  - Archive and Reactivate (soft archive via `RecordStatus`, `archivedAt`,
    `archivedBy`).
- Server actions in `src/server/global-vendor-actions.ts`, each guarded by
  `requireSuperadmin()`, each writing an `AuditLog` row (`landlordId: null`,
  entity type `GlobalVendor`) and revalidating `/admin/vendors`.
- Pure helpers in `src/lib/vendors/global-vendor.ts`
  (`parseMonthlyFee`, `normalizeVendorFlags`) with unit tests in
  `tests/global-vendor.test.ts`.
- Admin sidebar `Vendors` nav entry (after Landlords, before Billing).
- Monetization fields (`monthlyFee`, `featured`, `sponsored`) exist on the
  model but **no billing behavior** is wired this sprint.

## Deferred to Phase 5.2 / 5.3

- Landlord-facing vendor marketplace UI (Phase 5.2).
- Copy-to-local `MaintenanceVendor` flow (Phase 5.2).
- Monetization / billing logic for `monthlyFee`, sponsored placement,
  Stripe/payment (Phase 5.3).
- Lead / inquiry tracking (later phase).

## Acceptance criteria

- [x] Superadmin can create a global vendor — `createGlobalVendorAction`,
      `/admin/vendors` create form.
- [x] Superadmin can activate/archive a global vendor —
      `archiveGlobalVendorAction` / `reactivateGlobalVendorAction`.
- [x] Global vendors are not landlord-owned — model has no `landlordId`
      and no landlord relation; audit rows use `landlordId: null`.
- [x] Landlords cannot create or edit global vendors — enforced by
      `requireSuperadmin()` on every action and on the only page, and by
      the fact that no landlord-facing route exists.
- [x] Build passes — `prisma generate`, `tsc --noEmit` (0 new errors),
      `vitest`, and full `npm test` suite green.
