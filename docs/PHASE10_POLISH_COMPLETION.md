# Phase 10 — Production Polish & Public Beta (Foundation Completion)

Status: **In Progress — foundation shipped.** This sprint delivered a coherent,
shippable polish increment plus three housekeeping items. It deliberately does
not claim 100% mobile coverage or 100% toast wiring — see "Deferred / iterative"
below.

## Shipped

### P1 — Responsive Shell

- `src/components/shell.tsx` stays a server component; interactivity isolated in
  the new `'use client'` `src/components/mobile-nav.tsx`.
- Desktop (`md+`): the existing `240px_1fr` grid + `bg-brand-navy` sidebar is
  visually unchanged.
- Mobile (`<md`): sidebar hidden; top bar with brand + Menu button toggles a
  CSS overlay drawer (local `useState`, no new deps). `<main>` is full width.
- Nav badge logic and `SignOutPanel` are rendered server-side once and passed
  into both the desktop sidebar and the mobile drawer — badges still work.

### P2 — Route boundaries

- `src/app/global-error.tsx` (`'use client'`) — html/body wrapper, friendly
  message, "Try again" → `reset()`, link to `/`, `console.error`s the error.
- `src/app/error.tsx` (`'use client'`) — in-app card, generic message (no stack
  trace in production text), `reset()` + "Back to dashboard".
- `src/app/not-found.tsx` — branded 404 with `/` and `/dashboard` links.
- `src/app/loading.tsx` — lightweight spinner shell.

### P3 — Polish primitives + targeted wiring

- `src/components/ui/empty-state.tsx` — consistent empty-state card.
- `src/components/ui/confirm-button.tsx` (`'use client'`) — progressive-
  enhancement confirm submit. Wired to the destructive actions only:
  - vendor archive (`/maintenance/vendors`)
  - document archive + broken-placeholder delete (`/documents`)
  - property/unit photo delete (`photo-manager.tsx`)
  - tenant deactivate (`/tenants`, `/tenants/[id]`)
  - lease terminate (`/leases`, `/leases/[id]`)
  - disable vendor portal (`/maintenance/vendors/[vendorId]`)
- `src/components/ui/toast.tsx` + `toaster.tsx` (`'use client'`) and pure
  `src/lib/ui/toast.ts` `buildToastFromSearchParams`; Toaster mounted once in
  `Shell`. Logic covered by `tests/ui-primitives.test.ts`.

### P4 — Legal + beta

- `src/app/terms/page.tsx`, `src/app/privacy/page.tsx` — public (no Shell),
  Cayman property-ops scaffolds, clearly marked
  "Draft — review by counsel before public launch".
- Linked from `/login`, `/register`, and the marketing `/` footer.
- Required "I agree to the Terms and Privacy Policy" checkbox added to the
  signup form (`identity-auth-form.tsx`); registration server action untouched.
- "Beta" badge in the Shell header/title area.

### P5 / P6 — Runbooks

- `docs/BACKUP_RECOVERY.md` — DB backup/restore, Blob durability/export, dual
  migration model, secret rotation, restore checklist.
- `docs/PUBLIC_BETA_CHECKLIST.md` — consolidated go-live checklist.

### Housekeeping

- **H1:** Vendor Marketplace section moved to the top of `/maintenance/vendors`
  (after stat cards, before "Add a vendor"). Pure JSX reorder; queries and
  `sortMarketplaceVendors` unchanged.
- **H2:** Removed the Rent Roll quick-action card from the superadmin dashboard
  (`src/app/admin/page.tsx`); rest of the array intact.
- **H3:** `.env.example` rewritten as a grouped, commented reference for every
  referenced var; base URL standardized on `NEXT_PUBLIC_APP_URL`
  (`src/app/api/admin/landlords/route.ts`), `NEXT_PUBLIC_BASE_URL` removed
  (no other usages found).

## Deferred / iterative (intentionally not done this sprint)

- **Comprehensive toast wiring:** The Toaster is mounted and the helper is
  tested, but most actions still use bespoke/page-local banners (e.g. the
  profile page's own `?updated=1` banner). Converting every redirecting action
  to `?notice=` / `?error=` is follow-up work and was left alone to avoid
  reworking server actions and risking regressions.
- **Full mobile pass:** Only the global Shell is made responsive. Individual
  dense tables/pages may still need per-page mobile tuning.
- **Counsel-reviewed legal:** `/terms` and `/privacy` are drafts; the draft
  banner must be removed only after legal review.
- **Schema-free:** No schema change, no migration, no new npm deps.
