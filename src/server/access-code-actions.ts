'use server';

import { revalidatePath } from 'next/cache';
import {
  Prisma,
  type AccessCodeRewardType,
  type AccessCodeType,
} from '@prisma/client';
import { requireSuperadmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import {
  applyReferrerRewardForRedemption,
  applyRegistrantBenefitForRedemption,
} from '@/lib/billing/access-code-apply';

const REVALIDATE = '/admin/growth';

const CODE_TYPES: AccessCodeType[] = ['PROMO', 'REFERRAL', 'PARTNER', 'INTERNAL', 'COMPLIMENTARY'];
const REWARD_TYPES: AccessCodeRewardType[] = [
  'PERCENT_DISCOUNT',
  'FIXED_DISCOUNT',
  'FREE_MONTHS',
  'TRIAL_EXTENSION',
  'COMPLIMENTARY_ACCESS',
  'ACCOUNT_CREDIT',
  'UNIT_LIMIT_BONUS',
  'MANUAL_REVIEW',
];

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function requiredText(formData: FormData, key: string, label: string) {
  const value = text(formData, key);
  if (!value) throw new Error(`${label} is required.`);
  return value;
}

function nullableText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value.length > 0 ? value : null;
}

function checkbox(formData: FormData, key: string) {
  return formData.get(key) === 'on';
}

