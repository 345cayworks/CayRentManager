/**
 * Server-side access-code lookup + validation aggregation. Wraps the pure
 * validator with the DB reads it needs. Used by the public validate endpoint,
 * the redeem-intent capture, and superadmin actions.
 */

import { prisma } from '@/lib/db/prisma';
import { validateAccessCode, type AccessCodeValidationResult } from '@/lib/billing/access-codes';

const NON_COUNTING_STATUSES = ['REVERSED', 'REJECTED'] as const;

export async function lookupAndValidateAccessCode(args: {
  code: string;
  email: string;
  planCode?: string | null;
  now?: Date;
}): Promise<AccessCodeValidationResult> {
  const rawCode = (args.code ?? '').trim();
  const email = (args.email ?? '').trim().toLowerCase();
  if (!rawCode) return { ok: false, reason: 'Code not found.' };

  const accessCode = await prisma.accessCode.findFirst({
    where: { code: { equals: rawCode, mode: 'insensitive' } },
  });
  if (!accessCode) return { ok: false, reason: 'Code not found.' };

  const [totalRedemptions, emailRedemptions] = await Promise.all([
    prisma.accessCodeRedemption.count({
      where: { accessCodeId: accessCode.id, status: { notIn: [...NON_COUNTING_STATUSES] } },
    }),
    email
      ? prisma.accessCodeRedemption.count({
          where: {
            accessCodeId: accessCode.id,
            registrantEmail: email,
            status: { notIn: [...NON_COUNTING_STATUSES] },
          },
        })
      : Promise.resolve(0),
  ]);

  let selectedPlanId: string | null | undefined;
  if (args.planCode) {
    const plan = await prisma.subscriptionPlan.findUnique({
      where: { code: args.planCode },
      select: { id: true },
    });
    selectedPlanId = plan?.id ?? null;
  }

  return validateAccessCode({
    now: args.now ?? new Date(),
    code: {
      status: accessCode.status,
      startsAt: accessCode.startsAt,
      expiresAt: accessCode.expiresAt,
      maxRedemptions: accessCode.maxRedemptions,
      maxRedemptionsPerEmail: accessCode.maxRedemptionsPerEmail,
      appliesToPlanId: accessCode.appliesToPlanId,
      isStackable: accessCode.isStackable,
      referrerUserId: accessCode.referrerUserId,
      referrerLandlordId: accessCode.referrerLandlordId,
      rewardType: accessCode.rewardType,
      rewardValue: accessCode.rewardValue,
      rewardMonths: accessCode.rewardMonths,
    },
    totalRedemptions,
    emailRedemptions,
    selectedPlanId,
  });
}
