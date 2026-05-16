# CayRentManager Roadmap & Current Status

_Last updated: May 2026_

## 1. Product Vision

CayRentManager is evolving from a landlord record-management app into a Cayman-focused property operations platform.

The platform is designed to help landlords, property managers, accountants, tenants, vendors, concierge agents, and platform administrators manage rental operations from one secure system.

Strategic direction:

```text
Property management + operational intelligence + vendor network + compliance/document workflows
```

The long-term goal is not only to help landlords track properties, leases, rent, documents, and maintenance, but to become a monetizable property operations network for the Cayman Islands and eventually other Caribbean markets.

---

## 2. Current Architecture

### Core Stack

- Next.js App Router
- TypeScript
- Prisma ORM
- PostgreSQL / Netlify Database
- Netlify Identity
- Custom app session bridge
- Tailwind CSS
- Netlify deployment
- Netlify scheduled/serverless functions
- Netlify database migrations

### Authentication Model

Netlify Identity handles:

- signup
- login
- logout
- password recovery
- identity session

Prisma controls application access:

- user role
- user status
- landlord memberships
- tenant linkage
- disabled/suspended access
- audit history

### App Session Model

After Netlify Identity login, the app syncs the identity user into the Prisma `User` table and creates a signed app session cookie.

Session cookie:

```text
crm_app_session
```

The cookie is:

- HttpOnly
- signed
- stored as a hash in the database
- expiring after 14 days

Required environment variable:

```text
APP_SESSION_SECRET
```

---

## 3. Current Production Status

Current classification:

```text
B+ / Early Beta Foundation
```

The platform now has meaningful operational depth, but final production confidence still depends on clean Netlify deploys, manual QA, and continued hardening of onboarding, permissions, and edge cases.

### Latest Confirmed Main Status

Latest confirmed merged work includes:

- Phase 3 sprint closeout (vendor management, dispatch workflow, SLA tracking, vendor portal)
- Phase 4 alert center and alert automation foundation
- Phase 6 notification infrastructure closeout (alert escalation engine + team-member resolution; SMS/WhatsApp channel abstraction)
- document vault foundation
- Phase 5.1 global vendor foundation
- Phase 5.2 landlord vendor marketplace
- Phase 5.3 vendor monetization layer (the full Phase 5.x vendor track is now complete)
- registration workflow tightening
- professional onboarding page
- auth input readability fix
- password visibility toggles
- Phase 7 real upload infrastructure (Netlify Blobs)
- Property & Unit Photos (galleries, primary photo, list thumbnails, secure image endpoints)
- Phase 8 reporting & accounting expansion (reports hub + 7 reports with date-range filters and CSV export; owner statements deferred)
- Phase 9 tenant portal expansion (tenant lease view, payment history + balance, two-way landlord⇄tenant messaging with inbox/thread, unread badges; owner statements/attachments/email-SMS-of-messages/realtime deferred)
- Landlord⇄Vendor messaging (generalized inbox for tenants AND portal-linked vendors, landlord vendor thread + vendor-portal thread, vendor mark-read + nav badge; schema-free); Phase 5.3 marketplace "Request a quote" now actually delivers (in-app message to a portal-linked workspace copy of the global vendor, else queued email via the Phase 6 outbox, lead always recorded)

Latest confirmed `main` after registration workflow tightening was merged in PR #30. The merge commit is documented in GitHub as `931c47717691bdefce7037a2337dddd339c51d7b`.

---

## 4. Completed / Implemented Areas

## Phase 1 — Core Platform Stabilization

Status:

```text
Complete
```

Implemented or substantially improved:

- role model
- user status model
- landlord workspace model
- app session bridge
- scoped landlord access helpers
- superadmin access model
- no-hard-delete direction for operational records
- Netlify database migration discipline
- route and navigation stabilization work
- automated access-control and workspace-isolation tests
- tenant invite edge-case tests (expired, mismatch, already-accepted, concurrent claim, disabled account)
- final bootstrap endpoint policy (env-gated, master-key-gated, optional IP allowlist, timing-safe, audit-logged, 404 when disabled)
- minimum-field `/api/identity/me` response

Ongoing operational requirement:

- Full manual QA pass for all role redirects before each Netlify deploy, using `tests/security-phase1-checklist.md`.

---

## Platform Time Preferences

Status:

```text
Complete
```

