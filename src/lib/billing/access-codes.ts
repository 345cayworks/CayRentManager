/**
 * Pure access-code validation and benefit/discount math. No I/O, no Prisma.
 * Safe to unit-test in isolation. Money is rounded to 2 decimals and never negative.
 */

export type AccessCodeValidationInput = {
  now: Date;
  code: {
    status: string;
    startsAt: Date | null;
    expiresAt: Date | null;
    maxRedemptions: number | null;
    maxRedemptionsPerEmail: number;
    appliesToPlanId: string | null;
    isStackable: boolean;
    referrerUserId: string | null;
    referrerLandlordId: string | null;
    rewardType: string;
    rewardValue: unknown;
    rewardMonths: number | null;
  };
  totalRedemptions: number;
  emailRedemptions: number;
  selectedPlanId?: string | null;
  registrantUserId?: string | null;
  registrantLandlordId?: string | null;
  alreadyHasNonStackableCode?: boolean;
};

export type AccessCodeValidationResult =
  | { ok: true; preview: string }
  | { ok: false; reason: string };

function toNumber(value: unknown): number {
  if (value === null || value === undefined) return 0;
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
  if (typeof value === 'string') {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
  }
  // Prisma.Decimal-like objects expose toString().
  if (typeof value === 'object' && typeof (value as { toString?: unknown }).toString === 'function') {
    const n = Number((value as { toString(): string }).toString());
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
}

function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

function formatMoney(n: number): string {
  return `$${round2(Math.max(0, n)).toFixed(2)}`;
}

/**
 * Enforce: status ACTIVE; now within [startsAt,expiresAt]; totalRedemptions <
 * maxRedemptions (null = unlimited); emailRedemptions < maxRedemptionsPerEmail;
 * appliesToPlanId null or === selectedPlanId; self-referral blocked; non-stackable
 * conflict rejected.
 */
export function validateAccessCode(i: AccessCodeValidationInput): AccessCodeValidationResult {
  const { code, now } = i;

  if (code.status !== 'ACTIVE') {
    return { ok: false, reason: 'This code is not currently active.' };
  }
  if (code.startsAt && now.getTime() < code.startsAt.getTime()) {
    return { ok: false, reason: 'This code is not active yet.' };
  }
  if (code.expiresAt && now.getTime() > code.expiresAt.getTime()) {
    return { ok: false, reason: 'This code has expired.' };
  }
  if (
    code.maxRedemptions !== null &&
    code.maxRedemptions !== undefined &&
    i.totalRedemptions >= code.maxRedemptions
  ) {
    return { ok: false, reason: 'This code has reached its redemption limit.' };
  }
  if (i.emailRedemptions >= code.maxRedemptionsPerEmail) {
    return { ok: false, reason: 'You have already used this code.' };
  }
  if (
    code.appliesToPlanId !== null &&
    code.appliesToPlanId !== undefined &&
    i.selectedPlanId !== undefined &&
    i.selectedPlanId !== null &&
    code.appliesToPlanId !== i.selectedPlanId
  ) {
    return { ok: false, reason: 'This code does not apply to the selected plan.' };
  }
  if (
    code.referrerUserId &&
    i.registrantUserId &&
    code.referrerUserId === i.registrantUserId
  ) {
    return { ok: false, reason: 'You cannot redeem your own referral code.' };
  }
  if (
    code.referrerLandlordId &&
    i.registrantLandlordId &&
    code.referrerLandlordId === i.registrantLandlordId
  ) {
    return { ok: false, reason: 'You cannot redeem your own referral code.' };
  }
  if (!code.isStackable && i.alreadyHasNonStackableCode) {
    return { ok: false, reason: 'Another code is already applied and cannot be combined.' };
  }

  return {
    ok: true,
    preview: describeRegistrantBenefit(code.rewardType, code.rewardValue, code.rewardMonths),
  };
}

/**
 * Human-readable preview of the registrant benefit.
 */
export function describeRegistrantBenefit(
  rewardType: string,
  rewardValue: unknown,
  rewardMonths: number | null,
): string {
  const value = toNumber(rewardValue);
  const months = rewardMonths && rewardMonths > 0 ? Math.floor(rewardMonths) : 0;

  switch (rewardType) {
    case 'PERCENT_DISCOUNT':
      return `Code applied: ${round2(value)}% off your first month.`;
    case 'FIXED_DISCOUNT':
      return `Code applied: ${formatMoney(value)} off your first invoice.`;
    case 'FREE_MONTHS': {
      const m = months > 0 ? months : 1;
      return `Code applied: ${m} free ${m === 1 ? 'month' : 'months'}.`;
    }
    case 'COMPLIMENTARY_ACCESS':
      return months > 0
        ? `Code applied: Complimentary access for ${months} ${months === 1 ? 'month' : 'months'}.`
        : 'Code applied: Complimentary access.';
    case 'TRIAL_EXTENSION':
      return months > 0
        ? `Code applied: Trial extended by ${months} ${months === 1 ? 'month' : 'months'}.`
        : 'Code applied: Extended trial.';
    case 'ACCOUNT_CREDIT':
      return `Code applied: ${formatMoney(value)} account credit (applied by our team).`;
    case 'UNIT_LIMIT_BONUS':
      return 'Code applied: Bonus unit allowance.';
    case 'MANUAL_REVIEW':
      return 'Code applied: Our team will review and apply your benefit.';
    default:
      return 'Code applied.';
  }
}

/**
 * Pure invoice math.
 */
export function computeDiscountedInvoice(
  baseAmount: number,
  rewardType: string,
  rewardValue: unknown,
  rewardMonths: number | null,
): {
  originalAmount: number;
  discountAmount: number;
  finalAmount: number;
  zeroDueToBenefit: boolean;
} {
  const base = round2(Math.max(0, Number.isFinite(baseAmount) ? baseAmount : 0));
  const value = toNumber(rewardValue);
  void rewardMonths;

  if (rewardType === 'PERCENT_DISCOUNT') {
    const pct = Math.max(0, value);
    let discount = round2(base * (pct / 100));
    if (discount > base) discount = base;
    discount = Math.max(0, discount);
    const finalAmount = round2(Math.max(0, base - discount));
    return { originalAmount: base, discountAmount: discount, finalAmount, zeroDueToBenefit: finalAmount === 0 };
  }

  if (rewardType === 'FIXED_DISCOUNT') {
    const discount = round2(Math.max(0, Math.min(base, value)));
    const finalAmount = round2(Math.max(0, base - discount));
    return { originalAmount: base, discountAmount: discount, finalAmount, zeroDueToBenefit: finalAmount === 0 };
  }

  if (rewardType === 'FREE_MONTHS' || rewardType === 'COMPLIMENTARY_ACCESS') {
    return { originalAmount: base, discountAmount: base, finalAmount: 0, zeroDueToBenefit: true };
  }

  // TRIAL_EXTENSION, ACCOUNT_CREDIT, UNIT_LIMIT_BONUS, MANUAL_REVIEW: no invoice change.
  return { originalAmount: base, discountAmount: 0, finalAmount: base, zeroDueToBenefit: false };
}
