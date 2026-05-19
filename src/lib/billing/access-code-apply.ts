/**
 * Shared access-code benefit application service.
 *
 * Extracted from the Phase 2 SuperAdmin actions so the SAME benefit logic can
 * be reused by:
 *  - the SuperAdmin actions (manual apply / referrer reward), and
 *  - automatic capture-linking at landlord creation + referrer payout on the
 *    first paid invoice (Phase 3).
 *
 * The SuperAdmin path keeps its existing audits in `access-code-actions.ts`.
 * These functions never write `AccessCode` audits themselves so the admin
 * behaviour is unchanged; the Phase 3 auto callers write their own audits.
 */

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { computeRenewedPeriodEnd } from '@/lib/billing/plan-rules';
import { computeDiscountedInvoice } from '@/lib/billing/access-codes';

function addMonths(date: Date, months: number): Date {
  const d = new Date(date);
  d.setUTCMonth(d.getUTCMonth() + Math.max(0, Math.floor(months)));
  return d;
}

export type ApplyRegistrantOptions = {
  /** User id recorded in the benefit payload as the applier (defaults to 'system'). */
  appliedByUserId?: string | null;
  /** Override the landlord the benefit applies to (defaults to redemption's registrantLandlordId). */
  landlordId?: string | null;
  /**
   * When true, apply even if the redemption is not PENDING. Used by the
   * SuperAdmin manual action to preserve its pre-refactor behaviour
   * (it never gated on status). Auto callers leave this false for idempotency.
   */
  force?: boolean;
};

/**
 * Apply the registrant benefit for a single redemption and mark it APPLIED.
 *
 * Mirrors the Phase 2 `applyAccessCodeToLandlordAction` benefit core:
 * PERCENT/FIXED discount on an open invoice, FREE_MONTHS (extend + zero
 * PAID_BY_PROMO invoice), COMPLIMENTARY_ACCESS (set complimentary fields),
 * everything else is recorded as intent. Idempotent: a redemption that is no
 * longer PENDING is left untouched.
 */
