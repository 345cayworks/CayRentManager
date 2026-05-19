import { describe, expect, it } from 'vitest';
import {
  computeDiscountedInvoice,
  describeRegistrantBenefit,
  validateAccessCode,
  type AccessCodeValidationInput,
} from '@/lib/billing/access-codes';

type Overrides = Omit<Partial<AccessCodeValidationInput>, 'code'> & {
  code?: Partial<AccessCodeValidationInput['code']>;
};

function baseInput(overrides: Overrides = {}): AccessCodeValidationInput {
  const { code, ...rest } = overrides;
  return {
    now: new Date('2026-05-18T12:00:00.000Z'),
    code: {
      status: 'ACTIVE',
      startsAt: null,
      expiresAt: null,
      maxRedemptions: null,
      maxRedemptionsPerEmail: 1,
      appliesToPlanId: null,
      isStackable: false,
      referrerUserId: null,
      referrerLandlordId: null,
      rewardType: 'PERCENT_DISCOUNT',
      rewardValue: 50,
      rewardMonths: null,
      ...(code ?? {}),
    },
    totalRedemptions: 0,
    emailRedemptions: 0,
    ...rest,
  };
}

describe('validateAccessCode', () => {
  it('rejects PAUSED and ARCHIVED codes', () => {
    expect(validateAccessCode(baseInput({ code: { status: 'PAUSED' } })).ok).toBe(false);
    expect(validateAccessCode(baseInput({ code: { status: 'ARCHIVED' } })).ok).toBe(false);
  });

  it('rejects before startsAt and after expiresAt', () => {
    const before = validateAccessCode(
      baseInput({ code: { startsAt: new Date('2026-06-01T00:00:00.000Z') } }),
    );
    expect(before.ok).toBe(false);
    const after = validateAccessCode(
      baseInput({ code: { expiresAt: new Date('2026-05-01T00:00:00.000Z') } }),
    );
    expect(after.ok).toBe(false);
  });

  it('honours maxRedemptions; null means unlimited', () => {
    expect(
      validateAccessCode(baseInput({ code: { maxRedemptions: 5 }, totalRedemptions: 5 })).ok,
    ).toBe(false);
    expect(
      validateAccessCode(baseInput({ code: { maxRedemptions: 5 }, totalRedemptions: 4 })).ok,
    ).toBe(true);
    expect(
      validateAccessCode(baseInput({ code: { maxRedemptions: null }, totalRedemptions: 999 })).ok,
    ).toBe(true);
  });

  it('honours maxRedemptionsPerEmail', () => {
    expect(
      validateAccessCode(baseInput({ code: { maxRedemptionsPerEmail: 1 }, emailRedemptions: 1 }))
        .ok,
    ).toBe(false);
  });

  it('enforces appliesToPlanId match', () => {
    expect(
      validateAccessCode(
        baseInput({ code: { appliesToPlanId: 'plan_a' }, selectedPlanId: 'plan_b' }),
      ).ok,
    ).toBe(false);
    expect(
      validateAccessCode(
        baseInput({ code: { appliesToPlanId: 'plan_a' }, selectedPlanId: 'plan_a' }),
      ).ok,
    ).toBe(true);
    expect(
      validateAccessCode(baseInput({ code: { appliesToPlanId: 'plan_a' } })).ok,
    ).toBe(true);
  });

  it('blocks self-referral by user and by landlord', () => {
    expect(
      validateAccessCode(
        baseInput({ code: { referrerUserId: 'u1' }, registrantUserId: 'u1' }),
      ).ok,
    ).toBe(false);
    expect(
      validateAccessCode(
        baseInput({ code: { referrerLandlordId: 'l1' }, registrantLandlordId: 'l1' }),
      ).ok,
    ).toBe(false);
  });

  it('rejects non-stackable when another non-stackable code exists; stackable ok', () => {
    expect(
      validateAccessCode(
        baseInput({ code: { isStackable: false }, alreadyHasNonStackableCode: true }),
      ).ok,
    ).toBe(false);
    expect(
      validateAccessCode(
        baseInput({ code: { isStackable: true }, alreadyHasNonStackableCode: true }),
      ).ok,
    ).toBe(true);
  });

  it('returns ok with a preview on the happy path', () => {
    const result = validateAccessCode(baseInput());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.preview).toContain('50% off');
    }
  });
});

describe('describeRegistrantBenefit', () => {
  it('describes percent, fixed, free-months and complimentary', () => {
    expect(describeRegistrantBenefit('PERCENT_DISCOUNT', 50, null)).toContain('50% off');
    expect(describeRegistrantBenefit('FIXED_DISCOUNT', 25, null)).toContain('$25.00');
    expect(describeRegistrantBenefit('FREE_MONTHS', null, 1)).toContain('1 free month');
    expect(describeRegistrantBenefit('FREE_MONTHS', null, 3)).toContain('3 free months');
    expect(describeRegistrantBenefit('COMPLIMENTARY_ACCESS', null, 3)).toContain(
      'Complimentary access for 3 months',
    );
  });
});

describe('computeDiscountedInvoice', () => {
  it('PERCENT_DISCOUNT 50% of 99 -> discount 49.50 final 49.50', () => {
    const r = computeDiscountedInvoice(99, 'PERCENT_DISCOUNT', 50, null);
    expect(r.discountAmount).toBe(49.5);
    expect(r.finalAmount).toBe(49.5);
    expect(r.zeroDueToBenefit).toBe(false);
  });

  it('FIXED_DISCOUNT 25 off 99 -> 74', () => {
    const r = computeDiscountedInvoice(99, 'FIXED_DISCOUNT', 25, null);
    expect(r.discountAmount).toBe(25);
    expect(r.finalAmount).toBe(74);
  });

  it('FIXED_DISCOUNT 200 off 99 -> never negative, final 0', () => {
    const r = computeDiscountedInvoice(99, 'FIXED_DISCOUNT', 200, null);
    expect(r.discountAmount).toBe(99);
    expect(r.finalAmount).toBe(0);
    expect(r.zeroDueToBenefit).toBe(true);
  });

  it('FREE_MONTHS / COMPLIMENTARY -> final 0, zeroDueToBenefit true', () => {
    const fm = computeDiscountedInvoice(99, 'FREE_MONTHS', null, 1);
    expect(fm.finalAmount).toBe(0);
    expect(fm.zeroDueToBenefit).toBe(true);
    const comp = computeDiscountedInvoice(99, 'COMPLIMENTARY_ACCESS', null, 3);
    expect(comp.finalAmount).toBe(0);
    expect(comp.zeroDueToBenefit).toBe(true);
  });

  it('MANUAL_REVIEW leaves the invoice unchanged', () => {
    const r = computeDiscountedInvoice(99, 'MANUAL_REVIEW', null, null);
    expect(r.discountAmount).toBe(0);
    expect(r.finalAmount).toBe(99);
    expect(r.zeroDueToBenefit).toBe(false);
  });
});
