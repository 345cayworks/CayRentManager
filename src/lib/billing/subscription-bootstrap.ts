import { SubscriptionStatus } from '@prisma/client';
import type { Prisma, PrismaClient } from '@prisma/client';

const TRIAL_DAYS = 30;
const DEFAULT_PLAN_CODE = 'STARTER';

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

/**
 * Idempotent: create a TRIAL LandlordSubscription for a landlord that has none.
 *
 * Best-effort: if the default plan is missing or anything fails, return null
 * and DO NOT throw. Callers run in the auth path (login/signup) and a failure
 * here must never block user/landlord creation.
 *
 * Accepts either the root PrismaClient or a transaction client so it can be
 * called inside the landlord-creation `$transaction`.
 */
export async function ensureLandlordSubscription(
  db: PrismaClient | Prisma.TransactionClient,
  landlordId: string,
  now = new Date(),
): Promise<{ id: string } | null> {
  try {
    const existing = await db.landlordSubscription.findUnique({
      where: { landlordId },
      select: { id: true },
    });
    if (existing) return existing;

    const plan = await db.subscriptionPlan.findFirst({
      where: { code: DEFAULT_PLAN_CODE, status: 'ACTIVE' },
      select: { id: true },
    });
    if (!plan) return null;

    const trialEnd = addDays(now, TRIAL_DAYS);

    const created = await db.landlordSubscription.create({
      data: {
        landlordId,
        planId: plan.id,
        status: SubscriptionStatus.TRIAL,
        currentPeriodStart: now,
        currentPeriodEnd: trialEnd,
        trialStartsAt: now,
        trialEndsAt: trialEnd,
        nextInvoiceAt: trialEnd,
      },
      select: { id: true },
    });

    return created;
  } catch {
    // Auth-path safe: never throw out of the subscription bootstrap.
    return null;
  }
}
