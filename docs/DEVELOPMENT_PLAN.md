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
- document vault foundation
- registration workflow tightening
- professional onboarding page
- auth input readability fix
- password visibility toggles

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

- escalation routing (needs a rules engine + team-member resolution)
- concierge assignment (blocked on the concierge role rollout in Phase 5+)

---

## Phase 4.4 — Document Infrastructure

Status:

```text
Foundation complete / upload-ready
```

Implemented:

- document vault page
- document metadata workflow
- document archive workflow
- document association to property/unit/tenant/lease
- upload-ready validation layer
- supported file types
- pending-upload state
- external document URL support

Supported upload types in validation layer:

```text
PDF, JPG, PNG, WEBP, DOC, DOCX
```

Current storage state:

```text
External URLs + upload-ready placeholders
```

Remaining:

- install and commit `@netlify/blobs`
- real binary upload to Netlify Blobs or Cloudinary/S3/R2
- secure download endpoint
- image/PDF preview
- document visibility rules
- tenant-visible documents
- compliance expiry alerts

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
Foundation implemented
```

Implemented:

- new landlord onboarding route
- first-login onboarding redirect when a workspace is created
- onboarding progress cards
- setup milestones
- property/unit/tenant/maintenance starter flow
- setup progress count

Current onboarding milestones:

```text
Add first property
Create units
Invite tenants
Activate maintenance tracking
```

Remaining:

- company profile setup wizard
- `/properties/new` dedicated first-property wizard
- `/units/new` dedicated guided unit flow
- `/tenants/new` invite-first-tenant flow
- onboarding completion persistence
- skip/dismiss onboarding preference
- onboarding checklist badges in dashboard

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
/admin/audit
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
```

### Tenant Routes

```text
/tenant/dashboard
/tenant/maintenance
```

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

Priority:

```text
High
```

Goal:

Allow landlords to browse global vendors and add them to their local vendor list.

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

---

## Phase 6 — Notification Infrastructure

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
- SMS/WhatsApp-ready abstraction
- escalation rules

---

## Phase 7 — Real Upload Infrastructure

Priority:

```text
High
```

Build:

- install and commit `@netlify/blobs`
- server-side upload helper
- secure blob keys
- document download endpoint
- preview support
- maintenance photo uploads
- tenant document uploads

---

## Phase 8 — Reporting & Accounting Expansion

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

Build:

- tenant lease view
- tenant payment history
- tenant balance
- tenant maintenance requests
- tenant document vault
- landlord messages

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
