import { SubscriptionInvoiceStatus, SubscriptionStatus, UserStatus } from '@prisma/client';
import { prisma } from '../../src/lib/db/prisma';
import { createInvoiceForSubscription } from '../../src/lib/billing/subscriptions';

export default async () => {
  const now = new Date();
  const dueSubscriptions = await prisma.landlordSubscription.findMany({ where: { nextInvoiceAt: { lte: now }, status: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.PAST_DUE, SubscriptionStatus.GRACE_PERIOD] } } });
  for (const sub of dueSubscriptions) {
    await createInvoiceForSubscription(sub.id, new Date(now.getTime() + 7 * 86400000));
    await prisma.landlordSubscription.update({ where: { id: sub.id }, data: { nextInvoiceAt: new Date(now.getTime() + 30 * 86400000) } });
  }

  await prisma.subscriptionInvoice.updateMany({ where: { dueDate: { lt: now }, status: SubscriptionInvoiceStatus.OPEN }, data: { status: SubscriptionInvoiceStatus.OVERDUE } });
  const overdueSubs = await prisma.landlordSubscription.findMany({ include: { invoices: { where: { status: SubscriptionInvoiceStatus.OVERDUE }, orderBy: { dueDate: 'desc' }, take: 1 } } });
  for (const sub of overdueSubs) {
    const overdue = sub.invoices[0];
    if (!overdue) continue;
    const graceEnds = new Date(overdue.dueDate.getTime() + 3 * 86400000);
    if (graceEnds > now) {
      await prisma.landlordSubscription.update({ where: { id: sub.id }, data: { status: SubscriptionStatus.GRACE_PERIOD, gracePeriodEndsAt: graceEnds } });
    } else {
      await prisma.landlordSubscription.update({ where: { id: sub.id }, data: { status: SubscriptionStatus.INACTIVE } });
      const landlord = await prisma.landlordProfile.findUnique({ where: { id: sub.landlordId } });
      if (landlord) await prisma.user.update({ where: { id: landlord.ownerUserId }, data: { status: UserStatus.INACTIVE } });
    }
  }
  return new Response(JSON.stringify({ ok: true }));
};