function nullableInt(formData: FormData, key: string): number | null {
  const value = text(formData, key);
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${key} must be a non-negative number.`);
  return Math.floor(n);
}

function nullableDecimal(formData: FormData, key: string): Prisma.Decimal | null {
  const value = text(formData, key);
  if (!value) return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) throw new Error(`${key} must be a non-negative number.`);
  return new Prisma.Decimal(n);
}

function nullableDate(formData: FormData, key: string): Date | null {
  const value = text(formData, key);
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) throw new Error(`${key} is not a valid date.`);
  return parsed;
}

function asType(value: string): AccessCodeType {
  if (!CODE_TYPES.includes(value as AccessCodeType)) throw new Error('Invalid code type.');
  return value as AccessCodeType;
}

function asReward(value: string): AccessCodeRewardType {
  if (!REWARD_TYPES.includes(value as AccessCodeRewardType)) {
    throw new Error('Invalid reward type.');
  }
  return value as AccessCodeRewardType;
}

function asRewardOrNull(value: string | null): AccessCodeRewardType | null {
  if (!value) return null;
  return asReward(value);
}

async function audit(
  actorUserId: string,
  actorEmail: string,
  action: string,
  entityId: string,
  details: Prisma.InputJsonValue = {},
) {
  await prisma.auditLog.create({
    data: {
      actorUserId,
      actorEmail,
      action,
      entityType: 'AccessCode',
      entityId,
      landlordId: null,
      details,
    },
  });
}

/** Reject reward configs that cannot be acted on. */
function assertRewardConfig(
  rewardType: AccessCodeRewardType,
  rewardValue: Prisma.Decimal | null,
  rewardMonths: number | null,
) {
  if (
    (rewardType === 'PERCENT_DISCOUNT' || rewardType === 'FIXED_DISCOUNT' ||
      rewardType === 'ACCOUNT_CREDIT') &&
    (rewardValue === null || rewardValue.lessThanOrEqualTo(0))
  ) {
    throw new Error(`${rewardType} requires a positive reward value.`);
  }
  if (rewardType === 'PERCENT_DISCOUNT' && rewardValue && rewardValue.greaterThan(100)) {
    throw new Error('Percent discount cannot exceed 100.');
  }
  if (
    (rewardType === 'FREE_MONTHS' || rewardType === 'TRIAL_EXTENSION') &&
    (rewardMonths === null || rewardMonths <= 0)
  ) {
    throw new Error(`${rewardType} requires a positive months value.`);
  }
  if (rewardType === 'UNIT_LIMIT_BONUS') {
    // rewardUnitLimit is validated separately by the caller.
  }
}

export async function createAccessCodeAction(formData: FormData) {
  const actor = await requireSuperadmin();

  const code = requiredText(formData, 'code', 'Code').toUpperCase();
  const type = asType(requiredText(formData, 'type', 'Type'));
  const rewardType = asReward(requiredText(formData, 'rewardType', 'Reward type'));
  const rewardValue = nullableDecimal(formData, 'rewardValue');
  const rewardMonths = nullableInt(formData, 'rewardMonths');
  const rewardUnitLimit = nullableInt(formData, 'rewardUnitLimit');

  assertRewardConfig(rewardType, rewardValue, rewardMonths);
  if (rewardType === 'UNIT_LIMIT_BONUS' && (rewardUnitLimit === null || rewardUnitLimit <= 0)) {
    throw new Error('UNIT_LIMIT_BONUS requires a positive unit limit.');
  }

  const existing = await prisma.accessCode.findFirst({
    where: { code: { equals: code, mode: 'insensitive' } },
    select: { id: true },
  });
  if (existing) throw new Error('A code with that value already exists.');

  const referrerUserId = nullableText(formData, 'referrerUserId');
  const referrerLandlordId = nullableText(formData, 'referrerLandlordId');

  const created = await prisma.accessCode.create({
    data: {
      code,
      type,
      status: 'ACTIVE',
      description: nullableText(formData, 'description'),
      campaignName: nullableText(formData, 'campaignName'),
      startsAt: nullableDate(formData, 'startsAt'),
      expiresAt: nullableDate(formData, 'expiresAt'),
      maxRedemptions: nullableInt(formData, 'maxRedemptions'),
      maxRedemptionsPerEmail: nullableInt(formData, 'maxRedemptionsPerEmail') ?? 1,
      rewardType,
      rewardValue,
      rewardMonths,
      rewardUnitLimit,
      appliesToPlanId: nullableText(formData, 'appliesToPlanId'),
      isStackable: checkbox(formData, 'isStackable'),
      referrerUserId,
      referrerLandlordId,
      registrantBenefitDescription: nullableText(formData, 'registrantBenefitDescription'),
      referrerRewardType: asRewardOrNull(nullableText(formData, 'referrerRewardType')),
      referrerRewardValue: nullableDecimal(formData, 'referrerRewardValue'),
      referrerRewardMonths: nullableInt(formData, 'referrerRewardMonths'),
      createdByUserId: actor.userId,
    },
  });

  await audit(actor.userId, actor.email, 'access_code_created', created.id, {
    code,
    type,
    rewardType,
  });

  revalidatePath(REVALIDATE);
}

export async function updateAccessCodeAction(formData: FormData) {
  const actor = await requireSuperadmin();

  const id = requiredText(formData, 'accessCodeId', 'Access code id');
  const existing = await prisma.accessCode.findUnique({ where: { id } });
  if (!existing) throw new Error('Access code not found.');

  const rewardType = asReward(requiredText(formData, 'rewardType', 'Reward type'));
  const rewardValue = nullableDecimal(formData, 'rewardValue');
  const rewardMonths = nullableInt(formData, 'rewardMonths');
  const rewardUnitLimit = nullableInt(formData, 'rewardUnitLimit');
  assertRewardConfig(rewardType, rewardValue, rewardMonths);

  await prisma.accessCode.update({
    where: { id },
    data: {
      type: asType(requiredText(formData, 'type', 'Type')),
      description: nullableText(formData, 'description'),
      campaignName: nullableText(formData, 'campaignName'),
      startsAt: nullableDate(formData, 'startsAt'),
      expiresAt: nullableDate(formData, 'expiresAt'),
      maxRedemptions: nullableInt(formData, 'maxRedemptions'),
      maxRedemptionsPerEmail: nullableInt(formData, 'maxRedemptionsPerEmail') ?? 1,
      rewardType,
      rewardValue,
      rewardMonths,
      rewardUnitLimit,
      appliesToPlanId: nullableText(formData, 'appliesToPlanId'),
      isStackable: checkbox(formData, 'isStackable'),
      referrerUserId: nullableText(formData, 'referrerUserId'),
      referrerLandlordId: nullableText(formData, 'referrerLandlordId'),
      registrantBenefitDescription: nullableText(formData, 'registrantBenefitDescription'),
      referrerRewardType: asRewardOrNull(nullableText(formData, 'referrerRewardType')),
      referrerRewardValue: nullableDecimal(formData, 'referrerRewardValue'),
      referrerRewardMonths: nullableInt(formData, 'referrerRewardMonths'),
    },
  });

  await audit(actor.userId, actor.email, 'access_code_updated', id, { code: existing.code });
  revalidatePath(REVALIDATE);
}

export async function pauseAccessCodeAction(formData: FormData) {
  const actor = await requireSuperadmin();
  const id = requiredText(formData, 'accessCodeId', 'Access code id');
  const existing = await prisma.accessCode.findUnique({ where: { id } });
  if (!existing) throw new Error('Access code not found.');

  await prisma.accessCode.update({ where: { id }, data: { status: 'PAUSED' } });
  await audit(actor.userId, actor.email, 'access_code_paused', id, { code: existing.code });
  revalidatePath(REVALIDATE);
}

export async function archiveAccessCodeAction(formData: FormData) {
  const actor = await requireSuperadmin();
  const id = requiredText(formData, 'accessCodeId', 'Access code id');
  const existing = await prisma.accessCode.findUnique({ where: { id } });
  if (!existing) throw new Error('Access code not found.');

  await prisma.accessCode.update({ where: { id }, data: { status: 'ARCHIVED' } });
  await audit(actor.userId, actor.email, 'access_code_archived', id, { code: existing.code });
  revalidatePath(REVALIDATE);
}

export async function reactivateAccessCodeAction(formData: FormData) {
  const actor = await requireSuperadmin();
  const id = requiredText(formData, 'accessCodeId', 'Access code id');
  const existing = await prisma.accessCode.findUnique({ where: { id } });
  if (!existing) throw new Error('Access code not found.');

  const now = new Date();
  const expired = existing.expiresAt !== null && now.getTime() > existing.expiresAt.getTime();
  await prisma.accessCode.update({
    where: { id },
    data: { status: expired ? 'EXPIRED' : 'ACTIVE' },
  });
  await audit(actor.userId, actor.email, 'access_code_updated', id, {
    code: existing.code,
    reactivatedAs: expired ? 'EXPIRED' : 'ACTIVE',
  });
  revalidatePath(REVALIDATE);
}

type ResolvedTarget = {
  redemptionId: string;
  accessCode: Awaited<ReturnType<typeof prisma.accessCode.findUniqueOrThrow>>;
  redemption: Awaited<ReturnType<typeof prisma.accessCodeRedemption.findUniqueOrThrow>>;
  landlordId: string;
};

async function resolveRedemptionTarget(formData: FormData): Promise<ResolvedTarget> {
  const redemptionId = nullableText(formData, 'redemptionId');
  if (redemptionId) {
    const redemption = await prisma.accessCodeRedemption.findUnique({
      where: { id: redemptionId },
    });
    if (!redemption) throw new Error('Redemption not found.');
    const accessCode = await prisma.accessCode.findUnique({
      where: { id: redemption.accessCodeId },
    });
    if (!accessCode) throw new Error('Access code not found.');
    const landlordId = redemption.registrantLandlordId
      ?? nullableText(formData, 'landlordId');
    if (!landlordId) throw new Error('A landlord must be specified for this redemption.');
    return { redemptionId, accessCode, redemption, landlordId };
  }

  const code = requiredText(formData, 'code', 'Code').toUpperCase();
  const landlordId = requiredText(formData, 'landlordId', 'Landlord id');
  const accessCode = await prisma.accessCode.findFirst({
    where: { code: { equals: code, mode: 'insensitive' } },
  });
  if (!accessCode) throw new Error('Access code not found.');

  const landlord = await prisma.landlordProfile.findUnique({
    where: { id: landlordId },
    select: { email: true },
  });
  const created = await prisma.accessCodeRedemption.create({
    data: {
      accessCodeId: accessCode.id,
      code: accessCode.code,
      registrantEmail: (landlord?.email ?? `landlord:${landlordId}`).toLowerCase(),
      registrantLandlordId: landlordId,
      referrerUserId: accessCode.referrerUserId,
      referrerLandlordId: accessCode.referrerLandlordId,
      status: 'PENDING',
    },
  });
  return { redemptionId: created.id, accessCode, redemption: created, landlordId };
}

export async function applyAccessCodeToLandlordAction(formData: FormData) {
  const actor = await requireSuperadmin();
  const target = await resolveRedemptionTarget(formData);
  const { accessCode, landlordId } = target;

  // Hard self-referral block (also enforced inside the shared service).
  if (
    (accessCode.referrerLandlordId && accessCode.referrerLandlordId === landlordId)
  ) {
    throw new Error('Self-referral is not permitted.');
  }

  // Shared benefit core. `force` preserves the pre-refactor SuperAdmin
  // behaviour (the admin action never gated on redemption status).
  await applyRegistrantBenefitForRedemption(target.redemptionId, {
    appliedByUserId: actor.userId,
    landlordId,
    force: true,
  });

  await audit(actor.userId, actor.email, 'access_code_redeemed', accessCode.id, {
    code: accessCode.code,
    landlordId,
    rewardType: accessCode.rewardType,
  });
  revalidatePath(REVALIDATE);
}

export async function reverseRedemptionAction(formData: FormData) {
  const actor = await requireSuperadmin();
  const redemptionId = requiredText(formData, 'redemptionId', 'Redemption id');
  const redemption = await prisma.accessCodeRedemption.findUnique({
    where: { id: redemptionId },
  });
  if (!redemption) throw new Error('Redemption not found.');

  const now = new Date();
  const applied = (redemption.registrantBenefitApplied ?? {}) as Record<string, unknown>;
  const reverseNotes: string[] = [];

  if (applied.rewardType === 'COMPLIMENTARY_ACCESS' && redemption.subscriptionId) {
    await prisma.landlordSubscription.update({
      where: { id: redemption.subscriptionId },
      data: {
        isComplimentary: false,
        status: 'ACTIVE',
        complimentaryUntil: null,
        complimentaryReason: null,
      },
    });
    reverseNotes.push('Reverted complimentary access.');
  }

  if (
    (applied.rewardType === 'PERCENT_DISCOUNT' || applied.rewardType === 'FIXED_DISCOUNT') &&
    redemption.invoiceId
  ) {
    const invoice = await prisma.subscriptionInvoice.findUnique({
      where: { id: redemption.invoiceId },
    });
    if (invoice && invoice.status !== 'PAID') {
      await prisma.subscriptionInvoice.update({
        where: { id: invoice.id },
        data: {
          amount: invoice.originalAmount ?? invoice.amount,
          discountAmount: new Prisma.Decimal(0),
          discountCode: null,
          originalAmount: null,
          status: invoice.status === 'PAID_BY_PROMO' ? 'OPEN' : invoice.status,
        },
      });
      reverseNotes.push('Restored discounted invoice amount.');
    } else if (invoice && invoice.status === 'PAID') {
      reverseNotes.push('Invoice already paid — not clawed back.');
    }
  }

  await prisma.accessCodeRedemption.update({
    where: { id: redemptionId },
    data: {
      status: 'REVERSED',
      reversedAt: now,
      notes: [redemption.notes, ...reverseNotes].filter(Boolean).join(' '),
    },
  });

  await audit(actor.userId, actor.email, 'access_code_reversed', redemption.accessCodeId, {
    code: redemption.code,
    redemptionId,
  });
  revalidatePath(REVALIDATE);
}

export async function applyReferrerRewardAction(formData: FormData) {
  const actor = await requireSuperadmin();
  const redemptionId = requiredText(formData, 'redemptionId', 'Redemption id');
  const redemption = await prisma.accessCodeRedemption.findUnique({
    where: { id: redemptionId },
  });
  if (!redemption) throw new Error('Redemption not found.');
  if (!redemption.referrerUserId && !redemption.referrerLandlordId) {
    throw new Error('This redemption has no referrer.');
  }

  // Hard self-referral block (also enforced inside the shared service).
  if (
    (redemption.referrerLandlordId &&
      redemption.referrerLandlordId === redemption.registrantLandlordId) ||
    (redemption.referrerUserId &&
      redemption.referrerUserId === redemption.registrantUserId)
  ) {
    throw new Error('Self-referral is not permitted.');
  }

  await applyReferrerRewardForRedemption(redemptionId, {
    appliedByUserId: actor.userId,
  });

  await audit(actor.userId, actor.email, 'referral_reward_applied', redemption.accessCodeId, {
    code: redemption.code,
    redemptionId,
  });
  revalidatePath(REVALIDATE);
}
