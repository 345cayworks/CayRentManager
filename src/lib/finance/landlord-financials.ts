import { Payment, Expense, Lease, Property, Unit, RecordStatus } from '@prisma/client';

export interface FinancialSummary {
  totalRentDue: number;
  totalRentCollected: number;
  totalExpenses: number;
  outstandingBalance: number;
  overdueAmount: number;
  netCashflow: number;
}

export interface MonthlyMetrics {
  month: string;
  rentCollected: number;
  expenses: number;
  netCashflow: number;
}

export type CashflowPoint = {
  label: string;
  rentCollected: number;
  expenses: number;
  net: number;
};

export type ComparisonDelta = {
  current: number;
  previous: number;
  deltaPct: number;
  direction: 'up' | 'down' | 'flat';
};

export type RentCollectionStatusCounts = {
  paid: number;
  pending: number;
  overdue: number;
  partial: number;
  total: number;
};

/**
 * Get the current month date range (inclusive start, exclusive end)
 */
export function getCurrentMonthRange(): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 1); // Exclusive end
  return { start, end };
}

/**
 * Get the date range for a month offset back from the current month.
 * monthsBack=0 returns the current month, monthsBack=1 returns the previous month, etc.
 */
export function getMonthRange(monthsBack: number): { start: Date; end: Date } {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 1);
  return { start, end };
}

/**
 * Compute a month-over-month delta. Returns the percent change and a direction
 * flag for UI rendering. When the previous value is zero the percent is set to
 * 0 (any non-zero current value will still be reported as `up`).
 */
export function monthOverMonthDelta(current: number, previous: number): ComparisonDelta {
  let deltaPct = 0;
  if (previous !== 0) {
    deltaPct = Math.round(((current - previous) / Math.abs(previous)) * 1000) / 10;
  }

  let direction: 'up' | 'down' | 'flat' = 'flat';
  if (current > previous) direction = 'up';
  else if (current < previous) direction = 'down';

  return { current, previous, deltaPct, direction };
}

/**
 * Calculate financial summary for a given period
 */
export function calculateFinancialSummary(
  payments: Payment[],
  expenses: Expense[],
  startDate?: Date,
  endDate?: Date
): FinancialSummary {
  // For rent due: use dueDate in period
  const rentDuePayments = startDate && endDate
    ? payments.filter(p => p.dueDate >= startDate && p.dueDate < endDate)
    : payments;

  // For rent collected: use paymentDate in period (if exists)
  const rentCollectedPayments = startDate && endDate
    ? payments.filter(p => p.paymentDate && p.paymentDate >= startDate && p.paymentDate < endDate)
    : payments;

  const filteredExpenses = startDate && endDate
    ? expenses.filter(e => e.expenseDate >= startDate && e.expenseDate < endDate)
    : expenses;

  const totalRentDue = rentDuePayments.reduce((sum, p) => sum + Number(p.amountDue), 0);
  const totalRentCollected = rentCollectedPayments.reduce((sum, p) => sum + Number(p.amountPaid ?? 0), 0);
  const totalExpenses = filteredExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
  const outstandingBalance = payments.reduce((sum, p) => sum + Number(p.balance), 0);
  const overdueAmount = payments
    .filter(p => p.dueDate < new Date() && Number(p.balance) > 0)
    .reduce((sum, p) => sum + Number(p.balance), 0);
  const netCashflow = totalRentCollected - totalExpenses;

  return {
    totalRentDue,
    totalRentCollected,
    totalExpenses,
    outstandingBalance,
    overdueAmount,
    netCashflow,
  };
}

/**
 * Calculate monthly rent expected from active leases
 */
export function calculateMonthlyRentExpected(leases: Lease[]): number {
  return leases
    .filter(lease => lease.status === 'ACTIVE')
    .reduce((sum, lease) => sum + Number(lease.rentAmount), 0);
}

export interface PropertyWithUnitsAndLeases {
  id: string;
  units: Unit[];
  leases: Lease[];
}

/**
 * Calculate occupancy rate
 */
export function calculateOccupancyRate(properties: PropertyWithUnitsAndLeases[]): number {
  const totalUnits = properties.reduce((sum, p) => sum + p.units.filter(u => u.status === RecordStatus.ACTIVE).length, 0);
  const totalLeases = properties.reduce((sum, p) => sum + p.leases.filter(l => l.status === 'ACTIVE').length, 0);

  return totalUnits > 0 ? (totalLeases / totalUnits) * 100 : 0;
}

/**
 * Get monthly metrics for the last 12 months
 */
export function getMonthlyMetrics(
  payments: Payment[],
  expenses: Expense[],
  timezone: string = 'America/Cayman'
): MonthlyMetrics[] {
  const now = new Date();
  const metrics: MonthlyMetrics[] = [];

  for (let i = 11; i >= 0; i--) {
    const monthStart = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() - i + 1, 1); // Exclusive end

    const monthPayments = payments.filter(p =>
      p.paymentDate && p.paymentDate >= monthStart && p.paymentDate < monthEnd && p.status !== 'VOID'
    );
    const monthExpenses = expenses.filter(e =>
      e.expenseDate >= monthStart && e.expenseDate < monthEnd && e.status === RecordStatus.ACTIVE
    );

    const rentCollected = monthPayments.reduce((sum, p) => sum + Number(p.amountPaid ?? 0), 0);
    const expensesTotal = monthExpenses.reduce((sum, e) => sum + Number(e.amount), 0);
    const netCashflow = rentCollected - expensesTotal;

    metrics.push({
      month: new Intl.DateTimeFormat('en-US', {
        month: 'short',
        year: 'numeric',
        timeZone: timezone,
      }).format(monthStart),
      rentCollected,
      expenses: expensesTotal,
      netCashflow,
    });
  }

  return metrics;
}

