# Landlord⇄Vendor Messaging + "Request a Quote" Delivery

## What shipped

### Generalized messaging inbox

The landlord messaging inbox (`/messages`) previously only listed tenants. It now
lists **both tenants and portal-linked vendors** as conversation participants. The
underlying grouping helper (`groupLandlordInbox` in
`src/lib/messaging/threads.ts`) was always participant-agnostic — it groups by
"the non-landlord party userId" — so only the return field was renamed
`tenantUserId` → `participantUserId`. No grouping logic changed.

### Participant resolution model

`resolveParticipant(participantUserId, tenantsByUserId, vendorsByUserId)` maps a
non-landlord userId to a typed `ParticipantRef`:

- If the userId is a known active tenant → `{ kind: 'TENANT', id, name, userId }`
- Else if it is a known active portal-linked vendor → `{ kind: 'VENDOR', id, name, userId }`
- Else → `null` (the conversation is dropped from the inbox)

**Tenant takes precedence** if a userId pathologically appears in both maps.
Tenant conversations link to `/messages/[tenantId]`; vendor conversations link to
`/messages/vendor/[vendorId]`.

### Threads

- **Landlord → vendor**: new `/messages/vendor/[vendorId]` page, mirroring the
  tenant thread. Workspace-scoped (`maintenanceVendor.findFirst({ id, landlordId })`).
  Vendors with no linked `userId` get a graceful "no linked portal login yet" card
  rather than a crash. Reply via `sendVendorMessageAction`, mark-read via
  `markMessagesReadAction` (`withSenderId = vendor.userId`).
- **Vendor → landlord**: new `/vendor/messages` page in the vendor portal. The
  vendor sees only their own thread with their landlord (filtered by
  `vendor.landlordId` + their own userId). Reply via
  `sendVendorPortalMessageAction` (receiver = landlord owner). Mark-read marks all
  messages this vendor user has received.

### Server actions

- `markMessagesReadAction` now also permits `VENDOR` / `MAINTENANCE_PROVIDER`
  and revalidates `/vendor/messages` + `/messages`.
- `sendVendorMessageAction` (landlord → workspace vendor) and
  `sendVendorPortalMessageAction` (vendor → their landlord) added. Both are
  strictly workspace-scoped and audited as `message.sent`.

### Vendor navigation

A `Messages` link was added to the vendor portal nav (after Completed Work,
before Profile), with a resilient unread badge mirroring the tenant badge
pattern (defensive try/catch; on any error the base links render).

### "Request a quote" delivery (Phase 5.3 follow-through)

The marketplace "Request a quote" form (on every global vendor card, including
sponsored/featured — it is a shared card template) previously only recorded a
`GlobalVendorLead`. `recordGlobalVendorInquiryAction` now, **after** the lead is
created (lead creation + audit + revalidate are unchanged and never break),
performs **best-effort delivery** in a try/catch:

1. If a non-archived workspace `MaintenanceVendor` with a linked `userId` and the
   same `globalVendorId` exists → deliver as an **in-app message** from the
   landlord owner to that vendor's portal login.
2. Else if the `GlobalVendor` has an email → **queue an email** via the Phase 6
   outbox (`queueNotification`, `notificationKind: 'VENDOR_INQUIRY'`).
3. The `GlobalVendorLead` is the source of truth and is always recorded
   regardless of delivery outcome. Any delivery failure is swallowed.

A one-line helper renders under the form: "We'll forward your request to the
vendor (in-app if they use CayRentManager, otherwise by email)."

## Schema

No schema change / no migration. `Message` is user↔user and `notificationKind`
is a free-text column, so the existing model covers vendor messaging.

## Deferred / expected limitations

- Vendor messaging is **workspace-scoped**: a vendor only ever sees their thread
  with the landlord whose workspace owns their `MaintenanceVendor` record.
- A global vendor with **no email** and **no portal-linked local copy** in the
  requesting landlord's workspace gets **lead-only** (no in-app message, no
  email). This is expected and intentional — the lead remains the system of
  record.
- No realtime/push; threads refresh on navigation/revalidation (consistent with
  the Phase 9 tenant messaging behavior).
