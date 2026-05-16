# Phase 9 — Tenant Portal Expansion (Completion)

## What shipped

- **Tenant lease view** (`/tenant/lease`): highlighted active lease (property/unit, term,
  rent, deposit, status badge), renewals and notices lists for the active lease, lease
  documents (tenant-visible `Document` rows of type `LEASE` linked to the existing secure
  `/api/documents/[documentId]/download` endpoint; `LeaseDocumentVersion` rows shown as
  metadata only), and a lease history table. Read-only.
- **Tenant payments + balance** (`/tenant/payments`): balance summary cards (total billed,
  total paid, outstanding, overdue), full payment history table with receipt links to the
  existing secure `/api/receipts/[receiptId]` route. Read-only; payment-proof upload stays
  on the dashboard (linked, not duplicated).
- **Two-way landlord⇄tenant messaging**:
  - Tenant thread (`/tenant/messages`): chat-style thread, compose form, unread indicator,
    "Mark read" button.
  - Landlord inbox (`/messages`): conversations grouped by tenant with unread badges, plus
    a "start conversation" list for active tenants with a linked login and no messages yet.
  - Landlord thread (`/messages/[tenantId]`): workspace-scoped, chat-style, reply form,
    per-thread "Mark read", graceful handling of tenants with no linked login.
  - Server actions: `sendTenantMessageAction`, `sendLandlordMessageAction`,
    `markMessagesReadAction` (all in `src/server/actions.ts`, audited as `message.sent`).
- **Nav + unread badges** (`src/components/shell.tsx`): tenant links (Dashboard, Lease,
  Payments, Maintenance, Documents, Messages, Profile) and a landlord `Messages` link, both
  with unread-count badges following the existing resilient try/catch alert-badge pattern.
- **Pure helper + tests**: `src/lib/messaging/threads.ts` (`unreadCount`,
  `groupLandlordInbox`, `sortChronological`) with `tests/messaging-threads.test.ts`.
- **Schema + migration**: three `@@index` entries on `Message` plus idempotent migration
  `netlify/database/migrations/20260516000500_phase9-message-indexes/migration.sql`.

## Messaging model

- Strictly **workspace-scoped**: every query filters by `landlordId`; tenants only see
  their own thread (filtered on their `userId`), landlords only their workspace.
- The **landlord receiver** for tenant-originated messages is the workspace owner
  (`LandlordProfile.ownerUserId`).
- The **landlord-side user set** for inbox grouping/unread = owner user id ∪ active
  membership user ids; the "other party" of a message is whichever side is not in that set.
- Tenants without a linked `userId` cannot be messaged — handled explicitly, never crashes.

## Reused endpoints

- Receipts: existing `GET /api/receipts/[receiptId]`.
- Lease documents: existing `GET /api/documents/[documentId]/download`.

No new download routes were built.

## Out of scope / deferred

- Owner statements (not a Phase 9 item).
- Message attachments; editing/deleting messages.
- Email/SMS delivery of messages (Phase 6 outbox not wired here — possible future
  enhancement).
- Realtime/websockets (server-rendered + form posts only).

## Skipped badges

None — both the landlord `/messages` badge and the tenant `/tenant/messages` badge were
wired (each a single resilient `prisma.message.count` with try/catch fallback to base
links).
