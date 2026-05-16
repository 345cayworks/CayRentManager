# Phase 5.2 — Landlord Vendor Marketplace — Completion

Status: **Complete**

## What shipped

- `MaintenanceVendor.globalVendorId` provenance field + `globalVendor` relation
  and `GlobalVendor.localCopies` back-relation.
- Netlify migration `20260516000300_phase5-2-vendor-marketplace` (idempotent):
  adds the column, FK (guarded), lookup index, and the partial unique index.
- Pure marketplace helpers in `src/lib/vendors/marketplace.ts`
  (`sortMarketplaceVendors`, `filterMarketplaceVendors`, `alreadyAddedIds`),
  fully unit tested in `tests/vendor-marketplace.test.ts`.
- `addGlobalVendorToWorkspaceAction` server action: copies an approved + active
  global vendor into the landlord's private `MaintenanceVendor` list.
- "Vendor Marketplace" section in `/maintenance/vendors`: browse approved active
  global vendors, GET search/specialty filter (no client JS), sponsored/featured
  prominence, "Add to My Vendors" copy action, "Added ✓" disabled pill.
- "Global" badge on existing local vendor rows that originated from the
  marketplace.

## Duplicate-protection mechanism

Three layers, defense in depth:

1. **Pre-check** — the action queries for a non-archived `MaintenanceVendor`
   with the same `(landlordId, globalVendorId)` and rejects with a friendly
   "This vendor is already in your list." error.
2. **Partial unique index** — `MaintenanceVendor_landlord_globalVendor_key` on
   `("landlordId", "globalVendorId") WHERE "globalVendorId" IS NOT NULL AND
   "archivedAt" IS NULL`. Closes the concurrent-add race at the database level.
3. **P2002 catch** — a Prisma `P2002` unique-violation thrown by the race is
   caught and rethrown as the same friendly error.

**Archived-copy exemption:** archived copies (`archivedAt` not null) are
excluded by the partial index predicate and by `alreadyAddedIds`, so a landlord
who archived a marketplace vendor can re-add it later.

## Featured / sponsored display rules

- Sort order: **sponsored first, then featured, then name A→Z** (stable);
  sponsored+featured ranks with sponsored.
- **Sponsored** badge: amber; sponsored cards also get an amber ring/border
  accent for visual prominence.
- **Featured** badge: indigo. Badges render only when the flag is set.

## Acceptance criteria

- [x] Landlord can browse active + approved global vendors.
- [x] Landlord can add a global vendor to their vendor list.
- [x] Duplicate copies are prevented (pre-check + partial unique + P2002 catch).
- [x] Existing maintenance request assignment still uses `MaintenanceVendor`
      (copied rows are ordinary `MaintenanceVendor` records; assignment logic
      unchanged).

## Deferred to Phase 5.3

- Monetization / billing on global vendors (`monthlyFee`).
- Lead / inquiry tracking.
- Editing global vendors from the landlord side.
