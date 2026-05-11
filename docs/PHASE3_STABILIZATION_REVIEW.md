# Phase 3 Stabilization Review — Maintenance Requests

Branch: `phase-3-stabilization`

## Purpose

Review Phase 3 maintenance-request work against the roadmap, identify what is complete, what is partially complete, what should be stabilized before more feature work, and what should move to later phases.

---

# Phase 3 Roadmap Target

Original Phase 3 scope:

1. Expand maintenance request workflows for tenants and landlords.
2. Add request metadata: category, priority, permission to enter, preferred contact time.
3. Add attachment support for photos/videos.
4. Add communication threads through maintenance comments.
5. Add vendor records and vendor assignment.
6. Add work order foundation.
7. Add landlord maintenance board.
8. Add notifications foundation for status updates and later email/WhatsApp/SMS.

---

# Completed

## Database / Schema

Completed:

- `MaintenancePriority` enum
- `MaintenanceCategory` enum
- Expanded `MaintenanceRequest`
- `MaintenanceAttachment`
- `MaintenanceComment`
- `MaintenanceVendor`
- `MaintenanceWorkOrder`

Migration:

```text
netlify/database/migrations/20260511000200_phase3-maintenance-foundation/migration.sql
```

Prisma schema updated:

```text
prisma/schema.prisma
```

## Tenant Maintenance Intake

Completed route:

```text
/tenant/maintenance
```

Completed capabilities:

- Tenant can submit a maintenance request.
- Tenant can select category.
- Tenant can select priority.
- Tenant can grant permission to enter.
- Tenant can enter preferred contact time.
- Tenant can include an attachment URL placeholder.
- Tenant can view their request history.
- Tenant can see status, category, priority, vendor assignment, attachment count, and comment count.

## Landlord Maintenance Board

Completed route:

```text
/maintenance
```

Completed capabilities:

- Maintenance board grouped by status.
- Status columns: OPEN, IN_PROGRESS, RESOLVED, CLOSED.
- Request cards show tenant, property, unit, category, priority, permission-to-enter, vendor, attachment count, comment count, and work-order count.
- Landlords can update request status.
- Landlords can add vendors inline.
- Landlords can assign vendors.
- Landlords can create work orders.

## Server Actions

Completed action foundations:

- `createTenantMaintenanceRequestAction`
- `addMaintenanceAttachmentAction`
- `addMaintenanceCommentAction`
- `createMaintenanceVendorAction`
- `assignMaintenanceVendorAction`
- `createMaintenanceWorkOrderAction`
- `updateMaintenanceStatusAction`

## Navigation

Stabilization patch added the new Phase 2 and Phase 3 routes to the app shell.

Landlord sidebar now includes:

- Dashboard
- Properties
- Units
- Tenants
- Leases
- Payments
- Payment Settings
- Maintenance
- Expenses
- Documents
- Reports

Tenant sidebar now includes:

- Dashboard
- Maintenance

---

# Partially Complete

## Attachments

Current state:

- Data model exists.
- Server action exists.
- Tenant form accepts an attachment URL placeholder.

Not complete:

- No real file upload storage yet.
- No signed/private file access.
- No attachment preview/gallery UI.

Recommendation:

Move real upload infrastructure to a later upload/media sprint or Phase 8 shared infrastructure.

## Comments / Threading

Current state:

- Data model exists.
- Server action exists.
- Counts display in tenant and landlord lists.

Not complete:

- No comment thread UI yet.
- No maintenance detail page yet.

Recommendation:

Add a maintenance detail page during stabilization after build/type checks pass.

## Vendors

Current state:

- Vendor model exists.
- Vendor creation exists inline on `/maintenance`.
- Vendor assignment exists.

Not complete:

- No dedicated vendor directory page.
- No vendor edit/archive workflow.
- No vendor performance metrics.

Recommendation:

Keep inline vendor creation for Phase 3. Dedicated vendor management can move to Phase 3.5 or Phase 10 concierge/vendor operations.

## Work Orders

Current state:

