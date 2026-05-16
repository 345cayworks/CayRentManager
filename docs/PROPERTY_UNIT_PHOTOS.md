# Property & Unit Photos

## What shipped

Photo upload for properties and units, building directly on the Phase 7
Netlify Blobs upload infrastructure (no new blob plumbing).

- `PropertyPhoto` / `UnitPhoto` Prisma models; rows cascade-delete with
  their parent Property/Unit.
- Image-only validation: JPG, PNG, or WEBP; 8MB max per file
  (`validateImageFile`, `MAX_IMAGE_BYTES`, `ALLOWED_IMAGE_TYPES`).
- Upload / delete / set-primary server actions for both kinds.
- Guided property/unit wizards accept optional photos on create. A photo
  failure during the wizard does NOT abort entity creation — the entity is
  saved and photos can be added later from the detail page.
- Photo manager UI on property and unit detail pages.
- Primary-photo thumbnails on the properties and units list pages, with a
  neutral placeholder box when no primary photo exists.

## Storage

Reuses the Phase 7 Netlify Blobs setup. One shared store,
`crm-property-photos`, holds both property and unit photos. The key
namespace separates them:

```text
{landlordId}/property/{propertyId}/{photoId}/{sanitizedFileName}
{landlordId}/unit/{unitId}/{photoId}/{sanitizedFileName}
```

Helpers live in `src/lib/storage/blobs.ts`: `propertyPhotoKey`,
`unitPhotoKey`, `putPhotoBlob`, `getPhotoBlob`, `deletePhotoBlob`
(mirroring the document helpers exactly).

## Secure image endpoints

```text
GET /api/properties/[propertyId]/photos/[photoId]
GET /api/units/[unitId]/photos/[photoId]
```

Both are `force-dynamic`, require an authenticated user, scope the lookup
to the parent entity, and enforce access via the pure, unit-tested
`canAccessPropertyPhoto` decision function.

Access rule (landlord/superadmin only this sprint):

- No user -> 401
- SUPERADMIN -> allowed
- LANDLORD / PROPERTY_MANAGER / ACCOUNTANT -> allowed only if the photo's
  `landlordId` is in their active memberships
- TENANT / VENDOR / others -> denied (403)

Images are always served `Content-Disposition: inline` with
`Cache-Control: private, max-age=300`.

## Primary-photo behavior

Each property/unit can have at most one primary photo. Setting a photo as
primary runs in a transaction that clears `isPrimary` on all sibling
photos, then sets it on the chosen one. The primary photo sorts first on
detail pages and is the thumbnail used on list pages.

## Where photos appear

- New-property and new-unit wizards: optional multi-file input.
- Property and unit detail pages: photo manager (grid, primary badge,
  make-primary / delete, upload form).
- Properties and units list pages: primary-photo thumbnail (placeholder
  box if none).

## Manual QA checklist

- [ ] Upload one or more photos from a property detail page; thumbnails render.
- [ ] Upload from a unit detail page; thumbnails render.
- [ ] Set a photo primary; badge moves and it leads the grid.
- [ ] Primary thumbnail appears on the properties and units list pages.
- [ ] Delete a photo; it disappears and the blob is removed.
- [ ] Create a property/unit via the wizard with photos attached; entity
      and photos both persist.
- [ ] Reject non-image (PDF) and oversize (>8MB) files with a clear error.
- [ ] A tenant/vendor hitting an image endpoint URL gets 403.
- [ ] Deleting a property/unit cascades and removes its photo rows.
