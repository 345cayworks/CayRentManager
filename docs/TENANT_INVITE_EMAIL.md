# Tenant Invite Email

## What it does

When a landlord invites a tenant (from `/tenants` or the guided onboarding
wizard), CayRentManager now automatically emails the invitee a branded
invitation containing the accept link. The landlord can also resend the email
from `/tenants`.

This is a small, **best-effort** feature wired at the service level so both
invite paths (`inviteTenantAction` and `createTenantGuidedAction`) are covered
with no per-path changes.

## How it works

- `src/lib/notifications/invite-email.ts` — `buildTenantInviteEmail(...)`: a
  pure, deterministic builder that produces `{ subject, body, bodyHtml }`. The
  HTML mirrors the digest dark-header card style and HTML-escapes every
  interpolated value (injection guard). No external images/CSS/CDNs.
- `src/lib/services/invitations.ts` — `sendTenantInviteEmail(invitationId)`:
  loads the invitation (landlord, unit/property), builds the email, queues it
  via the **Phase 6 outbox** (`queueEmailNotification`) and drains promptly
  with `processOutboundNotifications({ limit: 5 })` so it sends without waiting
  for the daily digest cron.
  - The invite URL is derived from `NEXT_PUBLIC_APP_URL` (trailing slashes
    stripped); if unset it falls back to a relative `/invite/<token>` path and
    the message is still queued (the log driver simply logs it).
  - Timezone for the expiry date comes from the landlord workspace timezone,
    defaulting to `America/Cayman`.
  - `createTenantInvitation` calls it after the row is created.

## Best-effort guarantee

`sendTenantInviteEmail` wraps its entire body in a try/catch that swallows and
`console.warn`s (`[tenant-invite-email] failed for <id>: <err>`). It **never
throws**, so a failed or unconfigured email can never break invite creation.
`createTenantInvitation` always returns the created invitation unchanged. The
copyable invite link on `/tenants` remains the fallback path. The acceptance
flow and the invite token are untouched.

## Resend

`resendTenantInviteAction` (in `src/server/actions.ts`) is a workspace-scoped
server action: it loads the invitation scoped to the current landlord and
`status: PENDING`, calls `sendTenantInviteEmail`, audits
`tenant.invite_email_resent`, and revalidates `/tenants`. The UI shows a
"Resend email" button next to the copyable link for each PENDING invitation.

## Required env to actually deliver

Without these the outbox safely runs the log-only driver (queued + logged, not
sent — invite creation still succeeds):

- `NOTIFICATION_PROVIDER=resend`
- `RESEND_API_KEY=<resend api key>`
- `NOTIFICATION_FROM_EMAIL=<verified sender>`
- `NOTIFICATION_FROM_NAME` (optional, defaults to `CayRentManager`)
- `NEXT_PUBLIC_APP_URL` (so the invite link is absolute)

No new dependencies, no email infra, and no schema change were introduced —
this reuses the existing Phase 6 Resend outbox.