Every visible date is now rendered through `formatDate`/`formatDateTime`
(`src/lib/time/format.ts`) with a request-resolved timezone
(`getEffectiveTimezone()` in `src/lib/time/effective.ts`). Resolution
order: landlord workspace → tenant's landlord → vendor's landlord →
platform default → built-in `America/Cayman`. Superadmins edit the
platform default at `/admin/settings`; landlords edit their workspace
preference under `/account/profile`. See `docs/PLATFORM_TIME_PREFS.md`
for details.

---

## Phase 2 — Superadmin Platform Management

Status:

```text
Complete
```

Implemented:

- superadmin role
- admin dashboard area
- user management foundation
- landlord management foundation
- audit log structure
- reset/temporary-password work from previous sprint
- user account status controls
- platform analytics at `/admin/analytics` (growth, role distribution, top workspaces, financial KPIs)
- richer audit views at `/admin/audit` (filterable by actor, action, entity, paginated)
- admin safety review at `/admin/safety` (live audit of guardrails and bootstrap policy state)
- platform billing/plan management at `/admin/billing`
- platform timezone + currency defaults at `/admin/settings`

Deferred to later phases:

- global vendor management (moved to Phase 5.1)
- user impersonation (intentionally not built — privacy/security boundary)

---

## Phase 3 — Maintenance Foundation

Status:

```text
Complete
```

Implemented:

- maintenance request model
- maintenance categories
- maintenance priority
- maintenance status
- attachments/comments/work-order structure
- landlord maintenance vendor model
- maintenance vendor assignment concept
- vendor/work-order relations
- richer vendor UI (edit, archive, restore, contact + licence + insurance)
- vendor portal login (`/vendor/dashboard`, `/vendor/work-orders/[id]`)
- work-order dispatch workflow with `WorkOrderStatus` enum and guarded transitions
- maintenance SLA tracking (per-priority targets, due-by, breach badges)

Current vendor model:

```text
MaintenanceVendor is landlord-scoped through landlordId
```

This means each landlord can maintain their own private vendor list.

Deferred to later phases:

- before/after photo uploads (Phase 7, blocked on `@netlify/blobs`)
- vendor marketplace/global vendor layer (Phase 5.1)

---

## Phase 4 — Lease Tracking & Alerts

Status:

```text
Complete
```

Implemented:

- lease model and lease status
- lease events
- lease renewals
- lease notices
- lease document versions
- lease operations dashboard
- lease expiration alert engine
- alert severity logic
- persistent alert snapshots
- scheduled alert scanner
- alert lifecycle states
- alert center UI
- review/dismiss workflow
- alert dashboard integration
- alert badges in landlord navigation
- per-user alert preferences at `/account/notifications` (digest on/off, minimum severity, suppressed types)
- daily digest scheduled function (`alert-digest-daily.ts`)
- hourly escalation scan scheduled function (`alert-escalation-scan.ts`)
- notification outbox + log-only default driver + Resend driver behind env

Alert lifecycle:

```text
ACTIVE → REVIEWED → RESOLVED / DISMISSED
```

Notification outbox lifecycle:

```text
PENDING → SENT / FAILED / SKIPPED
```

Deferred to later phases:

- escalation routing — DONE in Phase 6 (rules engine + team-member resolution by membership role); see `docs/PHASE6_NOTIFICATION_COMPLETION.md`
- concierge assignment (blocked on the concierge role rollout in Phase 5+)

---

## Phase 4.4 — Document Infrastructure

Status:

```text
Complete
```

Implemented:

- document vault page
- document metadata workflow
- document archive workflow
- document association to property/unit/tenant/lease
- upload validation layer
- supported file types
- external document URL support
- install and commit `@netlify/blobs`
- real binary upload to Netlify Blobs
- secure download endpoint
- image/PDF preview
- document visibility rules
- tenant-visible documents

Supported upload types in validation layer:

```text
PDF, JPG, PNG, WEBP, DOC, DOCX
```

Current storage state:

```text
Netlify Blobs (stored) + external URLs + flagged broken placeholders
```

Deferred:

- compliance expiry alerts — belongs to the alert engine (tracked under the
  alert automation roadmap, not document storage)

---

## Registration Phase 1 — Workflow Tightening

Status:

```text
Completed
```

Implemented:

- confirm password field
- password strength validation
- password requirements helper text
- default auth redirect aligned to dashboard
- auth input text readability fix
- password show/hide toggle
- black/dark input text on white background
- safer registration UX

Password rules:

```text
Minimum 8 characters
At least one uppercase letter
At least one number
```

---