- Work order model exists.
- Landlords can create work orders from the board.

Not complete:

- No work-order detail/edit screen.
- No completed/actual-cost update workflow.
- No vendor-facing view.

Recommendation:

Keep as foundation for Phase 3 MVP. Expand after stabilization.

---

# Not Completed Yet

## Maintenance Detail Page

Missing route:

```text
/maintenance/[maintenanceId]
```

Should include:

- Full request details
- Tenant/property/unit context
- Attachments
- Comments
- Add-comment form
- Work orders
- Vendor details
- Status controls

## Search / Filters

Missing:

- Filter by status
- Filter by priority
- Filter by category
- Filter by vendor
- Search by tenant/property/title

## Notifications Foundation

Missing:

- Notification model/service integration for maintenance status changes
- Dashboard notifications
- Email hooks
- WhatsApp/SMS placeholders

Recommendation:

Notification foundation should be coordinated with Phase 9 Automated Alerts.

## SLA / Response Tracking

Missing:

- First-response timestamp
- Resolution time
- Overdue maintenance escalation
- Priority-based SLA rules

Recommendation:

Move to Phase 10 concierge/SLA operations or Phase 9 alerts.

---

# Stabilization Risks

## 1. Migration Compatibility Risk

The Phase 3 migration adds `priority` as enum using:

```sql
ADD COLUMN IF NOT EXISTS "priority" "MaintenancePriority" NOT NULL DEFAULT 'MEDIUM'
```

If the previous production database already had `MaintenanceRequest.priority` as text, this statement may skip adding/changing the column, leaving DB type mismatched from Prisma.

Recommended fix:

Add a follow-up compatibility migration that checks the existing column type and converts or recreates it safely if needed.

## 2. Server Action Size Risk

`src/server/actions.ts` is now too large and mixes multiple domains.

Recommended fix:

Split into domain files:

```text
src/server/actions/landlord.ts
src/server/actions/payments.ts
src/server/actions/maintenance.ts
src/server/actions/admin.ts
```

This will reduce future GitHub SHA conflicts and make stabilization safer.

## 3. Maintenance Ownership Hardening

The app already has `requireOwnedMaintenanceRequest()`, but maintenance actions should consistently use it before mutations.

Recommended hardening targets:

- `assignMaintenanceVendorAction`
- `createMaintenanceWorkOrderAction`
- `updateMaintenanceStatusAction`
- `addMaintenanceAttachmentAction`
- `addMaintenanceCommentAction`

## 4. SuperAdmin Workspace Access

`getCurrentLandlordWorkspace()` does not allow `SUPERADMIN`.

This is safer by default, but it means SuperAdmin cannot directly access landlord pages unless they also have a landlord workspace role.

Recommendation:

Keep this as-is for now. Later, build explicit SuperAdmin impersonation/select-workspace tooling rather than silently granting access.

---

# Stabilization Sprint Recommendation

## Must Do Before Phase 4

1. Verify latest Netlify deploy logs.
2. Run:

```bash
npx prisma generate
npx tsc --noEmit
npm run build
```

3. Patch any build errors.
4. Add migration compatibility fix if needed.
5. Harden maintenance ownership actions.
6. QA tenant maintenance submission.
7. QA landlord maintenance board.
8. QA vendor assignment.
9. QA work-order creation.
10. Merge navigation stabilization patch.

## Should Do Before Expanding Phase 3

1. Add `/maintenance/[maintenanceId]` detail page.
2. Add comments thread UI.
3. Add attachment preview UI.
4. Add filters/search.

## Move to Later Phases

Move these out of Phase 3 completion criteria:

- Real file upload infrastructure
- Email/WhatsApp/SMS notifications
- Vendor performance metrics
- SLA automation
- Maintenance prediction/AI insights

---

# Phase 3 Completion Judgment

Phase 3 is complete as an operational MVP, but not as a fully mature maintenance module.

Status:

```text
Phase 3 MVP: Complete
Phase 3 Stabilization: In progress
Phase 3 Advanced Operations: Deferred
```
