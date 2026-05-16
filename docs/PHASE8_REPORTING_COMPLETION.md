# Phase 8 — Reporting & Accounting Expansion (Completion)

## Status

Complete. Owner statements deferred to a later phase (roadmap says "later").

## What shipped

`/reports` was a one-line stub. It is now a reporting hub linking to the
existing rent roll plus seven new report pages, each with (where time-scoped)
a date-range filter and a CSV export.

### Reports hub — `/reports`

Server component. A card grid with one cheap aggregate query (active lease
count + summed outstanding balance) for headline numbers. Links to:

- Rent Roll → `/financials/rent-roll` (existing, reused — not rebuilt)
- Tenant Balances → `/reports/tenant-balances`
- Payment History → `/reports/payment-history`
- Expense Report → `/reports/expenses`
- Property P&L → `/reports/property-pl`
- Cashflow → `/reports/cashflow`
- Maintenance Costs → `/reports/maintenance-costs`
- Lease Expiry → `/reports/lease-expiry`

### New report pages

| Route | Time-scoped | Notes |
|---|---|---|
| `/reports/tenant-balances` | No (snapshot) | Per-tenant due/paid/balance/overdue |
| `/reports/payment-history` | Yes | Range on `paymentDate ?? dueDate`; optional property filter |
| `/reports/expenses` | Yes | Group by `category`/`property`; grouped + detail tables |
| `/reports/property-pl` | Yes | Income vs. expense vs. net + totals row |
| `/reports/cashflow` | 6/12/24-month select | Monthly series + portfolio net |
| `/reports/maintenance-costs` | Yes | Group by `property`/`category`; estimated vs. actual |
| `/reports/lease-expiry` | 30/60/90/180-day select | Active leases ending soon; severity tint at <=30 days |

## Pure helper module — `src/lib/finance/reports.ts`

New, unit-tested, IO-free aggregation module. Functions: `parseReportRange`,
`inRange`, `tenantBalanceRows`, `groupExpenses`, `computePropertyPL`,
`aggregateMaintenanceCosts`, `leaseExpiryRows`. Money kept raw; rounding only
at display. Null money treated as 0. Reuses `metrics.ts` /
`landlord-financials.ts` (cashflow page uses `getRecentCashflowSeries` +
`portfolioCashflow`); no finance logic duplicated. Covered by
`tests/finance-reports.test.ts`.

## CSV pattern

Each export route copies `src/app/api/payments/export/route.ts` exactly:
`export const dynamic='force-dynamic'; export const runtime='nodejs';`,
`getCurrentLandlordWorkspace()`, the SAME query + SAME pure helper as the
page, `from`/`to`/`by`/`days` honored, `createCsvContent` +
`createSafeCsvFilename`, try/catch → 500. Dates as `YYYY-MM-DD`, money as
plain `.toFixed(2)`.

New routes: `/api/reports/{tenant-balances,expenses,property-pl,cashflow,maintenance-costs,lease-expiry}/export`.

The **payment-history** report reuses the existing shared
`/api/payments/export` route (no second route created).

## P&L / cashflow definitions

- **Income** = sum of `amountPaid` for non-VOID payments whose `paymentDate`
  falls within the range (cash basis — recognized when collected).
- **Expense** = sum of `amount` for ACTIVE expenses whose `expenseDate`
  falls within the range.
- **Net** = income − expense.
- **Cashflow** monthly series via `getRecentCashflowSeries` (collected by
  `paymentDate`, expenses by `expenseDate`, VOID/non-ACTIVE excluded);
  portfolio net via `portfolioCashflow`.

## Deferred

- Owner statements (roadmap: "later").

## Out of scope (unchanged)

No new charting library, no new npm deps, no changes to
payment/expense/maintenance write paths. `/financials` KPI dashboard and
`/financials/rent-roll` kept as-is.