export async function applyRegistrantBenefitForRedemption(
  redemptionId: string,
  options: ApplyRegistrantOptions = {},
): Promise<void> {
  const redemption = await prisma.accessCodeRedemption.findUnique({
    where: { id: redemptionId },
  });
  if (!redemption) throw new Error('Redemption not found.');
  if (!options.force && redemption.status !== 'PENDING') {
    // Idempotent: already applied / reversed / rejected.
    return;
  }

  const accessCode = await prisma.accessCode.findUnique({
    where: { id: redemption.accessCodeId },
  });
  if (!accessCode) throw new Error('Access code not found.');

  const landlordId = options.landlordId ?? redemption.registrantLandlordId;
  if (!landlordId) {
    throw new Error('A landlord must be specified for this redemption.');
  }

  // Hard self-referral block (matches Phase 2 semantics).
  if (accessCode.referrerLandlordId && accessCode.referrerLandlordId === landlordId) {
    throw new Error('Self-referral is not permitted.');
  }

  const subscription = await prisma.landlordSubscription.findUnique({
    where: { landlordId },
    include: { plan: true },
  });
  if (!subscription) {
    throw new Error('That landlord has no subscription. Code cannot be applied yet.');
  }

  const now = new Date();
  const benefit: Record<string, unknown> = {
    rewardType: accessCode.rewardType,
    code: accessCode.code,
    appliedBy: options.appliedByUserId ?? 'system',
    appliedAt: now.toISOString(),
  };
  let invoiceId: string | null = null;
  const notes: string[] = [];

  if (
    accessCode.rewardType === 'PERCENT_DISCOUNT' ||
    accessCode.rewardType === 'FIXED_DISCOUNT'
  ) {
    const invoice = await prisma.subscriptionInvoice.findFirst({
      where: {
        subscriptionId: subscription.id,
        status: { in: ['DRAFT', 'OPEN', 'SENT', 'OVERDUE', 'PENDING_VERIFICATION'] },
      },
      orderBy: { createdAt: 'desc' },
    });
    if (invoice) {
      const base = Number(invoice.amount);
      const math = computeDiscountedInvoice(
        base,
        accessCode.rewardType,
        accessCode.rewardValue,
        accessCode.rewardMonths,
      );
      await prisma.subscriptionInvoice.update({
        where: { id: invoice.id },
        data: {
          originalAmount: new Prisma.Decimal(math.originalAmount),
          discountAmount: new Prisma.Decimal(math.discountAmount),
          discountCode: accessCode.code,
          amount: new Prisma.Decimal(math.finalAmount),
          status: math.zeroDueToBenefit ? 'PAID_BY_PROMO' : invoice.status,
        },
      });
      invoiceId = invoice.id;
      benefit.discountAmount = math.discountAmount;
      benefit.finalAmount = math.finalAmount;
    } else {
      notes.push('Discount pending next invoice (no open invoice found).');
      benefit.pending = 'next-invoice';
    }
  } else if (accessCode.rewardType === 'FREE_MONTHS') {
    const months = accessCode.rewardMonths && accessCode.rewardMonths > 0
      ? accessCode.rewardMonths
      : 1;
    const newEnd = computeRenewedPeriodEnd(subscription.currentPeriodEnd, months, now);
    await prisma.landlordSubscription.update({
      where: { id: subscription.id },
      data: { currentPeriodEnd: newEnd, nextInvoiceAt: newEnd },
    });
    const promoInvoice = await prisma.subscriptionInvoice.create({
      data: {
        subscriptionId: subscription.id,
        landlordId,
        invoiceNumber: `PROMO-${accessCode.code}-${Date.now()}`,
        amount: new Prisma.Decimal(0),
        originalAmount: subscription.plan.amount,
        discountAmount: subscription.plan.amount,
        discountCode: accessCode.code,
        currency: subscription.plan.currency,
        status: 'PAID_BY_PROMO',
        dueDate: now,
        paidAt: now,
      },
    });
    invoiceId = promoInvoice.id;
    benefit.freeMonths = months;
    benefit.newPeriodEnd = newEnd.toISOString();
  } else if (accessCode.rewardType === 'COMPLIMENTARY_ACCESS') {
    const until = accessCode.rewardMonths && accessCode.rewardMonths > 0
      ? addMonths(now, accessCode.rewardMonths)
      : null;
    await prisma.landlordSubscription.update({
      where: { id: subscription.id },
      data: {
        isComplimentary: true,
        status: 'COMPLIMENTARY',
        complimentaryReason: `Access code: ${accessCode.code}`,
        complimentaryUntil: until,
        complimentaryByUserId: options.appliedByUserId ?? undefined,
      },
    });
    benefit.complimentaryUntil = until ? until.toISOString() : null;
  } else {
    // ACCOUNT_CREDIT / UNIT_LIMIT_BONUS / TRIAL_EXTENSION / MANUAL_REVIEW.
    notes.push(`${accessCode.rewardType}: recorded as intent (no destructive change).`);
    benefit.recordedIntent = true;
  }

  await prisma.accessCodeRedemption.update({
    where: { id: redemption.id },
    data: {
      status: 'APPLIED',
      appliedAt: now,
      registrantLandlordId: landlordId,
      subscriptionId: subscription.id,
      invoiceId,
      registrantBenefitApplied: benefit as Prisma.InputJsonValue,
      notes: notes.length ? notes.join(' ') : undefined,
    },
  });
}

export type ApplyReferrerOptions = {
  appliedByUserId?: string | null;
};

/**
 * Apply the referrer reward for a redemption. Mirrors Phase 2
 * `applyReferrerRewardAction`. Idempotent: if `referrerBenefitApplied` is
 * already set this is a no-op.
 */
