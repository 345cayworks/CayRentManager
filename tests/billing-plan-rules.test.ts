import { describe, expect, it } from 'vitest';
import {
  computeRenewedPeriodEnd,
  planMatchesUnitCount,
  recommendPlanForUnits,
  type PlanLike,
} from '@/lib/billing/plan-rules';

const STARTER: PlanLike = { id: 's', code: 'STARTER', amount: 49, minUnits: 1, maxUnits: 4, status: 'ACTIVE' };
const PROFESSIONAL: PlanLike = { id: 'p', code: 'PROFESSIONAL', amount: 99, minUnits: 5, maxUnits: 10, status: 'ACTIVE' };
const PROPERTY_MANAGER: PlanLike = { id: 'm', code: 'PROPERTY_MANAGER', amount: 149, minUnits: 11, maxUnits: null, status: 'ACTIVE' };
const ALL = [STARTER, PROFESSIONAL, PROPERTY_MANAGER];

describe('planMatchesUnitCount', () => {
  it('STARTER (1-4) matches edges and rejects outside', () => {
    expect(planMatchesUnitCount(STARTER, 1)).toBe(true);
    expect(planMatchesUnitCount(STARTER, 4)).toBe(true);
    expect(planMatchesUnitCount(STARTER, 0)).toBe(false);
    expect(planMatchesUnitCount(STARTER, 5)).toBe(false);
  });

  it('PROPERTY_MANAGER (11, open-ended) matches 11 and large, rejects 10', () => {
    expect(planMatchesUnitCount(PROPERTY_MANAGER, 11)).toBe(true);
    expect(planMatchesUnitCount(PROPERTY_MANAGER, 9999)).toBe(true);
    expect(planMatchesUnitCount(PROPERTY_MANAGER, 10)).toBe(false);
  });
});

describe('recommendPlanForUnits', () => {
  it('picks the matching plan by unit count', () => {
    expect(recommendPlanForUnits(3, ALL)?.code).toBe('STARTER');
    expect(recommendPlanForUnits(7, ALL)?.code).toBe('PROFESSIONAL');
    expect(recommendPlanForUnits(50, ALL)?.code).toBe('PROPERTY_MANAGER');
  });

  it('returns null for 0 units', () => {
    expect(recommendPlanForUnits(0, ALL)).toBeNull();
  });

  it('ignores non-ACTIVE plans', () => {
    const archivedStarter: PlanLike = { ...STARTER, status: 'ARCHIVED' };
    expect(recommendPlanForUnits(3, [archivedStarter, PROFESSIONAL, PROPERTY_MANAGER])).toBeNull();
  });

  it('lowest matching range wins when ranges are sane and non-overlapping', () => {
    // Shuffled input; deterministic by lowest minUnits.
    expect(recommendPlanForUnits(7, [PROPERTY_MANAGER, PROFESSIONAL, STARTER])?.code).toBe('PROFESSIONAL');
  });
});

describe('computeRenewedPeriodEnd', () => {
  it('extends from a future period end (+1 month)', () => {
    const now = new Date(Date.UTC(2026, 4, 18));
    const periodEnd = new Date(Date.UTC(2026, 5, 1));
    const result = computeRenewedPeriodEnd(periodEnd, 1, now);
    expect(result.toISOString()).toBe(new Date(Date.UTC(2026, 6, 1)).toISOString());
  });

  it('extends from now when period end is expired (+1 month)', () => {
    const now = new Date(Date.UTC(2026, 4, 18));
    const periodEnd = new Date(Date.UTC(2026, 3, 1));
    const result = computeRenewedPeriodEnd(periodEnd, 1, now);
    expect(result.toISOString()).toBe(new Date(Date.UTC(2026, 5, 18)).toISOString());
  });

  it('honors intervalMonths = 3', () => {
    const now = new Date(Date.UTC(2026, 0, 10));
    const periodEnd = new Date(Date.UTC(2025, 0, 1));
    const result = computeRenewedPeriodEnd(periodEnd, 3, now);
    expect(result.toISOString()).toBe(new Date(Date.UTC(2026, 3, 10)).toISOString());
  });

  it('handles year rollover (Dec -> Mar)', () => {
    const now = new Date(Date.UTC(2026, 11, 15));
    const periodEnd = new Date(Date.UTC(2026, 11, 31));
    const result = computeRenewedPeriodEnd(periodEnd, 3, now);
    // Dec 31 + 3 months -> Mar 31 2027.
    expect(result.toISOString()).toBe(new Date(Date.UTC(2027, 2, 31)).toISOString());
  });

  it('computes in UTC and clamps month-length overflow', () => {
    const now = new Date(Date.UTC(2026, 0, 1));
    const periodEnd = new Date(Date.UTC(2026, 0, 31));
    const result = computeRenewedPeriodEnd(periodEnd, 1, now);
    // Jan 31 + 1 month -> clamp to Feb 28 2026 (non-leap).
    expect(result.toISOString()).toBe(new Date(Date.UTC(2026, 1, 28)).toISOString());
  });
});
