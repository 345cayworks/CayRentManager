import { describe, expect, it } from 'vitest';
import {
  aggregateMaintenanceCosts,
  computePropertyPL,
  groupExpenses,
  inRange,
  leaseExpiryRows,
  parseReportRange,
  tenantBalanceRows,
  type DateRange,
} from '@/lib/finance/reports';

const NOW = new Date('2026-05-16T12:00:00.000Z');

describe('parseReportRange', () => {
  it('defaults to first day of (now - 11 months) through end-of-day now', () => {
    const r = parseReportRange({}, NOW);
    expect(r.start.getFullYear()).toBe(2025);
    expect(r.start.getMonth()).toBe(5); // June (0-based) = May - 11 wraps
    expect(r.start.getDate()).toBe(1);
    expect(r.end.getHours()).toBe(23);
    expect(r.end.getMinutes()).toBe(59);
    expect(r.end.getDate()).toBe(16);
  });

  it('parses valid from/to', () => {
    const r = parseReportRange({ from: '2026-01-01', to: '2026-03-31' }, NOW);
    expect(r.start.getFullYear()).toBe(2026);
    expect(r.start.getMonth()).toBe(0);
    expect(r.start.getDate()).toBe(1);
    expect(r.end.getMonth()).toBe(2);
    expect(r.end.getDate()).toBe(31);
  });

  it('falls back to defaults for invalid strings', () => {
    const r = parseReportRange({ from: 'garbage', to: 'nope' }, NOW);
    const def = parseReportRange({}, NOW);
    expect(r.start.getTime()).toBe(def.start.getTime());
    expect(r.end.getTime()).toBe(def.end.getTime());
  });

  it('swaps reversed ranges', () => {
    const r = parseReportRange({ from: '2026-06-01', to: '2026-01-01' }, NOW);
    expect(r.start.getTime()).toBeLessThan(r.end.getTime());
    expect(r.start.getMonth()).toBe(0);
  });

  it('treats end as inclusive end-of-day', () => {
    const r = parseReportRange({ from: '2026-02-01', to: '2026-02-01' }, NOW);
    expect(r.end.getHours()).toBe(23);
    expect(r.end.getMilliseconds()).toBe(999);
  });
});

describe('inRange', () => {
  const range: DateRange = {
    start: new Date('2026-01-01T00:00:00.000Z'),
    end: new Date('2026-01-31T23:59:59.999Z'),
  };

  it('is inclusive at boundaries', () => {
    expect(inRange(new Date('2026-01-01T00:00:00.000Z'), range)).toBe(true);
    expect(inRange(new Date('2026-01-31T23:59:59.999Z'), range)).toBe(true);
  });

  it('rejects outside and null', () => {
    expect(inRange(new Date('2025-12-31T23:59:59.999Z'), range)).toBe(false);
    expect(inRange(new Date('2026-02-01T00:00:00.000Z'), range)).toBe(false);
    expect(inRange(null, range)).toBe(false);
    expect(inRange(undefined, range)).toBe(false);
  });
});

describe('tenantBalanceRows', () => {
  const tenants = [
    { id: 't1', fullName: 'Alice', email: 'a@x.com' },
    { id: 't2', fullName: 'Bob', email: 'b@x.com' },
  ];

  it('aggregates per tenant and computes overdue', () => {
    const payments = [
      {
        tenantId: 't1',
        amountDue: 100,
        amountPaid: 60,
        balance: 40,
        dueDate: new Date('2026-04-01T00:00:00.000Z'),
      },
      {
        tenantId: 't1',
        amountDue: 100,
        amountPaid: 100,
        balance: 0,
        dueDate: new Date('2026-05-01T00:00:00.000Z'),
      },
    ];
    const rows = tenantBalanceRows(tenants, payments, NOW);
    const alice = rows.find((r) => r.tenantId === 't1')!;
    expect(alice.totalDue).toBe(200);
    expect(alice.totalPaid).toBe(160);
    expect(alice.balance).toBe(40);
    expect(alice.overdue).toBe(40);
  });

  it('returns zeros for tenant with no payments', () => {
    const rows = tenantBalanceRows(tenants, [], NOW);
    const bob = rows.find((r) => r.tenantId === 't2')!;
    expect(bob.totalDue).toBe(0);
    expect(bob.balance).toBe(0);
    expect(bob.overdue).toBe(0);
  });

  it('does not count future-due unpaid as overdue', () => {
    const payments = [
      {
        tenantId: 't1',
        amountDue: 100,
        amountPaid: 0,
        balance: 100,
        dueDate: new Date('2026-12-01T00:00:00.000Z'),
      },
    ];
    const rows = tenantBalanceRows(tenants, payments, NOW);
    expect(rows.find((r) => r.tenantId === 't1')!.overdue).toBe(0);
  });
});

