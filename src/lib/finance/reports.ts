/**
 * Pure aggregation helpers for the Phase 8 reporting suite.
 *
 * No IO. These functions take already-fetched / already-filtered data and
 * produce report rows + totals. Money values are kept raw (rounding only
 * happens at display); null money is treated as 0.
 */

export type DateRange = { start: Date; end: Date };

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

function isValidDate(d: Date): boolean {
  return !Number.isNaN(d.getTime());
}

/**
 * Parse ?from=YYYY-MM-DD&to=YYYY-MM-DD.
 * Defaults: start = first day of (now - 11 months), end = now (inclusive end-of-day).
 * Invalid/missing → defaults. start must be <= end (swap if reversed).
 */
export function parseReportRange(
  params: { from?: string; to?: string },
  now: Date = new Date(),
): DateRange {
  const defaultStart = new Date(now.getFullYear(), now.getMonth() - 11, 1, 0, 0, 0, 0);
  const defaultEnd = new Date(
    now.getFullYear(),
    now.getMonth(),
    now.getDate(),
    23,
    59,
    59,
    999,
  );

  let start = defaultStart;
  let end = defaultEnd;

  if (params.from) {
    const parsed = new Date(`${params.from}T00:00:00.000`);
    if (isValidDate(parsed)) {
      start = parsed;
    }
  }

  if (params.to) {
    const parsed = new Date(`${params.to}T23:59:59.999`);
    if (isValidDate(parsed)) {
      end = parsed;
    }
  }

  if (start.getTime() > end.getTime()) {
    const swap = start;
    start = end;
    end = swap;
  }

  return { start, end };
}

export function inRange(d: Date | null | undefined, r: DateRange): boolean {
  if (d == null) return false;
  const t = d.getTime();
  if (Number.isNaN(t)) return false;
  return t >= r.start.getTime() && t <= r.end.getTime();
}

/** Per-tenant outstanding rows. payments already filtered to non-void. */
export function tenantBalanceRows(
  tenants: Array<{ id: string; fullName: string; email: string }>,
  payments: Array<{
    tenantId: string;
    amountDue: number;
    amountPaid: number;
    balance: number;
    dueDate: Date;
  }>,
  now: Date = new Date(),
): Array<{
  tenantId: string;
  fullName: string;
  email: string;
  totalDue: number;
  totalPaid: number;
  balance: number;
  overdue: number;
}> {
  const byTenant = new Map<
    string,
    { totalDue: number; totalPaid: number; balance: number; overdue: number }
  >();

  for (const p of payments) {
    const acc =
      byTenant.get(p.tenantId) ?? {
        totalDue: 0,
        totalPaid: 0,
        balance: 0,
        overdue: 0,
      };
    const due = p.amountDue ?? 0;
    const paid = p.amountPaid ?? 0;
    const bal = p.balance ?? 0;
    acc.totalDue += due;
    acc.totalPaid += paid;
    acc.balance += bal;
    if (p.dueDate.getTime() < now.getTime() && bal > 0) {
      acc.overdue += bal;
    }
    byTenant.set(p.tenantId, acc);
  }

  return tenants.map((t) => {
    const acc =
      byTenant.get(t.id) ?? {
        totalDue: 0,
        totalPaid: 0,
        balance: 0,
        overdue: 0,
      };
    return {
      tenantId: t.id,
      fullName: t.fullName,
      email: t.email,
      totalDue: acc.totalDue,
      totalPaid: acc.totalPaid,
      balance: acc.balance,
      overdue: acc.overdue,
    };
  });
}

/** Group expenses; returns sorted desc by total + grandTotal. */
export function groupExpenses(
  expenses: Array<{
    category: string;
    propertyName: string;
    amount: number;
    expenseDate: Date;
  }>,
  by: 'category' | 'property',
): {
  rows: Array<{ key: string; total: number; count: number }>;
  grandTotal: number;
} {
  const groups = new Map<string, { total: number; count: number }>();
  let grandTotal = 0;

  for (const e of expenses) {
    const key = by === 'category' ? e.category : e.propertyName;
    const amount = e.amount ?? 0;
    const acc = groups.get(key) ?? { total: 0, count: 0 };
    acc.total += amount;
    acc.count += 1;
    groups.set(key, acc);
    grandTotal += amount;
  }

  const rows = Array.from(groups.entries())
    .map(([key, v]) => ({ key, total: v.total, count: v.count }))
    .sort((a, b) => b.total - a.total);

  return { rows, grandTotal };
}

