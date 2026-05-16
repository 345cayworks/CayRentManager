# Phase 7 — Real Upload Infrastructure (Completion)

## What shipped

The previous "upload" path accepted a file, validated it, then **discarded the
bytes** and persisted `fileUrl: pending-blob-upload://...`. Landlords believed
their leases/insurance documents were stored; nothing was. This phase replaces
that with real storage.

- `@netlify/blobs` installed and committed.
- Blob storage helpers (`src/lib/storage/blobs.ts`): two stores —
  `crm-documents` and `crm-maintenance-attachments`, strong consistency.
- Real document upload (`uploadDocumentAction`): creates the `Document` row
  first, stores the blob, then patches `storageKey/fileSize/contentType`. If the
  blob write throws, the row is deleted and a friendly error is raised — no
  silent data loss, no orphan record.
- Real maintenance attachment upload (`uploadMaintenanceAttachmentAction`) with
  the same create-store-patch / rollback pattern.
- Secure, auth-scoped download endpoints (see authorization matrix below).
- Document visibility rules (`LANDLORD_ONLY` / `TENANT_VISIBLE`).
- Real tenant document portal at `/tenant/documents` + tenant nav entry.
- Honest documents UI: Preview/Download, image thumbnails, broken-record banner
  and remediation button.

## Broken-placeholder remediation path

Migration `20260515000400_phase7-uploads`:

- Adds `DocumentVisibility` and `DocumentSource` enums (idempotent).
- Adds storage columns to `Document` and `MaintenanceAttachment`; relaxes
  `MaintenanceAttachment.fileUrl` to nullable.
- Backfills every legacy `pending-blob-upload://%` document to
  `source = 'BROKEN_PLACEHOLDER'`.
- Backfills `MaintenanceAttachment.landlordId` from the parent request.

Broken placeholders are surfaced with a red banner on `/documents`. They have no
bytes, so a hard-delete remediation action (`deleteBrokenPlaceholderAction`,
scoped to `source = BROKEN_PLACEHOLDER` + workspace) lets landlords clear them
and re-upload. Hard-delete is allowed **only** for these rows; everything else
remains soft-archive.

## Storage architecture

- Library: Netlify Blobs (`@netlify/plugin-nextjs` provides the blob context
  automatically on deployed Next.js — no extra config). Off-platform (local
  build/test) the import is safe; only an actual upload/download attempt fails.
- Stores: `crm-documents`, `crm-maintenance-attachments`.
- Key scheme:
  - Documents: `<landlordId>/<documentId>/<sanitizedFileName>`
  - Maintenance: `<landlordId>/<requestId>/<attachmentId>/<sanitizedFileName>`
- `sanitizeFileName` strips anything outside `[A-Za-z0-9._-]`, caps to the
  trailing 120 chars, defaults to `file`.

## Secure endpoints + authorization matrix

`GET /api/documents/[documentId]/download` — uses pure `canAccessDocument`:

| Role | Rule |
| --- | --- |
| (unauthenticated) | 401 |
| SUPERADMIN | always allowed |
| LANDLORD / PROPERTY_MANAGER / ACCOUNTANT | allowed if member of `doc.landlordId` |
| TENANT | allowed only if `visibility = TENANT_VISIBLE` AND owns the linked tenant |
| VENDOR / others | denied |

Source handling: `BROKEN_PLACEHOLDER` → 410; `EXTERNAL` → 409 with `fileUrl`
(client opens it directly — the server never proxies arbitrary external URLs;
SSRF guard); `STORED` → streamed bytes with `inline` (pdf/image, no
`?download=1`) or `attachment` disposition, `Cache-Control: private, no-store`.
A best-effort `document.downloaded` audit log is written (failures never block
the response).

`GET /api/maintenance/attachments/[attachmentId]/download`:

| Role | Rule |
| --- | --- |
| SUPERADMIN | allowed |
| LANDLORD-type | allowed if member of the attachment's landlord |
| TENANT | allowed if owns the parent request |
| VENDOR / MAINTENANCE_PROVIDER | allowed if assigned vendor or has a work order on the request |
| others | denied |

## What's deferred

- Compliance expiry alerts — belongs to the alert engine (Phase 4.4 deferred
  note / alert automation roadmap), not document storage.
- Company logo upload — fast-follow that can reuse this exact blob plumbing.

## Manual QA checklist

- [ ] Upload a PDF on `/documents`; Preview renders inline; Download forces
      attachment.
- [ ] Upload an image; thumbnail shows; preview inline.
- [ ] Mark a document tenant-visible with a tenant linked; tenant sees it on
      `/tenant/documents`; a different tenant gets 403.
- [ ] LANDLORD_ONLY document: tenant gets 403.
- [ ] Legacy placeholder rows show the broken banner; "Remove record" clears
      them; re-upload works.
- [ ] External document still opens via its source URL (no server proxy).
- [ ] Maintenance attachment upload (landlord detail + tenant maintenance);
      stored attachment downloads via the secure endpoint; external URL
      attachment still opens directly.
- [ ] Vendor can download attachments for their assigned request, not others.
- [ ] Storage failure path: row is rolled back, friendly error shown.
