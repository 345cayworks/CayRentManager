import { describe, expect, it } from 'vitest';
import {
  billingEnforcementEnabled,
  shouldRedirectToBillingRequired,
} from '@/lib/billing/enforcement';

describe('billingEnforcementEnabled', () => {
  it("returns true only when the env var is exactly 'true'", () => {
    expect(billingEnforcementEnabled({ BILLING_ENFORCEMENT_ENABLED: 'true' })).toBe(true);
  });

  it('returns false when unset', () => {
    expect(billingEnforcementEnabled({})).toBe(false);
  });

  it("returns false for 'false'", () => {
    expect(billingEnforcementEnabled({ BILLING_ENFORCEMENT_ENABLED: 'false' })).toBe(false);
  });

  it("returns false for '1' (only the literal 'true' enables)", () => {
    expect(billingEnforcementEnabled({ BILLING_ENFORCEMENT_ENABLED: '1' })).toBe(false);
  });
});

describe('shouldRedirectToBillingRequired', () => {
  it('disabled -> never blocks, regardless of subscription', () => {
    expect(
      shouldRedirectToBillingRequired({ enabled: false, subscription: null }),
    ).toBe(false);
    expect(
      shouldRedirectToBillingRequired({
        enabled: false,
        subscription: { status: 'INACTIVE' },
      }),
    ).toBe(false);
  });

  it('enabled + no subscription -> not blocked', () => {
    expect(
      shouldRedirectToBillingRequired({ enabled: true, subscription: null }),
    ).toBe(false);
  });

  it('enabled + complimentary INACTIVE -> not blocked', () => {
    expect(
      shouldRedirectToBillingRequired({
        enabled: true,
        subscription: { status: 'INACTIVE', isComplimentary: true },
      }),
    ).toBe(false);
  });

  it('enabled + INACTIVE non-complimentary -> blocked', () => {
    expect(
      shouldRedirectToBillingRequired({
        enabled: true,
        subscription: { status: 'INACTIVE', isComplimentary: false },
      }),
    ).toBe(true);
    expect(
      shouldRedirectToBillingRequired({
        enabled: true,
        subscription: { status: 'INACTIVE' },
      }),
    ).toBe(true);
  });

  it('enabled + PAST_DUE -> not blocked (warning only)', () => {
    expect(
      shouldRedirectToBillingRequired({
        enabled: true,
        subscription: { status: 'PAST_DUE' },
      }),
    ).toBe(false);
  });

  it('enabled + GRACE_PERIOD -> not blocked (warning only)', () => {
    expect(
      shouldRedirectToBillingRequired({
        enabled: true,
        subscription: { status: 'GRACE_PERIOD' },
      }),
    ).toBe(false);
  });

  it('enabled + TRIAL -> not blocked', () => {
    expect(
      shouldRedirectToBillingRequired({
        enabled: true,
        subscription: { status: 'TRIAL' },
      }),
    ).toBe(false);
  });

  it('enabled + ACTIVE -> not blocked', () => {
    expect(
      shouldRedirectToBillingRequired({
        enabled: true,
        subscription: { status: 'ACTIVE' },
      }),
    ).toBe(false);
  });

  it('enabled + CANCELLED -> not blocked (only INACTIVE blocks)', () => {
    expect(
      shouldRedirectToBillingRequired({
        enabled: true,
        subscription: { status: 'CANCELLED' },
      }),
    ).toBe(false);
  });
});