describe('groupExpenses', () => {
  const expenses = [
    { category: 'Repairs', propertyName: 'A', amount: 100, expenseDate: NOW },
    { category: 'Repairs', propertyName: 'B', amount: 50, expenseDate: NOW },
    { category: 'Utilities', propertyName: 'A', amount: 200, expenseDate: NOW },
  ];

  it('groups by category sorted desc with grandTotal', () => {
    const { rows, grandTotal } = groupExpenses(expenses, 'category');
    expect(grandTotal).toBe(350);
    expect(rows[0].key).toBe('Utilities');
    expect(rows[0].total).toBe(200);
    expect(rows[1].key).toBe('Repairs');
    expect(rows[1].total).toBe(150);
    expect(rows[1].count).toBe(2);
  });

  it('groups by property', () => {
    const { rows } = groupExpenses(expenses, 'property');
    expect(rows[0].key).toBe('A');
    expect(rows[0].total).toBe(300);
    expect(rows[0].count).toBe(2);
  });
});

describe('computePropertyPL', () => {
  const range: DateRange = {
    start: new Date('2026-01-01T00:00:00.000Z'),
    end: new Date('2026-01-31T23:59:59.999Z'),
  };
  const properties = [
    { id: 'p1', name: 'One' },
    { id: 'p2', name: 'Two' },
  ];

  it('counts income by paymentDate in range and expense by expenseDate', () => {
    const payments = [
      { propertyId: 'p1', amountPaid: 500, paymentDate: new Date('2026-01-10T00:00:00.000Z') },
      { propertyId: 'p1', amountPaid: 999, paymentDate: new Date('2026-02-10T00:00:00.000Z') },
      { propertyId: 'p1', amountPaid: 100, paymentDate: null },
    ];
    const expenses = [
      { propertyId: 'p1', amount: 200, expenseDate: new Date('2026-01-15T00:00:00.000Z') },
    ];
    const { rows, totals } = computePropertyPL(properties, payments, expenses, range);
    const p1 = rows.find((r) => r.propertyId === 'p1')!;
    expect(p1.income).toBe(500);
    expect(p1.expense).toBe(200);
    expect(p1.net).toBe(300);
    expect(totals.income).toBe(500);
    expect(totals.net).toBe(300);
  });

  it('returns zeros for property with no activity', () => {
    const { rows } = computePropertyPL(properties, [], [], range);
    const p2 = rows.find((r) => r.propertyId === 'p2')!;
    expect(p2.income).toBe(0);
    expect(p2.expense).toBe(0);
    expect(p2.net).toBe(0);
  });
});

describe('aggregateMaintenanceCosts', () => {
  const range: DateRange = {
    start: new Date('2026-01-01T00:00:00.000Z'),
    end: new Date('2026-03-31T23:59:59.999Z'),
  };

  it('treats null costs as 0 and filters by createdAt', () => {
    const wos = [
      { propertyName: 'A', category: 'Plumbing', estimatedCost: 100, actualCost: null, createdAt: new Date('2026-02-01T00:00:00.000Z') },
      { propertyName: 'A', category: 'Plumbing', estimatedCost: null, actualCost: 80, createdAt: new Date('2026-02-15T00:00:00.000Z') },
      { propertyName: 'A', category: 'Plumbing', estimatedCost: 999, actualCost: 999, createdAt: new Date('2025-12-01T00:00:00.000Z') },
    ];
    const { rows, totals } = aggregateMaintenanceCosts(wos, 'property', range);
    expect(rows).toHaveLength(1);
    expect(rows[0].estimated).toBe(100);
    expect(rows[0].actual).toBe(80);
    expect(rows[0].count).toBe(2);
    expect(totals.actual).toBe(80);
  });

  it('groups by category', () => {
    const wos = [
      { propertyName: 'A', category: 'HVAC', estimatedCost: 10, actualCost: 12, createdAt: new Date('2026-01-05T00:00:00.000Z') },
      { propertyName: 'B', category: 'HVAC', estimatedCost: 20, actualCost: 25, createdAt: new Date('2026-01-06T00:00:00.000Z') },
    ];
    const { rows } = aggregateMaintenanceCosts(wos, 'category', range);
    expect(rows).toHaveLength(1);
    expect(rows[0].key).toBe('HVAC');
    expect(rows[0].actual).toBe(37);
  });
});

describe('leaseExpiryRows', () => {
  const leases = [
    { id: 'l1', tenantName: 'A', propertyName: 'P', unitName: '1', endDate: new Date('2026-06-01T00:00:00.000Z'), rentAmount: 1000, status: 'ACTIVE' },
    { id: 'l2', tenantName: 'B', propertyName: 'P', unitName: '2', endDate: new Date('2026-05-20T00:00:00.000Z'), rentAmount: 1200, status: 'ACTIVE' },
    { id: 'l3', tenantName: 'C', propertyName: 'P', unitName: '3', endDate: new Date('2027-01-01T00:00:00.000Z'), rentAmount: 900, status: 'ACTIVE' },
    { id: 'l4', tenantName: 'D', propertyName: 'P', unitName: '4', endDate: new Date('2026-05-25T00:00:00.000Z'), rentAmount: 800, status: 'ENDED' },
  ];

  it('returns only ACTIVE leases within days, sorted soonest first', () => {
    const rows = leaseExpiryRows(leases, 90, NOW);
    expect(rows.map((r) => r.id)).toEqual(['l2', 'l1']);
    expect(rows[0].daysUntil).toBe(4);
  });

  it('excludes far-out leases', () => {
    const rows = leaseExpiryRows(leases, 10, NOW);
    expect(rows.map((r) => r.id)).toEqual(['l2']);
  });
});