/**
 * Per-property P&L over a range.
 * income = sum amountPaid of payments with paymentDate in range;
 * expense = sum expense.amount with expenseDate in range.
 */
export function computePropertyPL(
  properties: Array<{ id: string; name: string }>,
  payments: Array<{
    propertyId: string | null;
    amountPaid: number;
    paymentDate: Date | null;
  }>,
  expenses: Array<{ propertyId: string; amount: number; expenseDate: Date }>,
  range: DateRange,
): {
  rows: Array<{
    propertyId: string;
    name: string;
    income: number;
    expense: number;
    net: number;
  }>;
  totals: { income: number; expense: number; net: number };
} {
  const incomeByProp = new Map<string, number>();
  const expenseByProp = new Map<string, number>();

  for (const p of payments) {
    if (p.propertyId == null) continue;
    if (!inRange(p.paymentDate, range)) continue;
    incomeByProp.set(
      p.propertyId,
      (incomeByProp.get(p.propertyId) ?? 0) + (p.amountPaid ?? 0),
    );
  }

  for (const e of expenses) {
    if (!inRange(e.expenseDate, range)) continue;
    expenseByProp.set(
      e.propertyId,
      (expenseByProp.get(e.propertyId) ?? 0) + (e.amount ?? 0),
    );
  }

  const rows = properties.map((prop) => {
    const income = incomeByProp.get(prop.id) ?? 0;
    const expense = expenseByProp.get(prop.id) ?? 0;
    return {
      propertyId: prop.id,
      name: prop.name,
      income,
      expense,
      net: income - expense,
    };
  });

  const totals = rows.reduce(
    (acc, r) => ({
      income: acc.income + r.income,
      expense: acc.expense + r.expense,
      net: acc.net + r.net,
    }),
    { income: 0, expense: 0, net: 0 },
  );

  return { rows, totals };
}

/** Maintenance cost rollup. groupBy property or category. estimated vs actual. */
export function aggregateMaintenanceCosts(
  workOrders: Array<{
    propertyName: string;
    category: string;
    estimatedCost: number | null;
    actualCost: number | null;
    createdAt: Date;
  }>,
  by: 'property' | 'category',
  range: DateRange,
): {
  rows: Array<{ key: string; estimated: number; actual: number; count: number }>;
  totals: { estimated: number; actual: number; count: number };
} {
  const groups = new Map<
    string,
    { estimated: number; actual: number; count: number }
  >();

  for (const wo of workOrders) {
    if (!inRange(wo.createdAt, range)) continue;
    const key = by === 'property' ? wo.propertyName : wo.category;
    const acc = groups.get(key) ?? { estimated: 0, actual: 0, count: 0 };
    acc.estimated += wo.estimatedCost ?? 0;
    acc.actual += wo.actualCost ?? 0;
    acc.count += 1;
    groups.set(key, acc);
  }

  const rows = Array.from(groups.entries())
    .map(([key, v]) => ({
      key,
      estimated: v.estimated,
      actual: v.actual,
      count: v.count,
    }))
    .sort((a, b) => b.actual - a.actual);

  const totals = rows.reduce(
    (acc, r) => ({
      estimated: acc.estimated + r.estimated,
      actual: acc.actual + r.actual,
      count: acc.count + r.count,
    }),
    { estimated: 0, actual: 0, count: 0 },
  );

  return { rows, totals };
}

/** Leases expiring within `days` of `now` (inclusive), sorted soonest first. */
export function leaseExpiryRows(
  leases: Array<{
    id: string;
    tenantName: string;
    propertyName: string;
    unitName: string | null;
    endDate: Date;
    rentAmount: number;
    status: string;
  }>,
  days: number,
  now: Date = new Date(),
): Array<{
  id: string;
  tenantName: string;
  propertyName: string;
  unitName: string | null;
  endDate: Date;
  rentAmount: number;
  daysUntil: number;
}> {
  const nowMs = now.getTime();
  const thresholdMs = nowMs + days * ONE_DAY_MS;

  return leases
    .filter((l) => l.status === 'ACTIVE')
    .filter(
      (l) =>
        l.endDate.getTime() >= nowMs && l.endDate.getTime() <= thresholdMs,
    )
    .map((l) => ({
      id: l.id,
      tenantName: l.tenantName,
      propertyName: l.propertyName,
      unitName: l.unitName,
      endDate: l.endDate,
      rentAmount: l.rentAmount ?? 0,
      daysUntil: Math.ceil((l.endDate.getTime() - nowMs) / ONE_DAY_MS),
    }))
    .sort((a, b) => a.endDate.getTime() - b.endDate.getTime());
}
