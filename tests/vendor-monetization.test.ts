import { describe, expect, it } from 'vitest';
import {
  computeVendorRevenue,
  isBillingStatus,
  summarizeLeads,
  type RevenueVendor,
} from '@/lib/vendors/monetization';

function vendor(overrides: Partial<RevenueVendor>): RevenueVendor {
  return {
    monthlyFee: null,
    billingStatus: 'NONE',
    featured: false,
    sponsored: false,
    status: 'ACTIVE',
    ...overrides,
  };
}

describe('isBillingStatus', () => {
  it('returns true for valid members', () => {
    expect(isBillingStatus('NONE')).toBe(true);
    expect(isBillingStatus('TRIAL')).toBe(true);
    expect(isBillingStatus('ACTIVE')).toBe(true);
    expect(isBillingStatus('PAST_DUE')).toBe(true);
    expect(isBillingStatus('CANCELLED')).toBe(true);
  });

  it('returns false for junk', () => {
    expect(isBillingStatus('')).toBe(false);
    expect(isBillingStatus('active')).toBe(false);
    expect(isBillingStatus('PAID')).toBe(false);
  });
});

describe('computeVendorRevenue', () => {
  it('counts ACTIVE billing with a fee toward mrr and billable', () => {
    const r = computeVendorRevenue([vendor({ billingStatus: 'ACTIVE', monthlyFee: 49 })]);
    expect(r.mrr).toBe(49);
    expect(r.billable).toBe(1);
    expect(r.atRisk).toBe(0);
    expect(r.trialing).toBe(0);
  });

  it('counts PAST_DUE in mrr, billable and atRisk', () => {
    const r = computeVendorRevenue([vendor({ billingStatus: 'PAST_DUE', monthlyFee: 30 })]);
    expect(r.mrr).toBe(30);
    expect(r.billable).toBe(1);
    expect(r.atRisk).toBe(1);
  });

  it('excludes TRIAL from mrr but counts it trialing', () => {
    const r = computeVendorRevenue([vendor({ billingStatus: 'TRIAL', monthlyFee: 99 })]);
    expect(r.mrr).toBe(0);
    expect(r.billable).toBe(0);
    expect(r.trialing).toBe(1);
  });

  it('NONE and CANCELLED contribute 0', () => {
    const r = computeVendorRevenue([
      vendor({ billingStatus: 'NONE', monthlyFee: 10 }),
      vendor({ billingStatus: 'CANCELLED', monthlyFee: 20 }),
    ]);
    expect(r.mrr).toBe(0);
    expect(r.billable).toBe(0);
  });

  it('treats null monthlyFee as 0 while still counting billable', () => {
    const r = computeVendorRevenue([vendor({ billingStatus: 'ACTIVE', monthlyFee: null })]);
    expect(r.mrr).toBe(0);
    expect(r.billable).toBe(1);
  });

  it('excludes non-ACTIVE RecordStatus even if billingStatus is ACTIVE', () => {
    const r = computeVendorRevenue([
      vendor({ status: 'ARCHIVED', billingStatus: 'ACTIVE', monthlyFee: 49 }),
    ]);
    expect(r.mrr).toBe(0);
    expect(r.billable).toBe(0);
  });

  it('ignores unknown billingStatus', () => {
    const r = computeVendorRevenue([vendor({ billingStatus: 'WAT', monthlyFee: 50 })]);
    expect(r.mrr).toBe(0);
    expect(r.billable).toBe(0);
  });

  it('tallies sponsored and featured counts across all vendors', () => {
    const r = computeVendorRevenue([
      vendor({ sponsored: true }),
      vendor({ featured: true }),
      vendor({ sponsored: true, featured: true, status: 'ARCHIVED' }),
    ]);
    expect(r.sponsoredCount).toBe(2);
    expect(r.featuredCount).toBe(2);
  });

  it('aggregates a mixed portfolio', () => {
    const r = computeVendorRevenue([
      vendor({ billingStatus: 'ACTIVE', monthlyFee: 100 }),
      vendor({ billingStatus: 'PAST_DUE', monthlyFee: 50 }),
      vendor({ billingStatus: 'TRIAL', monthlyFee: 25 }),
      vendor({ billingStatus: 'NONE' }),
    ]);
    expect(r.mrr).toBe(150);
    expect(r.billable).toBe(2);
    expect(r.atRisk).toBe(1);
    expect(r.trialing).toBe(1);
  });
});

describe('summarizeLeads', () => {
  it('groups by vendor and splits ADD_TO_LIST vs INQUIRY', () => {
    const out = summarizeLeads([
      { globalVendorId: 'a', type: 'ADD_TO_LIST' },
      { globalVendorId: 'a', type: 'ADD_TO_LIST' },
      { globalVendorId: 'a', type: 'INQUIRY' },
      { globalVendorId: 'b', type: 'INQUIRY' },
    ]);
    expect(out.a).toEqual({ total: 3, addToList: 2, inquiry: 1 });
    expect(out.b).toEqual({ total: 1, addToList: 0, inquiry: 1 });
  });

  it('omits vendors with no leads', () => {
    const out = summarizeLeads([{ globalVendorId: 'a', type: 'INQUIRY' }]);
    expect(out.b).toBeUndefined();
  });

  it('counts unknown type only in total', () => {
    const out = summarizeLeads([{ globalVendorId: 'a', type: 'MYSTERY' }]);
    expect(out.a).toEqual({ total: 1, addToList: 0, inquiry: 0 });
  });

  it('returns an empty object for no leads', () => {
    expect(summarizeLeads([])).toEqual({});
  });
});
