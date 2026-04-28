# RentFlow Manager (Production Rewrite)

Production-grade rewrite of RentFlow Manager using **Next.js App Router + PostgreSQL + Prisma** with strict multi-landlord isolation.

## Milestone scope implemented

- Next.js app skeleton (App Router, TypeScript, Tailwind)
- Workspace-first data model (`landlord_profiles` + `landlord_memberships`)
- Prisma schema for all requested core entities
- Security guard helper layer (`requireAuth`, `requireRole`, `requireSuperadmin`, `requireLandlordAccess`, `requireTenantAccess`)
- Superadmin bootstrap service for `info@cayworks.com`
- Public landlord registration service (landlord-only creation)
- Tenant invitation acceptance flow with email-match enforcement
- Financial metric utility module for dashboard/report calculations
- Placeholder route structure for public, admin, landlord, and tenant areas
- Initial unit tests for financial logic and isolation helpers
- Netlify deployment configuration and environment documentation

## Stack

- Next.js 14 App Router
- TypeScript
- Tailwind CSS
- Prisma ORM
- PostgreSQL (Neon recommended)
- Auth.js integration ready

## Setup

1. Copy environment values:

```bash
cp .env.example .env
```

2. Install dependencies:

```bash
npm install
```

3. Run Prisma migrations:

```bash
npx prisma migrate deploy
```

4. Generate Prisma client:

```bash
npx prisma generate
```

5. Seed demo data:

```bash
npx prisma db seed
```

6. Run locally:

```bash
npm run dev
```

## Environment variables

- `DATABASE_URL`
- `NEXT_PUBLIC_APP_URL`
- `NEXTAUTH_SECRET` (or `AUTH_SECRET`)
- `GOOGLE_CLIENT_ID` (optional)
- `GOOGLE_CLIENT_SECRET` (optional)
- `NETLIFY_IDENTITY_ADMIN_TOKEN` (optional, if Netlify Identity path is used)

## Security model highlights

- App DB is source-of-truth for role and status.
- Public `/register` only creates landlord users/workspaces.
- Tenant onboarding requires invitation token + matching invited email.
- No hard-delete pattern for production records (archive/void/terminate/deactivate fields).
- Landlord data must be scoped by `landlord_id`.
- Tenant data must be scoped by current tenant profile.
- Superadmin protected routes under `/admin`.

## Production checklist

- [ ] Run `npx prisma migrate dev` to materialize SQL migration before release
- [ ] Configure Neon PostgreSQL + secure credentials
- [ ] Configure Auth.js providers and callbacks
- [ ] Add server-side session wiring to guards and middleware
- [ ] Add end-to-end RBAC tests for route/API access
- [ ] Add full CRUD UI forms + server actions for all entities
- [ ] Add immutable audit log writes for all lifecycle actions
- [ ] Add signed upload flow for documents
- [ ] Configure Netlify environment variables and deploy contexts
- [ ] Validate Landlord A/B and Tenant A/B isolation using seeded demo accounts

## MVP placeholders intentionally included

- Online payments coming soon
- Send for Digital Signature coming soon
- QuickBooks export coming soon