## Registration Phase 2 — Professional Onboarding

Status:

```text
Complete
```

Implemented:

- new landlord onboarding route with progress hero, dismiss, restore, and mark-complete actions
- first-login onboarding redirect when a workspace is created
- dedicated `/onboarding/company-profile` wizard that captures contact, address, branding, and operational defaults
- dedicated `/properties/new`, `/units/new`, and `/tenants/new` guided wizards with save-and-continue flow
- onboarding completion persistence (`onboardingCompletedAt` / `onboardingCompletedBy`)
- skip/dismiss onboarding preference (`onboardingDismissedAt` / `onboardingDismissedBy`)
- dashboard onboarding nudge card and sidebar `Onboarding` badge with remaining count

Current onboarding milestones:

```text
Complete company profile
Add first property
Create units
Invite tenants
Activate maintenance tracking
```

Future enhancements (out of scope for Phase 2 closeout):

- onboarding analytics and per-milestone funnel reporting
- logo file uploads (currently logo is a URL field)

---

## 5. Current Route Map

### Public Routes

```text
/
/login
/register
/invite/[token]
/unauthorized
```

### Registration / Onboarding

```text
/onboarding
/dashboard
```

Note:

```text
/dashboard is provided by the landlord route group and must not be duplicated by src/app/dashboard/page.tsx.
```

### Superadmin Routes

```text
/admin
/admin/users
/admin/landlords
/admin/vendors
/admin/audit
/admin/settings
```

### Landlord Routes

```text
/dashboard
/alerts
/properties
/units
/tenants
/leases
/payments
/payments/settings
/maintenance
/maintenance/vendors
/expenses
/documents
/reports
/reports/tenant-balances
/reports/payment-history
/reports/expenses
/reports/property-pl
/reports/cashflow
/reports/maintenance-costs
/reports/lease-expiry
/financials
/financials/rent-roll
/messages
/messages/[tenantId]
/messages/vendor/[vendorId]
```

### Tenant Routes

```text
/tenant/dashboard
/tenant/lease
/tenant/payments
/tenant/maintenance
/tenant/documents
/tenant/messages
```

### Vendor Routes

```text
/vendor/dashboard
/vendor/work-orders/[id]
/vendor/messages
```

### Secure Download API Routes

```text
/api/documents/[documentId]/download
/api/maintenance/attachments/[attachmentId]/download
/api/properties/[propertyId]/photos/[photoId]
/api/units/[unitId]/photos/[photoId]
```

Property and unit detail/list routes also surface photo galleries and
primary-photo thumbnails.

---

## 6. Current Core Data Models

Current major models include:

```text
User
AppSession
LandlordProfile
LandlordMembership
Property
Unit
Tenant
TenantInvitation
Lease
LeaseEvent
LeaseRenewal
LeaseNotice
LeaseDocumentVersion
LeaseAlertSnapshot
Invoice
Payment
Receipt
PaymentProof
PaymentMethod
BankAccount
Expense
MaintenanceRequest
MaintenanceAttachment
MaintenanceComment
MaintenanceVendor
MaintenanceWorkOrder
Document
Message
AuditLog
```

Current role enum includes:

```text
SUPERADMIN
LANDLORD
PROPERTY_MANAGER
ACCOUNTANT
TENANT
VENDOR
MAINTENANCE_PROVIDER
CONCIERGE_AGENT
GUEST
```

---

## 7. New Strategic Opportunity — Global Vendor Marketplace

Status:

```text
Recommended next monetization phase
```

Current vendor state:

```text
Landlords can have their own private MaintenanceVendor records.
```

Proposed expansion:

```text
Superadmins can onboard global vendors that all landlords can access.
```

Strategic value:

- new revenue stream
- stronger marketplace defensibility
- vendor sponsorship opportunities
- concierge/service dispatch opportunities
- Cayman-specific property operations network

### Recommended Architecture

Do not make `MaintenanceVendor.landlordId` optional.

Instead, add a separate platform-level model:

```prisma
model GlobalVendor {
  id              String       @id @default(cuid())
  name            String
  email           String?
  phone           String?
  website         String?
  specialty       String?
  serviceAreas    String?
  description     String?
  logoUrl         String?
  approvedStatus  Boolean      @default(false)
  featured        Boolean      @default(false)
  sponsored       Boolean      @default(false)
  monthlyFee      Decimal?
  status          RecordStatus @default(ACTIVE)
  createdAt       DateTime     @default(now())
  updatedAt       DateTime     @updatedAt
}
```

