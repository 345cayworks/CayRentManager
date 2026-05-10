# CayRentManager Development Plan

## 1. Project Vision

CayRentManager is a multi-landlord property and rent management platform designed to help landlords manage rental inventory, tenants, leases, payments, expenses, maintenance, documents, and portfolio performance from one dashboard.

The platform should support:

- Multiple landlords on one system
- Strict data isolation between landlords
- Tenant onboarding through invitations
- Lease and rental contract management
- Payment tracking and tenant balances
- Expense tracking by property/unit
- Cashflow reporting by unit, property, and portfolio
- Basic accounting views
- Maintenance tracking
- Document storage and lease records
- Superadmin platform management

The goal is to move from a rescued MVP foundation to a production-ready SaaS platform.

---

## 2. Current Architecture

### Stack

- Next.js App Router
- TypeScript
- Prisma ORM
- Netlify Database / PostgreSQL
- Netlify Identity
- Custom app session bridge
- Tailwind CSS
- Netlify deployment

### Authentication Model

Netlify Identity handles authentication:

- Login
- Signup
- Logout
- Password recovery
- Email confirmation/invites

Prisma controls app access:

- User role
- User status
- Landlord memberships
- Tenant linkage
- Disabled access
- Audit history

### App Session Model

After Netlify Identity login, the app syncs the identity user into the Prisma `User` table and creates a signed app session cookie.

Session cookie:

```text
crm_app_session
```

The cookie is:

- HttpOnly
- Signed
- Stored as a hash in the database
- Expiring after 14 days

Required environment variable:

```text
APP_SESSION_SECRET
```

---

## 3. Environment Variables

Required:

```text
DATABASE_URL
APP_SESSION_SECRET
NEXT_PUBLIC_APP_URL
SUPER_ADMIN_EMAIL
SUPERADMIN_MASTER_KEY
```

Only this should be public:

```text
NEXT_PUBLIC_APP_URL
```

Never expose these with `NEXT_PUBLIC_`:

```text
DATABASE_URL
APP_SESSION_SECRET
SUPERADMIN_MASTER_KEY
```

### Superadmin Bootstrap

The app supports an emergency owner bootstrap process using:

```text
SUPER_ADMIN_EMAIL
SUPERADMIN_MASTER_KEY
```

This is for emergency repair only. It should not be used as the normal login system.

Normal login remains through Netlify Identity.

---

## 4. Primary Roles

### SUPERADMIN

Platform owner/admin.

Can:

- View all platform users
- View all landlord workspaces
- Disable/reactivate users
- Assign roles
- Archive/reactivate landlord workspaces
- View audit logs
- Manage platform-level settings

### LANDLORD

Owns and manages one or more landlord workspaces.

Can:

- Create properties
- Create units
- Invite tenants
- Create leases
- Record payments
- Record expenses
- View dashboard metrics
- Track portfolio performance

### PROPERTY_MANAGER

Can manage assigned landlord workspaces.

Can eventually:

- Manage properties
- Manage units
- Manage tenants
- Manage maintenance
- View operational dashboards

### ACCOUNTANT

Can view and manage financial records for assigned landlord workspaces.

Can eventually:

- View payments
- View expenses
- Export reports
- Review cashflow
- Produce owner statements

### TENANT

Can only access their own tenant portal.

Can:

- View lease
- View payment history
- View balance
- Submit maintenance requests
- View tenant documents

---

## 5. Access Control Rules

### Core Rules

- Landlord A must never see Landlord B data.
- Tenant A must never see Tenant B data.
- Tenant cannot choose landlord.
- Public users cannot self-register as Superadmin.
- Public users cannot self-register as Tenant.
- Public landlord registration creates Landlord only.
- Tenant onboarding requires invite token.
- Disabled users cannot access dashboards.
- Superadmin must not be disabled if they are the only active Superadmin.

### Server-Side Helpers

The app should continue to use helpers like:

```text
requireAuth()
requireRole()
requireSuperadmin()
requireLandlordAccess()
requireTenantAccess()
getCurrentLandlordWorkspace()
```

Server actions must never trust:

```text
client-submitted userId
client-submitted landlordId
client-submitted tenantId
client-submitted role
```

---

## 6. Current MVP Routes

### Public Routes

```text
/
/login
/register
/invite/[token]
/unauthorized
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
/properties
/units
/tenants
/leases
/payments
/expenses
```

### Tenant Routes

```text
/tenant/dashboard
```

---

## 7. Data Model Overview

