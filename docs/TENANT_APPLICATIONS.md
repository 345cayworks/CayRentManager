# Digital Tenant Applications

Status: **Complete**

A greenfield workflow that lets landlords collect prospective-tenant
applications through a public, branded link and convert an approved applicant
into a tenant invitation in one click.

## Flow

1. **Landlord creates an application link** (`/applications`). The link can be
   scoped to a specific property and/or unit, given an optional label, and an
   optional expiry. Each link has a unique `token`.
2. **Applicant submits** at the public, no-auth page `/apply/[token]`. The form
   collects structured fields only — applicant name, email, phone, current
   address, employer, monthly income, desired move-in, occupants, references
   (free text), and notes. **No anonymous file uploads by design** — landlords
   collect documents post-approval through the existing document vault.
3. **Submission** creates a `TenantApplication` (status `SUBMITTED`, copying the
   link's landlord/property/unit). The landlord is notified best-effort via the
   Phase 6 Resend outbox; failure never blocks the submission. The applicant
   sees a `?submitted=1` thank-you state.
4. **Landlord reviews/decides** (`/applications` list + `/applications/[id]`
   detail). Allowed actions are gated by the pure rules helpers:
   - `SUBMITTED → UNDER_REVIEW | APPROVED | REJECTED`
   - `UNDER_REVIEW → APPROVED | REJECTED`
   - `APPROVED | REJECTED | WITHDRAWN` are terminal (no transitions)
   - The landlord may also `WITHDRAWN` an open application (terminal).
5. **On APPROVED**, `createTenantInvitation` is called best-effort. This reuses
   the existing invitation service, which also emails the applicant via the
   Phase 6 outbox. The created invitation id is stored on the application and
   surfaced (with a copyable link) on the detail page. Invite failure never
   breaks the decision.

## Statuses

`SUBMITTED`, `UNDER_REVIEW`, `APPROVED`, `REJECTED`, `WITHDRAWN`
(enum `TenantApplicationStatus`).

## Data model

- `TenantApplicationLink` — shareable link, workspace-scoped, optional
  property/unit/label/expiry, `active` toggle.
- `TenantApplication` — the submission + decision metadata
  (`decisionByUserId`, `decisionAt`, `decisionNote`, `createdInvitationId`).

Migration: `netlify/database/migrations/20260520000100_tenant-applications/migration.sql`
(idempotent: enum via DO-block, two `CREATE TABLE IF NOT EXISTS`, FKs +
indexes).

## Security

- Public submission requires **no auth** and accepts **structured fields only**
  (no file uploads).
- All landlord actions are strictly workspace-scoped (`getCurrentLandlordWorkspace`)
  and audited (`application_link_created`, `application_link_updated`,
  `application_decided`, `application_withdrawn`).
- Status transitions are enforced by the pure helpers in
  `src/lib/applications/application-rules.ts` (tested in
  `tests/application-rules.test.ts`).

## Environment

Applicant and landlord emails reuse the Phase 6 outbox. They actually deliver
only when `NOTIFICATION_PROVIDER=resend` + `RESEND_API_KEY` +
`NOTIFICATION_FROM_EMAIL` are set; otherwise the outbox is safely log-only and
the workflow still functions (the copyable invite/apply links are the
fallback). `NEXT_PUBLIC_APP_URL` is used to render absolute shareable links.
