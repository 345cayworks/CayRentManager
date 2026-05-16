# Phase 5.3 — Vendor Monetization Layer — Completion

Status: **Complete**

## What shipped

- `GlobalVendor` billing fields: `billingStatus` (`NONE|TRIAL|ACTIVE|PAST_DUE|CANCELLED`,
  default `NONE`), `billingNotes`, `paidThrough`; plus a `leads GlobalVendorLead[]`
  relation. `monthlyFee` was already present (pre-existing from Phase 5.1).
- New `GlobalVendorLead` model `{ id, globalVendorId, landlordId, type, note?,
  createdAt }` with indexes on `globalVendorId`, `(globalVendorId, type)`, and
  `landlordId`; back-relation `LandlordProfile.globalVendorLeads`.
- Netlify migration `20260516000400_phase5-3-vendor-monetization` (idempotent):
  `ADD COLUMN IF NOT EXISTS` for the billing columns, `CREATE TABLE IF NOT EXISTS`
  for `GlobalVendorLead` with guarded FK constraints and the three indexes.
- Pure, DB-free helpers in `src/lib/vendors/monetization.ts`
  (`BILLING_STATUSES`, `isBillingStatus`, `computeVendorRevenue`,
  `summarizeLeads`), fully unit tested in `tests/vendor-monetization.test.ts`.
- Lead tracking:
  - `ADD_TO_LIST` lead recorded automatically (best-effort) inside
    `addGlobalVendorToWorkspaceAction` after the successful audit — wrapped in
    try/catch so it can never break the copy-to-local flow.
  - `recordGlobalVendorInquiryAction` server action: explicit landlord
    "Request a quote" inquiry, validated against an `ACTIVE` + approved global
    vendor, optional note capped at 500 chars, audited as
    `global_vendor.inquiry`.
- `updateGlobalVendorBillingAction` superadmin server action: validates billing
  status via `isBillingStatus`, reuses `parseMonthlyFee`, optional date /
  notes (notes capped at 1000), audited as `global_vendor.billing_updated`.
- UI:
  - Landlord marketplace `/maintenance/vendors`: a minor "Request a quote"
    `<details>` disclosure per global-vendor card with an optional note
    textarea and "Send inquiry" submit.
  - Superadmin `/admin/vendors`: a "Monetization" summary band (MRR, Billable,
    Past due, Trialing, Sponsored, Featured); per-vendor lead totals
    ("Leads: N · Added X · Inquiries Y"); a billing-status badge per row
    (ACTIVE green, TRIAL blue, PAST_DUE amber, CANCELLED slate, NONE
    slate-light); and a per-vendor "Billing" editor form.

## MRR definition

Monthly recurring revenue is the sum of `monthlyFee` (null treated as 0) over
vendors that are **both** `RecordStatus = ACTIVE` **and** `billingStatus` in
`{ACTIVE, PAST_DUE}`. `PAST_DUE` still owes money so it is counted in MRR and
also flagged as at-risk. `TRIAL` is excluded from MRR but counted as trialing.
`NONE`, `CANCELLED`, and unknown billing statuses contribute 0 and are not
billable. ARCHIVED (any non-ACTIVE `RecordStatus`) vendors are excluded from MRR
and the billable count regardless of billing status. Sponsored/featured counts
are tallied across all vendors.

## Lead model

- `ADD_TO_LIST` — recorded automatically when a landlord copies a global vendor
  into their local list (best-effort; failure is swallowed and never blocks the
  add).
- `INQUIRY` — recorded explicitly when a landlord submits the "Request a quote"
  form against an active, approved global vendor.

## Acceptance mapped to roadmap

- monthly fee field — pre-existing (`GlobalVendor.monthlyFee`), surfaced in the
  billing editor.
- sponsored/featured reporting — counts in the Monetization band.
- vendor listing status — billing-status badge + editable `billingStatus`.
- inquiry tracking — `recordGlobalVendorInquiryAction` + `INQUIRY` leads.
- lead count tracking — `summarizeLeads`, shown per vendor for superadmins.
- manual billing notes — `billingNotes` editable on each vendor.

## Explicitly deferred

- Stripe / payment processor integration (roadmap: "later").
- Automated invoicing / dunning.
- Inquiry notifications through the Phase 6 notification outbox — not wired;
  intentionally out of scope for this phase.