export async function applyReferrerRewardForRedemption(
  redemptionId: string,
  options: ApplyReferrerOptions = {},
): Promise<void> {
  const redemption = await prisma.accessCodeRedemption.findUnique({
    where: { id: redemptionId },
  });
  if (!redemption) throw new Error('Redemption not found.');
  if (redemption.referrerBenefitApplied != null) {
    // Idempotent: referrer reward already applied.
    return;
  }
  if (!redemption.referrerUserId && !redemption.referrerLandlordId) {
    throw new Error('This redemption has no referrer.');
  }

  // Hard self-referral block.
  if (
    (redemption.referrerLandlordId &&
      redemption.referrerLandlordId === redemption.registrantLandlordId) ||
    (redemption.referrerUserId &&
      redemption.referrerUserId === redemption.registrantUserId)
  ) {
    throw new Error('Self-referral is not permitted.');
  }

  const accessCode = await prisma.accessCode.findUnique({
    where: { id: redemption.accessCodeId },
  });
  if (!accessCode) throw new Error('Access code not found.');

  const now = new Date();
  const referrerBenefit: Record<string, unknown> = {
    referrerRewardType: accessCode.referrerRewardType,
    appliedBy: options.appliedByUserId ?? 'system',
    appliedAt: now.toISOString(),
  };
  const notes: string[] = [];

  if (accessCode.referrerRewardType === 'FREE_MONTHS' && redemption.referrerLandlordId) {
    const sub = await prisma.landlordSubscription.findUnique({
      where: { landlordId: redemption.referrerLandlordId },
    });
    if (sub) {
      const months = accessCode.referrerRewardMonths && accessCode.referrerRewardMonths > 0
        ? accessCode.referrerRewardMonths
        : 1;
      const newEnd = computeRenewedPeriodEnd(sub.currentPeriodEnd, months, now);
      await prisma.landlordSubscription.update({
        where: { id: sub.id },
        data: { currentPeriodEnd: newEnd, nextInvoiceAt: newEnd },
      });
      referrerBenefit.freeMonths = months;
      referrerBenefit.newPeriodEnd = newEnd.toISOString();
    } else {
      notes.push('Referrer has no subscription — reward recorded as intent.');
    }
  } else {
    notes.push(
      `${accessCode.referrerRewardType ?? 'MANUAL_REVIEW'}: recorded as intent for manual handling.`,
    );
  }

  await prisma.accessCodeRedemption.update({
    where: { id: redemptionId },
    data: {
      referrerBenefitApplied: referrerBenefit as Prisma.InputJsonValue,
      notes: [redemption.notes, ...notes].filter(Boolean).join(' ') || undefined,
    },
  });
}

/**
 * Link captured PENDING redemptions to a freshly created landlord and apply
 * the registrant benefit for each. Best-effort PER redemption: one failure
 * must not block the others or the caller (auth path).
 */
export async function linkCapturedRedemptionsForLandlord(
  landlordId: string,
  email: string,
  userId: string,
): Promise<number> {
  const normalizedEmail = email.trim().toLowerCase();

  const pending = await prisma.accessCodeRedemption.findMany({
    where: {
      registrantEmail: normalizedEmail,
      status: 'PENDING',
      registrantUserId: null,
    },
    select: { id: true },
  });
  if (pending.length === 0) return 0;

  const subscription = await prisma.landlordSubscription.findUnique({
    where: { landlordId },
    select: { id: true },
  });

  let linked = 0;
  for (const { id } of pending) {
    try {
      await prisma.accessCodeRedemption.update({
        where: { id },
        data: {
          registrantUserId: userId,
          registrantLandlordId: landlordId,
          subscriptionId: subscription?.id ?? undefined,
        },
      });
      await applyRegistrantBenefitForRedemption(id, {
        appliedByUserId: userId,
        landlordId,
      });
      linked += 1;
    } catch {
      // Best-effort: skip this redemption, continue with the rest.
      continue;
    }
  }
  return linked;
}
