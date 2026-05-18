import { SubscriptionInvoiceStatus, SubscriptionStatus, UserStatus } from '@prisma/client';
import { prisma } from '../../src/lib/db/prisma';
import { createInvoiceForSubscription } from '../../src/lib/billing/subscriptions';

// Modern Netlify scheduled function. NOTE: scheduled functions only run on
// published production deploys (never on branch/deploy previews).
export const config = { schedule: '0 6 * * *' };

export default async () => {
  const now = new Date();

  // --- Pass 0: resume expired complimentary subscriptions ---------------
  // Runs before the invoice/overdue passes so a just-expired complimentary
  // subscription gets a fresh billing cycle this same run.
  const expiredComplimentary = await prisma.landlordSubscription.findMany({
    where: {
      isComplimentary: true,
      complimentaryUntil: { not: null, lte: now },
    },
  });
  for (const sub of expiredComplimentary) {
    try {
      await prisma.landlordSubscription.update({
        where: { id: sub.id },
        data: { isComplimentary: false, status: SubscriptionStatus.ACTIVE, nextInvoiceAt: now },
      });
      const landlord = await prisma.landlordProfile.findUnique({ where: { id: sub.landlordId } });
      if (landlord) {
        const owner = await prisma.user.findUnique({ where: { id: landlord.ownerUserId } });
        if (owner) {
          await prisma.auditLog.create({
            data: {
              landlordId: sub.landlordId,
              actorUserId: owner.id,
              actorEmail: owner.email,
              action: 'complimentary_access_expired',
              entityType: 'LandlordSubscription',
              entityId: sub.id,
              details: { resumedAt: now.toISOString() },
            },
          });
        }
      }
    } catch (err) {
      console.error(`billing-cron: failed to resume complimentary subscription ${sub.id}:`, err);
    }
  }

  // --- Pass 1: invoice subscriptions that are due -----------------------
  const dueSubscriptions = await prisma.landlordSubscription.findMany({
    where: {
      nextInvoiceAt: { lte: now },
      status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE, SubscriptionStatus.GRACE_PERIOD] },
    },
  });
  for (const sub of dueSubscriptions) {
    // Explicitly skip complimentary subscriptions: no invoice, no
    // nextInvoiceAt advance. (The status filter already excludes
    // COMPLIMENTARY status, but an isComplimentary=true with ACTIVE
    // status must also be skipped.)
    if (sub.isComplimentary || sub.status === SubscriptionStatus.COMPLIMENTARY) continue;
    try {
      await createInvoiceForSubscription(sub.id, new Date(now.getTime() + 7 * 86400000));
      await prisma.landlordSubscription.update({
        where: { id: sub.id },
        data: { nextInvoiceAt: new Date(now.getTime() + 30 * 86400000) },
      });
    } catch (err) {
      // One bad row (e.g. missing/invalid plan) must not abort the cron.
      console.error(`billing-cron: failed to invoice subscription ${sub.id}:`, err);
    }
  }

  // --- Pass 2: OPEN -> OVERDUE ------------------------------------------
  await prisma.subscriptionInvoice.updateMany({
    where: { dueDate: { lt: now }, status: SubscriptionInvoiceStatus.OPEN },
    data: { status: SubscriptionInvoiceStatus.OVERDUE },
  });

  // --- Pass 3: grace period -> inactive ---------------------------------
  const overdueSubs = await prisma.landlordSubscription.findMany({
    include: { invoices: { where: { status: SubscriptionInvoiceStatus.OVERDUE }, orderBy: { dueDate: 'desc' }, take: 1 } },
  });
  for (const sub of overdueSubs) {
    // Never escalate complimentary subscriptions.
    if (sub.isComplimentary || sub.status === SubscriptionStatus.COMPLIMENTARY) continue;
    const overdue = sub.invoices[0];
    if (!overdue) continue;
    try {
      const graceEnds = new Date(overdue.dueDate.getTime() + 3 * 86400000);
      if (graceEnds > now) {
        await prisma.landlordSubscription.update({
          where: { id: sub.id },
          data: { status: SubscriptionStatus.GRACE_PERIOD, gracePeriodEndsAt: graceEnds },
        });
      } else {
        await prisma.landlordSubscription.update({
          where: { id: sub.id },
          data: { status: SubscriptionStatus.INACTIVE },
        });
        const landlord = await prisma.landlordProfile.findUnique({ where: { id: sub.landlordId } });
        if (landlord) {
          const owner = await prisma.user.findUnique({ where: { id: landlord.ownerUserId } });
          // Never INACTIVE-lock a SuperAdmin user. The subscription may
          // still be marked INACTIVE, but the platform owner keeps access.
          if (owner && owner.role !== 'SUPERADMIN') {
            await prisma.user.update({ where: { id: owner.id }, data: { status: UserStatus.INACTIVE } });
          }
        }
      }
    } catch (err) {
      console.error(`billing-cron: failed to escalate subscription ${sub.id}:`, err);
    }
  }

  return new Response(JSON.stringify({ ok: true }));
};