export interface TenantBalance {
  outstandingBalance: number;
  totalPaid: number;
  totalDue: number;
}

/**
 * Calculate balance summary for a tenant
 */
export function calculateTenantBalance(payments: Payment[]): TenantBalance {
  const outstandingBalance = payments.reduce((sum, p) => sum + Number(p.balance), 0);
  const totalPaid = payments.reduce((sum, p) => sum + Number(p.amountPaid ?? 0), 0);
  const totalDue = payments.reduce((sum, p) => sum + Number(p.amountDue), 0);

  return {
    outstandingBalance,
    totalPaid,
    totalDue,
  };
}

export interface PropertyCashflow {
  monthlyRentExpected: number;
  monthlyRentCollected: number;
  monthlyExpenses: number;
  netCashflow: number;
}

/**
 * Calculate property cashflow
 */
export function calculatePropertyCashflow(
  leases: Lease[],
  payments: Payment[],
  expenses: Expense[]
): PropertyCashflow {
  const monthlyRentExpected = calculateMonthlyRentExpected(leases);
  const monthlyRentCollected = payments
    .filter(p => p.status !== 'VOID')
    .reduce((sum, p) => sum + Number(p.amountPaid ?? 0), 0);
  const monthlyExpenses = expenses
    .filter(e => e.status === RecordStatus.ACTIVE)
    .reduce((sum, e) => sum + Number(e.amount), 0);
  const netCashflow = monthlyRentCollected - monthlyExpenses;

  return {
    monthlyRentExpected,
    monthlyRentCollected,
    monthlyExpenses,
    netCashflow,
  };
}
/**
 * Build a cashflow series for the last `months` months (most recent last).
 * Each point sums collected payments (by paymentDate) and active expenses
 * (by expenseDate) within that calendar month. VOID payments and non-ACTIVE
 * expenses are excluded.
 */
export function getRecentCashflowSeries(
  payments: Payment[],
  expenses: Expense[],
  months = 6,
  timezone: string = 'America/Cayman'
): CashflowPoint[] {
  const series: CashflowPoint[] = [];

  for (let i = months - 1; i >= 0; i--) {
    const { start, end } = getMonthRange(i);

    const rentCollected = payments
      .filter(
        (p) =>
          p.status !== 'VOID' &&
          p.paymentDate !== null &&
          p.paymentDate !== undefined &&
          p.paymentDate >= start &&
          p.paymentDate < end
      )
      .reduce((sum, p) => sum + Number(p.amountPaid ?? 0), 0);

    const expensesTotal = expenses
      .filter(
        (e) =>
          e.status === RecordStatus.ACTIVE &&
          e.expenseDate >= start &&
          e.expenseDate < end
      )
      .reduce((sum, e) => sum + Number(e.amount), 0);

    series.push({
      label: new Intl.DateTimeFormat('en-US', {
        month: 'short',
        timeZone: timezone,
      }).format(start),
      rentCollected,
      expenses: expensesTotal,
      net: rentCollected - expensesTotal,
    });
  }

  return series;
}

/**
 * Count payments by collection status for a given month. Uses the same buckets
 * shown on the landlord dashboard: PAID, PARTIAL, OVERDUE, PENDING. Anything
 * else (e.g. VOID) is excluded.
 */
export function getRentCollectionStatusCounts(
  payments: Pick<Payment, 'status'>[]
): RentCollectionStatusCounts {
  const counts = { paid: 0, pending: 0, overdue: 0, partial: 0, total: 0 };

  for (const payment of payments) {
    switch (payment.status) {
      case 'PAID':
        counts.paid += 1;
        counts.total += 1;
        break;
      case 'PENDING':
        counts.pending += 1;
        counts.total += 1;
        break;
      case 'OVERDUE':
        counts.overdue += 1;
        counts.total += 1;
        break;
      case 'PARTIAL':
        counts.partial += 1;
        counts.total += 1;
        break;
      default:
        break;
    }
  }

  return counts;
}

/**
 * Reconstruct the overdue balance as of a given cutoff date by walking
 * payments and accounting for whether each was paid before or after the
 * cutoff. Only payments with dueDate < cutoff contribute. VOID payments
 * are ignored. Payments paid in full on or before the cutoff contribute 0;
 * payments paid after the cutoff contribute their full amountDue at the
 * cutoff; partials paid before the cutoff contribute their remaining
 * balance.
 */
export function overdueBalanceAsOf(
  payments: Payment[],
  cutoff: Date
): number {
  let total = 0;
  for (const payment of payments) {
    if (payment.status === 'VOID') continue;
    if (payment.dueDate >= cutoff) continue;

    const paidBeforeCutoff =
      payment.paymentDate !== null &&
      payment.paymentDate !== undefined &&
      payment.paymentDate <= cutoff;

    const amountDue = Number(payment.amountDue);
    const amountPaid = Number(payment.amountPaid ?? 0);

    if (!paidBeforeCutoff) {
      // Not yet paid as of cutoff — full amount was overdue.
      if (amountDue > 0) total += amountDue;
      continue;
    }

    // Paid before cutoff: any remaining balance was still overdue.
    const remaining = amountDue - amountPaid;
    if (remaining > 0) total += remaining;
  }
  return total;
}
