# Phase 1 Security QA Checklist

## Access Control

- [ ] SUPERADMIN can access admin routes
- [ ] LANDLORD cannot access SUPERADMIN routes
- [ ] TENANT cannot access landlord routes
- [ ] PROPERTY_MANAGER limited to assigned workspace
- [ ] ACCOUNTANT limited to assigned workspace
- [ ] Operational roles do not see landlord navigation

## Cross-Workspace Isolation

- [ ] Property access blocked across landlords
- [ ] Unit access blocked across landlords
- [ ] Lease access blocked across landlords
- [ ] Payment access blocked across landlords
- [ ] Expense access blocked across landlords
- [ ] Maintenance access blocked across landlords

## Superadmin Protection

- [ ] Final SUPERADMIN cannot be removed
- [ ] SUPERADMIN cannot self-demote
- [ ] SUPERADMIN cannot self-disable

## Bootstrap Route

- [ ] Route disabled by default
- [ ] Route blocked without environment enablement
- [ ] Route blocked for invalid IPs
- [ ] Route blocked for invalid master key

## Payments

- [ ] Negative payments blocked
- [ ] Invalid dates blocked
- [ ] Balance calculation correct
- [ ] Status calculation correct

## Deploy Governance

- [ ] Prisma generate passes
- [ ] TypeScript build passes
- [ ] Tests pass
- [ ] Manual QA completed
- [ ] Manual Netlify deploy only