Optional bookmark/copy model:

```prisma
model LandlordVendorBookmark {
  id             String   @id @default(cuid())
  landlordId     String
  globalVendorId String
  createdAt      DateTime @default(now())

  @@unique([landlordId, globalVendorId])
}
```

### Recommended MVP Approach

Use a copy-to-local approach:

```text
Global Vendor → Add to My Vendors → creates landlord-scoped MaintenanceVendor copy
```

Why:

- least risky
- current maintenance assignment workflow keeps working
- landlord can add private notes
- avoids changing work-order relations immediately

### Monetization Options

Potential streams:

- paid vendor listings
- featured placement
- sponsored categories
- verified vendor badge
- lead generation fee
- concierge dispatch fee
- category exclusivity

Possible Cayman price bands:

```text
Verified listing: KYD $49–KYD $149/month
Featured listing: KYD $99–KYD $299/month
Category exclusivity: KYD $500–KYD $1,500/month
Lead fee: KYD $10–KYD $25 per qualified inquiry
Concierge dispatch: 5%–15% of work order value
```

---

## 8. Recommended Next Development Phases

## Phase 5.1 — Global Vendor Foundation

Status:

```text
Complete
```

Priority:

```text
High
```

Goal:

Allow superadmins to create and manage platform-level vendor listings.

Build:

- `GlobalVendor` Prisma model
- Netlify database migration
- `/admin/vendors`
- create/edit/archive global vendor
- approve/unapprove vendor
- featured/sponsored flags
- specialty and service-area fields
- notes/description

Acceptance criteria:

- Superadmin can create a global vendor.
- Superadmin can activate/archive a global vendor.
- Global vendors are not landlord-owned.
- Landlords cannot create or edit global vendors.
- Build passes.

---

## Phase 5.2 — Landlord Vendor Marketplace

Status:

```text
Complete
```

Priority:

```text
High
```

Goal:

Allow landlords to browse global vendors and add them to their local vendor list. The marketplace lives at `/maintenance/vendors`.

Build:

- marketplace section in `/maintenance/vendors`
- search/filter by specialty
- visible featured vendors
- `Add to My Vendors` action
- duplicate protection
- global vendor badge
- local copy creation into `MaintenanceVendor`

Acceptance criteria:

- Landlord can browse active global vendors.
- Landlord can add a global vendor to their vendor list.
- Duplicate copies are prevented.
- Existing maintenance request assignment still uses `MaintenanceVendor`.

---

## Phase 5.3 — Vendor Monetization Layer

Status:

```text
Complete
```

Priority:

```text
Medium-high
```

Goal:

Turn global vendors into a revenue stream.

Build:

- monthly fee field
- sponsored/featured reporting
- vendor listing status
- inquiry tracking
- lead count tracking
- manual billing notes
- later: Stripe/payment integration

Acceptance criteria:

- Superadmins see MRR plus billable/at-risk/trialing and sponsored/featured counts.
- Per-vendor billing status, monthly fee, paid-through, and notes are editable.
- Copy-to-local records an `ADD_TO_LIST` lead (best-effort, never blocks the add).
- Landlords can send an inquiry on an active, approved global vendor.
- Lead counts are visible per vendor for superadmins.

Deferred (out of scope for this phase): Stripe/payment processor
integration, automated invoicing/dunning, and inquiry notifications
through the notification outbox.

---

## Phase 6 — Notification Infrastructure

Status:

```text
Complete
```

Priority:

```text
High
```

Build:

- alert badges in navigation
- unread alert counts
- notification preferences
- daily digest framework
- email abstraction
- SMS/WhatsApp-ready abstraction — DONE: channel driver registry (EMAIL Resend/log, SMS + WhatsApp Twilio/log via `fetch`), `recipientPhone` routing
- escalation rules — DONE: per-workspace `EscalationPolicy` with platform defaults, pure unit-tested evaluator (threshold + severity gate + repeat cadence + idempotent levels), team-member resolution by membership role, hourly `alert-escalation-scan.ts`

See `docs/PHASE6_NOTIFICATION_COMPLETION.md` for the escalation model, level math, channel/env matrix, and skipped notes.

---

## Phase 7 — Real Upload Infrastructure

Status:

```text
Complete
```

Implemented:

- `@netlify/blobs` installed and committed
- blob storage helpers (`src/lib/storage/blobs.ts`) with sanitized,
  workspace-scoped keys for documents and maintenance attachments
