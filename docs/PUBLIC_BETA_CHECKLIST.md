# Public Beta Readiness Checklist

Consolidated go-live checklist for the CayRentManager public beta. Work top to
bottom; do not flip to public until every required item is checked.

## 1. Environment & configuration

- [ ] All required env vars set on Netlify per `.env.example`:
      `DATABASE_URL` (or managed `NETLIFY_DB_URL`), `APP_SESSION_SECRET`,
      `NEXT_PUBLIC_APP_URL`, `SUPER_ADMIN_EMAIL`, `SUPERADMIN_MASTER_KEY`.
- [ ] `APP_SESSION_SECRET` and `SUPERADMIN_MASTER_KEY` are long random values,
      stored only in the secrets manager (never in the repo).
- [ ] `NEXT_PUBLIC_APP_URL` points at the real production URL (used for
      absolute links/emails). No `NEXT_PUBLIC_BASE_URL` anywhere.
- [ ] Optional providers configured only if used (Resend / Twilio / Fygaro);
      otherwise left unset (log-only safe defaults).

## 2. Security & access

- [ ] `ENABLE_BOOTSTRAP_OWNER_ROUTE` is unset (or `false`) in production.
- [ ] `BOOTSTRAP_ALLOWED_IPS` not relied on in steady state.
- [ ] Superadmin account verified; bootstrap route confirmed disabled via
      `/admin/safety`.
- [ ] Manual security pass against `tests/security-phase1-checklist.md`
      (workspace isolation, auth scoping, document/photo access controls).
- [ ] Spot-check tenant and vendor portals only expose data shared with them.

## 3. Legal

- [ ] `/terms` and `/privacy` reviewed by counsel (currently marked
      "Draft — review by counsel before public launch"). Remove the draft
      banner once approved.
- [ ] Registration consent checkbox present and required on `/register`.
- [ ] Terms/Privacy linked from `/login`, `/register`, and marketing `/`.

## 4. Functional QA (manual smoke)

- [ ] Sign up → forced login → reach dashboard.
- [ ] Create property → unit → tenant → lease.
- [ ] Upload a document and a property/unit photo; reopen and confirm it
      renders; delete one (ConfirmButton prompts).
- [ ] Record a rent payment / view rent ledger.
- [ ] Maintenance request lifecycle: tenant submit → assign vendor → work
      order → resolve.
- [ ] Messaging: landlord ⇄ tenant and landlord ⇄ vendor, unread badges update.
- [ ] Billing: Fygaro path exercised in a test/sandbox configuration; webhook
      signature verified.
- [ ] Vendor marketplace renders at the top of `/maintenance/vendors`
      (sponsored/featured ordering intact).
- [ ] Superadmin dashboard loads; Rent Roll card absent; Health Check card
      works.

## 5. Per-phase regression review

- [ ] Skim each `docs/PHASE*_COMPLETION*.md` and confirm no listed capability
      regressed.
- [ ] `npm test` green; `npx tsc --noEmit` shows only the known pre-existing
      `tests/finance-metrics.test.ts` errors.

## 6. Mobile / UX

- [ ] Responsive Shell verified on a phone-width viewport (hamburger drawer
      opens, nav links + sign-out reachable, content full width).
- [ ] Desktop layout visually unchanged (240px sidebar).
- [ ] Route boundaries reachable: 404 page, error boundary "Try again",
      loading state.

## 7. Operations & monitoring

- [ ] `/api/health` returns OK (DB connectivity) and is monitored externally
      (uptime check / alert).
- [ ] DB automated snapshots/PITR confirmed enabled; a manual `pg_dump` taken
      and stored off-platform.
- [ ] Blob export procedure validated once (see `docs/BACKUP_RECOVERY.md`).
- [ ] Restore checklist (in `docs/BACKUP_RECOVERY.md`) reviewed by the operator.
- [ ] Incident/rollback owner identified.

## 8. Go / no-go

- [ ] All required boxes above checked.
- [ ] Known deferred/iterative items (comprehensive toast wiring, full
      page-by-page mobile polish, counsel-reviewed legal) are acceptable for a
      labeled public **beta** and tracked for follow-up.
