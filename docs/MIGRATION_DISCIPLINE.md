# CayRentManager Migration Discipline

## Purpose

This document defines the required migration and deployment process for CayRentManager.

The goal is to:

- Prevent schema drift
- Prevent Netlify production mismatches
- Ensure Prisma schema consistency
- Ensure production rollback safety
- Enforce manual deployment control

---

# Required Directories

## Prisma Migrations

```text
prisma/migrations/
```

All schema changes must generate Prisma migrations.

Never modify production tables manually without creating a tracked migration.

---

## Netlify Database Migration Tracking

```text
netlify/database/migrations/
```

This directory is reserved for:

- deployment notes
- production migration records
- rollback references
- emergency repair scripts
- provider-specific database notes

---

# Required Workflow

## Development Workflow

```text
1. Create feature branch
2. Modify schema.prisma
3. Run prisma migration locally
4. Run prisma generate
5. Run typecheck
6. Run tests
7. Run production build
8. Commit changes
9. Open PR
10. Human review
11. Human merges
12. Human triggers Netlify deploy manually
```

---

# Required Commands

Before every PR:

```bash
npx prisma generate
npx prisma migrate dev
npx tsc --noEmit
npm test
npm run build
```

---

# Production Deployment Rules

## Forbidden

- Auto-deploy directly from AI agents
- Direct production schema editing
- Untracked SQL changes
- Destructive hard deletes on financial records
- Production deploys without migration verification

## Required

- Manual Netlify deploy trigger
- Verified migration history
- Rollback notes in PR
- QA checklist completion
- Audit-safe lifecycle updates

---

# Rollback Requirements

Every migration PR should include:

- rollback risk
- rollback steps
- affected models
- affected routes
- affected server actions
- affected Netlify functions

---

# Verification Checklist

## Build Verification

```bash
npm install
npx prisma generate
npx tsc --noEmit
npm test
npm run build
```

## Manual QA

- Superadmin login works
- Landlord dashboard works
- Tenant dashboard works
- No cross-landlord leakage
- No tenant leakage
- Payments record correctly
- Expenses record correctly
- Audit logs write correctly
- Disabled users blocked
- Invite flow works
- Lease flow works

---

# Manual Netlify Deployment Policy

Netlify deployments remain manual until each roadmap phase is stabilized.

Required process:

```text
GitHub branch
→ Pull Request
→ Human Review
→ Merge
→ Manual Netlify Deploy
→ QA Validation
```

No AI agent should deploy directly to production.
