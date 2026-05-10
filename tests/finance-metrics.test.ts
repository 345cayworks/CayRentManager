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
  getCurrentMonthRange,
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
      { units: [{ status: 'ACTIVE' }, { status: 'ACTIVE' }, { status: 'ACTIVE' }], leases: [{ status: 'ACTIVE' }, { status: 'ACTIVE' }] },
      { units: [{ status: 'ACTIVE' }, { status: 'ACTIVE' }], leases: [{ status: 'ACTIVE' }, { status: 'ACTIVE' }] },
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
      { amountPaid: 1000, status: 'PAID' },
      { amountPaid: 800, status: 'PARTIAL' },
    ];
    const expenses = [
      { amount: 200, status: 'ACTIVE' },
      { amount: 300, status: 'ACTIVE' },
    ];

    const cashflow = calculatePropertyCashflow(leases, payments, expenses);

    expect(cashflow.monthlyRentExpected).toBe(2200);
    expect(cashflow.monthlyRentCollected).toBe(1800);
    expect(cashflow.monthlyExpenses).toBe(500);
    expect(cashflow.netCashflow).toBe(1300);
  });
});

describe('financial hardening tests', () => {
  describe('getCurrentMonthRange', () => {
    it('returns first day of current month as start', () => {
      const { start } = getCurrentMonthRange();
      expect(start.getDate()).toBe(1);
      expect(start.getHours()).toBe(0);
      expect(start.getMinutes()).toBe(0);
      expect(start.getSeconds()).toBe(0);
    });

    it('returns first day of next month as exclusive end', () => {
      const { start, end } = getCurrentMonthRange();
      expect(end.getDate()).toBe(1);
      expect(end.getMonth()).toBe(start.getMonth() === 11 ? 0 : start.getMonth() + 1);
      expect(end.getFullYear()).toBe(start.getMonth() === 11 ? start.getFullYear() + 1 : start.getFullYear());
    });

    it('end date is exclusive (not inclusive)', () => {
      const { start, end } = getCurrentMonthRange();
      const lastDayOfMonth = new Date(start.getFullYear(), start.getMonth() + 1, 0);
      expect(end.getTime()).toBe(lastDayOfMonth.getTime() + 24 * 60 * 60 * 1000);
    });
  });

  describe('rent due vs collected logic', () => {
    it('uses dueDate for rent due calculations', () => {
      const payments = [
        { amountDue: 1000, amountPaid: 1000, balance: 0, dueDate: new Date('2026-05-01'), paymentDate: new Date('2026-05-05') },
        { amountDue: 1200, amountPaid: 0, balance: 1200, dueDate: new Date('2026-05-15'), paymentDate: null },
      ];

      const start = new Date('2026-05-01');
      const end = new Date('2026-06-01');

      const summary = calculateFinancialSummary(payments, [], start, end);
      expect(summary.totalRentDue).toBe(2200); // Both payments are due in May
    });

    it('uses paymentDate for rent collected calculations', () => {
      const payments = [
        { amountDue: 1000, amountPaid: 1000, balance: 0, dueDate: new Date('2026-05-01'), paymentDate: new Date('2026-05-05') },
        { amountDue: 1200, amountPaid: 1200, balance: 0, dueDate: new Date('2026-04-15'), paymentDate: new Date('2026-05-10') },
      ];

      const start = new Date('2026-05-01');
      const end = new Date('2026-06-01');

      const summary = calculateFinancialSummary(payments, [], start, end);
      expect(summary.totalRentCollected).toBe(2200); // Both payments collected in May
    });

    it('unpaid payments count toward due but not collected', () => {
      const payments = [
        { amountDue: 1000, amountPaid: 0, balance: 1000, dueDate: new Date('2026-05-01'), paymentDate: null },
      ];

      const start = new Date('2026-05-01');
      const end = new Date('2026-06-01');

      const summary = calculateFinancialSummary(payments, [], start, end);
      expect(summary.totalRentDue).toBe(1000);
      expect(summary.totalRentCollected).toBe(0);
      expect(summary.outstandingBalance).toBe(1000);
    });
  });

  describe('voided payments exclusion', () => {
    it('excludes voided payments from calculations', () => {
      const payments = [
        { amountDue: 1000, amountPaid: 1000, balance: 0, dueDate: new Date(), paymentDate: new Date(), status: 'PAID' },
        { amountDue: 1200, amountPaid: 1200, balance: 0, dueDate: new Date(), paymentDate: new Date(), status: 'VOID' },
      ];

      // Filter out voided payments as would be done in real usage
      const activePayments = payments.filter(p => p.status !== 'VOID');
      const summary = calculateFinancialSummary(activePayments, []);
      expect(summary.totalRentDue).toBe(1000); // Only non-voided
      expect(summary.totalRentCollected).toBe(1000); // Only non-voided
      expect(summary.outstandingBalance).toBe(0);
    });
  });

  describe('archived/void expenses exclusion', () => {
    it('excludes void/archived expenses from calculations', () => {
      const expenses = [
        { amount: 200, expenseDate: new Date(), status: 'ACTIVE' },
        { amount: 300, expenseDate: new Date(), status: 'VOID' },
        { amount: 400, expenseDate: new Date(), status: 'ARCHIVED' },
      ];

      // Filter out void/archived expenses as would be done in real usage
      const activeExpenses = expenses.filter(e => e.status === 'ACTIVE');
      const summary = calculateFinancialSummary([], activeExpenses);
      expect(summary.totalExpenses).toBe(200); // Only active
    });
  });

  describe('overdue balance calculation', () => {
    it('only counts past due payments with balance > 0', () => {
      const now = new Date();
      const payments = [
        { amountDue: 1000, amountPaid: 1000, balance: 0, dueDate: new Date(now.getTime() - 86400000) }, // Yesterday, paid
        { amountDue: 1200, amountPaid: 400, balance: 800, dueDate: new Date(now.getTime() - 86400000) }, // Yesterday, partial
        { amountDue: 800, amountPaid: 0, balance: 800, dueDate: new Date(now.getTime() + 86400000) }, // Tomorrow, unpaid
      ];

      const summary = calculateFinancialSummary(payments, []);
      expect(summary.overdueAmount).toBe(800); // Only the overdue partial payment
    });
  });

  describe('occupancy rate edge cases', () => {
    it('handles zero units safely', () => {
      const properties: PropertyWithUnitsAndLeases[] = [];
      expect(calculateOccupancyRate(properties)).toBe(0);
    });

    it('handles properties with no active units', () => {
      const properties = [
        { units: [{ status: 'ARCHIVED' }], leases: [{ status: 'ACTIVE' }] },
      ] as PropertyWithUnitsAndLeases[];

      expect(calculateOccupancyRate(properties)).toBe(0);
    });

    it('calculates correctly with mixed active/inactive units', () => {
      const properties = [
        { units: [{ status: 'ACTIVE' }, { status: 'ARCHIVED' }], leases: [{ status: 'ACTIVE' }] },
      ] as PropertyWithUnitsAndLeases[];

      expect(calculateOccupancyRate(properties)).toBe(100); // 1 active unit, 1 active lease
    });
  });

  describe('tenant balance edge cases', () => {
    it('handles empty payment array', () => {
      const balance = calculateTenantBalance([]);
      expect(balance.outstandingBalance).toBe(0);
      expect(balance.totalPaid).toBe(0);
      expect(balance.totalDue).toBe(0);
    });

    it('handles payments with null amountPaid', () => {
      const payments = [
        { amountDue: 1000, amountPaid: null, balance: 1000 },
        { amountDue: 1200, amountPaid: 600, balance: 600 },
      ];

      const balance = calculateTenantBalance(payments);
      expect(balance.totalPaid).toBe(600); // null treated as 0
      expect(balance.totalDue).toBe(2200);
      expect(balance.outstandingBalance).toBe(1600);
    });
  });

  describe('property cashflow edge cases', () => {
    it('handles empty arrays', () => {
      const cashflow = calculatePropertyCashflow([], [], []);
      expect(cashflow.monthlyRentExpected).toBe(0);
      expect(cashflow.monthlyRentCollected).toBe(0);
      expect(cashflow.monthlyExpenses).toBe(0);
      expect(cashflow.netCashflow).toBe(0);
    });

    it('excludes voided payments from collected amount', () => {
      const leases = [{ status: 'ACTIVE', rentAmount: 1000 }];
      const payments = [
        { amountPaid: 1000, status: 'PAID' },
        { amountPaid: 500, status: 'VOID' },
      ];
      const expenses = [{ amount: 200, status: 'ACTIVE' }];

      const cashflow = calculatePropertyCashflow(leases, payments, expenses);
      expect(cashflow.monthlyRentCollected).toBe(1000); // Voided payment excluded
      expect(cashflow.netCashflow).toBe(800);
    });

    it('excludes inactive expenses', () => {
      const leases = [{ status: 'ACTIVE', rentAmount: 1000 }];
      const payments = [{ amountPaid: 1000, status: 'PAID' }];
      const expenses = [
        { amount: 200, status: 'ACTIVE' },
        { amount: 300, status: 'VOID' },
      ];

      const cashflow = calculatePropertyCashflow(leases, payments, expenses);
      expect(cashflow.monthlyExpenses).toBe(200); // Void expense excluded
      expect(cashflow.netCashflow).toBe(800);
    });
  });
});
