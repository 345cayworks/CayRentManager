import { describe, expect, it } from 'vitest';
import {
  getMonthRange,
  getRecentCashflowSeries,
  getRentCollectionStatusCounts,
  monthOverMonthDelta,
  overdueBalanceAsOf,
} from '@/lib/finance/landlord-financials';

describe('getMonthRange', () => {
  it('returns the current month for monthsBack=0', () => {
    const now = new Date();
    const { start, end } = getMonthRange(0);
    expect(start.getMonth()).toBe(now.getMonth());
    expect(start.getDate()).toBe(1);
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });

  it('returns the previous month for monthsBack=1', () => {
    const now = new Date();
    const { start } = getMonthRange(1);
    const expectedMonth = (now.getMonth() - 1 + 12) % 12;
    expect(start.getMonth()).toBe(expectedMonth);
  });

  it('returns six earlier ranges for monthsBack=5', () => {
    const { start } = getMonthRange(5);
    const now = new Date();
    const monthDiff =
      (now.getFullYear() - start.getFullYear()) * 12 +
      (now.getMonth() - start.getMonth());
    expect(monthDiff).toBe(5);
  });
});

describe('monthOverMonthDelta', () => {
  it('reports up direction with positive percent change', () => {
    const result = monthOverMonthDelta(120, 100);
    expect(result.direction).toBe('up');
    expect(result.deltaPct).toBe(20);
  });

  it('reports down direction with negative percent change', () => {
    const result = monthOverMonthDelta(80, 100);
    expect(result.direction).toBe('down');
    expect(result.deltaPct).toBe(-20);
  });

  it('reports flat when values are equal', () => {
    const result = monthOverMonthDelta(100, 100);
    expect(result.direction).toBe('flat');
    expect(result.deltaPct).toBe(0);
  });

  it('handles zero previous value without dividing by zero', () => {
    const result = monthOverMonthDelta(100, 0);
    expect(result.direction).toBe('up');
    expect(result.deltaPct).toBe(0);
  });

  it('rounds percent to one decimal place', () => {
    const result = monthOverMonthDelta(126, 100);
    expect(result.deltaPct).toBe(26);

    const fractional = monthOverMonthDelta(112.6, 100);
    expect(fractional.deltaPct).toBe(12.6);
  });
});

describe('getRentCollectionStatusCounts', () => {
  it('counts payments by status and excludes VOID', () => {
    const counts = getRentCollectionStatusCounts([
      { status: 'PAID' },
      { status: 'PAID' },
      { status: 'PENDING' },
      { status: 'OVERDUE' },
      { status: 'PARTIAL' },
      { status: 'VOID' },
    ] as never);

    expect(counts).toEqual({ paid: 2, pending: 1, overdue: 1, partial: 1, total: 5 });
  });

  it('returns zeros for an empty list', () => {
    expect(getRentCollectionStatusCounts([])).toEqual({
      paid: 0,
      pending: 0,
      overdue: 0,
      partial: 0,
      total: 0,
    });
  });
});

describe('getRecentCashflowSeries', () => {
  it('returns the requested number of month buckets in chronological order', () => {
    const series = getRecentCashflowSeries([], [], 6);
    expect(series).toHaveLength(6);
    // Labels are short month names; the last entry should be the current month.
    // getRecentCashflowSeries uses getMonthRange which constructs month boundaries
    // in the process's local timezone, then renders the label in America/Cayman.
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const expectedLastLabel = new Intl.DateTimeFormat('en-US', {
      month: 'short',
      timeZone: 'America/Cayman',
    }).format(monthStart);
    expect(series[5].label).toBe(expectedLastLabel);
  });

  it('sums collected payments and active expenses per month', () => {
    const { start: thisStart } = getMonthRange(0);
    const inThisMonth = new Date(thisStart.getFullYear(), thisStart.getMonth(), 15);

    const payments = [
      {
        status: 'PAID',
        amountPaid: 1500,
        paymentDate: inThisMonth,
      },
      {
        status: 'VOID',
        amountPaid: 999,
        paymentDate: inThisMonth,
      },
    ];
    const expenses = [
      {
        status: 'ACTIVE',
        amount: 200,
        expenseDate: inThisMonth,
      },
      {
        status: 'ARCHIVED',
        amount: 50,
        expenseDate: inThisMonth,
      },
    ];

    const series = getRecentCashflowSeries(payments as never, expenses as never, 6);
    const current = series[series.length - 1];
    expect(current.rentCollected).toBe(1500);
    expect(current.expenses).toBe(200);
    expect(current.net).toBe(1300);
  });
});

describe('overdueBalanceAsOf', () => {
  const cutoff = new Date('2026-04-30T23:59:59Z');
  const dayBeforeCutoff = new Date('2026-04-15T00:00:00Z');
  const dayAfterCutoff = new Date('2026-05-15T00:00:00Z');

  it('ignores payments that were not yet due at the cutoff', () => {
    const total = overdueBalanceAsOf(
      [
        {
          status: 'PENDING',
          amountDue: 1000,
          amountPaid: 0,
          balance: 1000,
          dueDate: dayAfterCutoff,
          paymentDate: null,
        },
      ] as never,
      cutoff,
    );
    expect(total).toBe(0);
  });

  it('counts unpaid payments due before the cutoff at their full amountDue', () => {
    const total = overdueBalanceAsOf(
      [
        {
          status: 'OVERDUE',
          amountDue: 1500,
          amountPaid: 0,
          balance: 1500,
          dueDate: dayBeforeCutoff,
          paymentDate: null,
        },
      ] as never,
      cutoff,
    );
    expect(total).toBe(1500);
  });

  it('counts payments paid after the cutoff at their full amountDue as overdue at the cutoff', () => {
    const total = overdueBalanceAsOf(
      [
        {
          status: 'PAID',
          amountDue: 1500,
          amountPaid: 1500,
          balance: 0,
          dueDate: dayBeforeCutoff,
          paymentDate: dayAfterCutoff,
        },
      ] as never,
      cutoff,
    );
    expect(total).toBe(1500);
  });

  it('counts partials paid before the cutoff at their remaining balance', () => {
    const total = overdueBalanceAsOf(
      [
        {
          status: 'PARTIAL',
          amountDue: 1500,
          amountPaid: 500,
          balance: 1000,
          dueDate: dayBeforeCutoff,
          paymentDate: dayBeforeCutoff,
        },
      ] as never,
      cutoff,
    );
    expect(total).toBe(1000);
  });

  it('ignores VOID payments', () => {
    const total = overdueBalanceAsOf(
      [
        {
          status: 'VOID',
          amountDue: 9999,
          amountPaid: 0,
          balance: 9999,
          dueDate: dayBeforeCutoff,
          paymentDate: null,
        },
      ] as never,
      cutoff,
    );
    expect(total).toBe(0);
  });
});