The core Prisma models include:

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
Payment
Expense
MaintenanceRequest
Document
Message
AuditLog
```

### Legacy Models

The following models may remain from earlier Auth.js work:

```text
Account
Session
VerificationToken
```

Do not remove them without a controlled migration.

---

## 8. Production Readiness Status

Current classification:

```text
B+ MVP foundation
```

The foundation is real and usable, but production hardening is required before onboarding real landlords or tenants.

### Strong Areas

- Real database schema exists.
- Netlify Identity is integrated.
- Prisma role model exists.
- App session bridge exists.
- Landlord workspace model exists.
- Core landlord workflow pages exist.
- Dashboard metrics exist.
- Lifecycle actions exist.
- No-hard-delete policy exists.

### Weak Areas

- Temporary bootstrap endpoint must be protected or removed.
- Some scoped Prisma updates need hardening.
- Tenant invite acceptance needs transaction handling.
- Public landlord registration needs duplicate prevention.
- Navigation needs role awareness.
- Admin role changes need stronger safety rules.
- Forms need validation.
- Tenant dashboard needs stronger tenant-only access.
- Reports/accounting need deeper buildout.

---

# 9. Development Phases

## Phase 1 — Production Hardening

Goal:

Make the current MVP safer and more reliable before expanding features.

### Phase 1 Tasks

1. Protect or remove temporary bootstrap route.
2. Add `/api/health`.
3. Add `/api/identity/me`.
4. Fix scoped Prisma lifecycle updates.
5. Harden tenant invite acceptance.
6. Harden public landlord registration.
7. Make navigation role-aware.
8. Tighten admin role assignment.
9. Add tests for critical access flows.
10. Confirm Superadmin access works.

### Acceptance Criteria

- Build passes.
- Tests pass.
- Superadmin can access `/admin`.
- Temporary bootstrap route is not publicly usable.
- Health endpoint works.
- Identity status endpoint works.
- Landlord isolation remains enforced.
- Tenant invite flow cannot create duplicate tenants.
- Public registration cannot duplicate landlord workspaces.
- No `/dashboard?error=forbidden` redirect loop exists.

---

## Phase 2 — Admin Management

Goal:

Make the Superadmin dashboard useful for platform operations.

### Features

- User search
- User filters by role/status
- User detail page
- Role assignment with safety rules
- Disable/reactivate users
- Landlord workspace list
- Landlord detail page
- Archive/reactivate landlord workspaces
- Audit log viewer
- Platform settings page

### Admin Safety Rules

- Cannot disable the only active Superadmin.
- Cannot remove Superadmin role from the only active Superadmin.
- Cannot assign Tenant role without tenant record.
- Cannot assign Property Manager or Accountant without workspace assignment.
- All actions must write audit logs.

---

## Phase 3 — Landlord Workflow Completion

Goal:

Make the core landlord workflow usable by real beta testers.

### Features

- Property detail page
- Edit property
- Archive/reactivate property
- Unit detail page
- Edit unit
- Archive/reactivate unit
- Tenant detail page
- Invite tenant
- Resend tenant invite
- Revoke tenant invite
- Lease creation
- Lease detail page
- Lease termination
- Payment recording
- Payment history
- Expense recording
- Expense history

### Workflow

```text
Landlord registers
→ creates property
→ creates unit
→ invites tenant
→ tenant accepts invite
→ landlord creates lease
→ landlord records rent payment
→ landlord records expense
→ dashboard updates
```

---

## Phase 4 — Tenant Portal

Goal:

Give tenants a simple, secure portal.

### Features

- Tenant dashboard
- Lease summary
- Payment history
- Outstanding balance
- Maintenance request submission
- Document list
- Message landlord/property manager

### Security Rules

- Tenant can only see their own data.
- Tenant cannot access landlord dashboard.
- Tenant cannot view other tenants.
- Tenant cannot change lease/payment records.

---

## Phase 5 — Maintenance Management

Goal:

Allow landlords and tenants to manage repair requests.

### Features

- Create maintenance request
- Upload photo
- Assign priority
- Change status
- Track estimated cost
- Track final cost
- Close request
- Archive request

### Statuses

```text
OPEN
IN_PROGRESS
RESOLVED
CLOSED
ARCHIVED
```

---

## Phase 6 — Document Management

Goal:

Store and organize lease/property/tenant documents.

### Features

- Upload document
- Attach to property
- Attach to unit
- Attach to tenant
- Attach to lease
- Archive document
- Tenant-visible documents
- Landlord-only documents

### Document Types

```text
Lease
Signed Lease
ID
Inspection
Receipt
Insurance
Property Document
Other
```

---

## Phase 7 — Reports and Basic Accounting

Goal:

Move from simple tracking to useful financial reporting.

### MVP Reports

- Rent Roll
- Tenant Balance Report
- Payment History
- Expense Report
- Property P&L
- Unit Cashflow
- Portfolio Cashflow
- Lease Expiry Report
- Maintenance Cost Report
- Tax Summary

### Future Accounting Model

The current payment model is enough for MVP. Later, add a real rent ledger:

```text
Recurring charges
Payment allocations
Late fees
Credits
Refunds
Adjustments
Receipts
Balance forward
```

---

## Phase 8 — Production Polish

Goal:

Prepare for public beta or paid pilot users.

### Tasks

- Better landing page
- Mobile-responsive polish
- Empty states
- Loading states
- Error boundaries
- Toast messages
- Form validation
- Confirmation modals
- Help text
- Onboarding checklist
- Privacy policy
- Terms of service
- Data deletion/retention policy
- Backup/recovery process

---

# 10. Immediate Backlog

## Critical

- Confirm `/admin` works for Superadmin.
- Protect or remove bootstrap route.
- Fix scoped update mutations.
- Add health/status endpoints.
- Harden tenant invite acceptance.
- Harden public registration.
- Make navigation role-aware.

## High Priority

- Improve `/admin/users`.
- Add `/admin/audit`.
- Add landlord detail page.
- Add tenant detail page.
- Add lease detail page.
- Add payment detail/history.
- Add expense categories.

## Medium Priority

- Add maintenance workflow.
- Add document workflow.
- Add reporting pages.
- Add CSV exports.
- Improve dashboard charts.

## Later

- Online rent payments.
- Digital signatures.
- Owner statements.
- Multi-currency.
- QuickBooks export.
- Stripe integration.
- Email notifications.
- SMS/WhatsApp reminders.

---

# 11. Development Workflow

## Branching

Use feature branches:

```bash
git checkout -b production-hardening-phase-1
```

Do not commit directly to main unless emergency rescue is required.

## Standard Commands

```bash
npm install
npx prisma generate
npm run build
npm test
```

## Deployment Control

Codex and agents should not deploy to Netlify automatically.

Process:

```text
1. Create branch
2. Commit changes
3. Open PR
4. Human reviews PR
5. Human merges
6. Human triggers Netlify deploy manually
```

## PR Requirements

Each PR should include:

- Summary of changes
- Files changed
- Tests run
- Risks
- Manual QA steps
- Rollback notes

---

# 12. Manual QA Checklist

Before every production deploy:

```text
npm install passes
npx prisma generate passes
npm run build passes
npm test passes
/login loads
info@cayworks.com can log in
/admin loads for Superadmin
/dashboard loads for Landlord
/tenant/dashboard loads for Tenant
Unauthorized users go to /unauthorized
Disabled users are blocked
Property creation works
Unit creation works
Tenant invite works
Lease creation works
Payment recording works
Expense recording works
Dashboard updates
No cross-landlord data leakage
No tenant data leakage
No hard deletes
```

---

# 13. Security Checklist

- Secrets are never committed.
- Only `NEXT_PUBLIC_APP_URL` is public.
- `APP_SESSION_SECRET` is set.
- `SUPERADMIN_MASTER_KEY` is set only server-side.
- Bootstrap endpoint is protected or removed.
- No role is accepted from client input.
- No landlordId is trusted from client input.
- No tenantId is trusted without server-side ownership check.
- Disabled users are blocked.
- Audit logs are written for sensitive actions.
- Superadmin lockout protection exists.
- No hard-delete for core production records.

---

# 14. Next Recommended Codex Prompt

Use this for the next agent pass:

```text
Start production-hardening-phase-1 for CayRentManager.

Do not deploy to Netlify.
Do not merge to main.
Create a branch, commit changes, open a PR, and stop.

Focus only on:
1. Protect/remove bootstrap route.
2. Add /api/health.
3. Add /api/identity/me.
4. Fix scoped Prisma lifecycle updates.
5. Harden tenant invite acceptance.
6. Harden public landlord registration.
7. Make navigation role-aware.
8. Tighten admin role assignment.
9. Add tests.
10. Update README/development docs.

Run:
npm install
npx prisma generate
npm run build
npm test

Report files changed, tests run, and remaining risks.
```

---

# 15. Definition of Production Ready

CayRentManager is production ready when:

- Superadmin can manage platform safely.
- Landlords can complete core workflow without support.
- Tenants can accept invites and access only their portal.
- Payments and expenses are tracked reliably.
- Dashboard metrics are accurate enough for operational use.
- Data isolation has been tested.
- Critical actions are audited.
- No temporary debug routes remain exposed.
- No hard-delete paths exist for financial/history records.
- Build and tests pass consistently.
- Netlify deploys cleanly.
- Manual QA checklist passes.
