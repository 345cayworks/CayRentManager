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
  expenses: Expense[]
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
      month: monthStart.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
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