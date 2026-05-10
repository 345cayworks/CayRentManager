import { describe, expect, it } from 'vitest';
import {
  occupancyRate,
  rentCollectionRate,
  outstandingBalance,
  unitCashflow,
  portfolioCashflow,
  leaseExpiringSoon,
  paymentStatus,
  expenseTotalsByCategory,
} from '@/lib/finance/metrics';
import {
  calculateFinancialSummary,
  calculateMonthlyRentExpected,
  calculateOccupancyRate,
  calculateTenantBalance,
  calculatePropertyCashflow,
  PropertyWithUnitsAndLeases,
} from '@/lib/finance/landlord-financials';

describe('financial calculations', () => {
  it('calculates occupancy, collections and balances', () => {
    expect(occupancyRate(10, 8)).toBe(80);

    const payments = [
      { amountDue: 1000, amountPaid: 1000, dueDate: new Date('2026-01-01') },
      { amountDue: 1200, amountPaid: 400, dueDate: new Date('2026-01-05') },
    ];

    expect(rentCollectionRate(payments)).toBeCloseTo(63.64, 2);
    expect(outstandingBalance(payments)).toBe(800);
  });

  it('calculates unit and portfolio cashflow', () => {
    expect(unitCashflow(5000, 1700)).toBe(3300);
    expect(
      portfolioCashflow([
        { rentCollected: 5000, expenseTotal: 1700 },
        { rentCollected: 3300, expenseTotal: 1800 },
      ]),
    ).toBe(4800);
  });

  it('calculates lease expirations, payment status, and expense categories', () => {
    const expiring = leaseExpiringSoon([
      { status: 'active', endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) },
      { status: 'terminated', endDate: new Date(Date.now() + 1000 * 60 * 60 * 24 * 30) },
    ]);

    expect(expiring).toHaveLength(1);
    expect(paymentStatus({ amountDue: 1000, amountPaid: 1000, dueDate: new Date() })).toBe('paid');
    expect(paymentStatus({ amountDue: 1000, amountPaid: 100, dueDate: new Date('2025-01-01') })).toBe('overdue');

    expect(
      expenseTotalsByCategory([
        { category: 'maintenance', amount: 200 },
        { category: 'maintenance', amount: 300 },
        { category: 'utilities', amount: 100 },
      ]),
    ).toEqual({ maintenance: 500, utilities: 100 });
  });
});

describe('landlord financial calculations', () => {
  it('calculates financial summary', () => {
    const payments = [
      { amountDue: 1000, amountPaid: 1000, balance: 0, dueDate: new Date() },
      { amountDue: 1200, amountPaid: 400, balance: 800, dueDate: new Date() },
    ];
    const expenses = [
      { amount: 200, expenseDate: new Date() },
      { amount: 300, expenseDate: new Date() },
    ];

    const summary = calculateFinancialSummary(payments, expenses);

    expect(summary.totalRentDue).toBe(2200);
    expect(summary.totalRentCollected).toBe(1400);
    expect(summary.totalExpenses).toBe(500);
    expect(summary.outstandingBalance).toBe(800);
    expect(summary.netCashflow).toBe(900);
  });

  it('calculates monthly rent expected', () => {
    const leases = [
      { status: 'ACTIVE', rentAmount: 1000 },
      { status: 'EXPIRED', rentAmount: 1200 },
      { status: 'ACTIVE', rentAmount: 800 },
    ];

    expect(calculateMonthlyRentExpected(leases)).toBe(1800);
  });

  it('calculates occupancy rate', () => {
    const properties = [
      { units: [{}, {}, {}], leases: [{}, {}] },
      { units: [{}, {}], leases: [{}, {}] },
    ] as PropertyWithUnitsAndLeases[];

    expect(calculateOccupancyRate(properties)).toBe(80);
  });

  it('calculates tenant balance', () => {
    const payments = [
      { amountDue: 1000, amountPaid: 1000, balance: 0 },
      { amountDue: 1200, amountPaid: 400, balance: 800 },
    ];

    const balance = calculateTenantBalance(payments);

    expect(balance.outstandingBalance).toBe(800);
    expect(balance.totalPaid).toBe(1400);
    expect(balance.totalDue).toBe(2200);
  });

  it('calculates property cashflow', () => {
    const leases = [
      { status: 'ACTIVE', rentAmount: 1000 },
      { status: 'ACTIVE', rentAmount: 1200 },
    ];
    const payments = [
      { amountPaid: 1000 },
      { amountPaid: 800 },
    ];
    const expenses = [
      { amount: 200 },
      { amount: 300 },
    ];

    const cashflow = calculatePropertyCashflow(leases, payments, expenses);

    expect(cashflow.monthlyRentExpected).toBe(2200);
    expect(cashflow.monthlyRentCollected).toBe(1800);
    expect(cashflow.monthlyExpenses).toBe(500);
    expect(cashflow.netCashflow).toBe(1300);
  });
});
