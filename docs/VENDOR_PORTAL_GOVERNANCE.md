# Vendor Portal Governance

## Model

Previously landlords directly enabled a vendor's portal login. The governance
model is now:

- **Landlords add vendors** to their workspace as before
  (`createMaintenanceVendorAction`, `addGlobalVendorToWorkspaceAction`). This is
  unchanged and applies to any `MaintenanceVendor` in their workspace, private or
  copied from a global vendor.
- **Landlords request portal enabling** for vendors they manage. They no longer
  enable directly — they submit a `VendorPortalRequest` that a superadmin
  reviews. A landlord may cancel their own pending request, and may still
  **disable** an already-enabled portal for their own vendor (safe
  de-escalation).
- **Superadmin is the authority.** A superadmin approves or rejects requests,
  and can also directly enable a portal for any workspace vendor without a
  request.

## Request lifecycle

```
PENDING ──approve──▶ APPROVED   (vendor login linked/created)
   │
   ├────reject────▶ REJECTED    (landlord may submit a new request)
   │
   └────cancel────▶ CANCELLED   (landlord-initiated)
```

Only `PENDING` requests can be approved, rejected, or cancelled
(`canDecide` in `src/lib/vendors/portal-request.ts`). A landlord may submit a
new request only when the vendor is not already portal-enabled and there is no
pending request (`canRequest`).

## One pending per vendor

A partial unique index enforces at most one open request per vendor:

```sql
CREATE UNIQUE INDEX "VendorPortalRequest_one_pending_per_vendor"
  ON "VendorPortalRequest"("maintenanceVendorId") WHERE status = 'PENDING';
```

`requestVendorPortalAction` also pre-checks for an existing pending request and
catches the Prisma `P2002` from the partial unique as a friendly
"already pending" error.

## Where each action lives

All in `src/server/actions.ts`:

| Action | Caller | Notes |
| --- | --- | --- |
| `requestVendorPortalAction` | landlord (workspace-scoped) | creates a `PENDING` request |
| `cancelVendorPortalRequestAction` | landlord (workspace-scoped) | cancels own pending request |
| `approveVendorPortalRequestAction` | superadmin | links portal user, marks `APPROVED` |
| `rejectVendorPortalRequestAction` | superadmin | marks `REJECTED` |
| `superadminEnableVendorPortalAction` | superadmin | direct enable, no request |
| `disableVendorPortalAction` | owning landlord OR superadmin | clears `userId`/`portalEnabledAt` |

`linkVendorPortalUser` is an internal (non-exported) helper that performs the
find-or-create `User` + role/uniqueness checks + vendor link. It is shared by
the approve and superadmin-direct paths so behavior is identical to the old
direct-enable flow.

## UI

- **Superadmin:** `/admin/vendor-portal` — pending requests with approve/reject
  forms, a direct-enable form (by vendor ID + portal email), and the last 20
  decided requests.
- **Landlord:** `/maintenance/vendors/[vendorId]` Portal Access section shows,
  per state: disable form (enabled), cancel form (pending request), or a
  request form (no request / previously rejected, with the rejection note
  surfaced).

## What changed

- The landlord-callable `enableVendorPortalAction` (old direct enable) was
  removed; its only importer (the vendor detail page) was updated.
- `disableVendorPortalAction` was broadened from landlord-only to allow the
  owning landlord OR a superadmin.
- New model `VendorPortalRequest` + idempotent migration
  `20260516000600_vendor-portal-requests`.
