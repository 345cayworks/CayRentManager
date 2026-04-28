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