- real document binary upload (`uploadDocumentAction`) replacing the
  data-losing `pending-blob-upload://` placeholder
- secure auth-scoped document download endpoint with a pure, unit-tested
  access-control decision function (`canAccessDocument`)
- real maintenance photo/attachment uploads + secure download endpoint
- document visibility rules (LANDLORD_ONLY / TENANT_VISIBLE)
- real tenant document portal (`/tenant/documents`) + tenant nav entry
- broken-placeholder remediation: migration backfills legacy placeholder
  rows to `BROKEN_PLACEHOLDER`, UI flags them, hard-delete remediation action
- image/PDF inline preview vs. attachment download
- property & unit photo galleries (primary photo, list thumbnails, secure
  image endpoints) — see docs/PROPERTY_UNIT_PHOTOS.md

---

## Phase 8 — Reporting & Accounting Expansion

Status:

```text
Complete (owner statements deferred)
```

Priority:

```text
Medium-high
```

Build:

- rent roll
- tenant balance report
- payment history
- expense report
- property P&L
- unit cashflow
- portfolio cashflow
- maintenance cost report
- lease expiry report
- owner statements later

---

## Phase 9 — Tenant Portal Expansion

Priority:

```text
Medium
```

Status:

```text
Complete
```

Build:

- tenant lease view
- tenant payment history
- tenant balance
- tenant maintenance requests
- tenant document vault
- landlord messages

### Landlord⇄Vendor Messaging

Status:

```text
Complete
```

Build:

- generalized messaging inbox for tenants AND portal-linked vendors (participant resolver: tenant preferred, else vendor)
- landlord vendor thread (`/messages/vendor/[vendorId]`) + vendor-portal thread (`/vendor/messages`)
- `sendVendorMessageAction` / `sendVendorPortalMessageAction`; `markMessagesReadAction` extended to VENDOR / MAINTENANCE_PROVIDER
- vendor nav Messages link with resilient unread badge
- Phase 5.3 marketplace "Request a quote" now delivers: in-app message when a portal-linked workspace copy of the global vendor exists, else queued email via the Phase 6 outbox; the `GlobalVendorLead` is always recorded (delivery is best-effort)
- schema-free (Message is user↔user; `notificationKind` is free-text)

---

## Phase 10 — Production Polish & Public Beta

Priority:

```text
Ongoing
```

Build:

- mobile polish
- empty states
- loading states
- toasts
- confirmation modals
- error boundaries
- privacy policy
- terms of service
- backup/recovery process
- public beta onboarding checklist

---

## 9. Immediate Backlog

## Critical

- Confirm Netlify build passes after the latest fixes.
- Confirm `/login` input text is visible.
- Confirm password show/hide works.
- Confirm `/dashboard` has only one route source.
- Confirm `/onboarding` does not import missing dependencies.
- Confirm `/alerts` renders inside the sidebar shell.
- Confirm `/admin/analytics`, `/admin/audit`, and `/admin/safety` render for superadmins.

## High Priority

- Implement Phase 5.1 global vendor foundation.
- Add `/admin/vendors`.
- Add marketplace section to `/maintenance/vendors`.
- Add real upload infrastructure.
- Add alert badges and notification counts.

## Medium Priority

- Add guided `/properties/new` and `/units/new` routes.
- Add onboarding completion persistence.
- Add document visibility rules.
- Add reporting expansion.

---

## 10. Manual QA Checklist

Before production deploy:

```text
npm install passes
npx prisma generate passes
npm run build passes
/login loads
/register loads
Typed login text is visible
Password show/hide works
New landlord registration works
New landlord lands on onboarding
Existing landlord lands on dashboard
/dashboard loads without route collision
/onboarding loads without missing packages
/alerts loads with sidebar
/documents loads with sidebar
/leases loads
/maintenance/vendors loads
Superadmin can access /admin
Landlord cannot access /admin
Tenant cannot access landlord dashboard
Disabled users are blocked
No cross-landlord data leakage
No hard deletes for operational records
```

---

## 11. Current Strategic Position

CayRentManager now has the building blocks of a serious property operations platform:

- landlord workspace management
- property/unit/tenant/lease foundations
- payments and accounting foundation
- maintenance foundation
- document vault foundation
- operational alert engine
- scheduled alert automation
- professional onboarding
- superadmin foundation

The highest-value next product move is:

```text
Global Vendor Marketplace + Maintenance Vendor Monetization
```

This turns the platform from a landlord software tool into a Cayman property operations network.
