import { Prisma, SubscriptionInvoiceStatus, SubscriptionStatus, UserStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { createFygaroPaymentUrl } from '@/lib/billing/fygaro';
import {
  shouldGenerateFygaroPaymentLink,
  shouldGenerateSubscriptionInvoice,
} from '@/lib/billing/policy';
import { computeRenewedPeriodEnd } from '@/lib/billing/plan-rules';

export function createSubscriptionInvoiceNumber() {
  return `CRM-INV-${new Date().getUTCFullYear()}-${Math.floor(Math.random() * 1_000_000).toString().padStart(6, '0')}`;
}

export async function createInvoiceForSubscription(subscriptionId: string, dueDate: Date) {
  const subscription = await prisma.landlordSubscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true },
  });

  if (!subscription) throw new Error('Subscription not found.');
  if (!subscription.plan) {
    throw new Error('Subscription has no assigned plan; cannot create an invoice.');
  }

  if (!shouldGenerateSubscriptionInvoice(subscription)) {
    return null;
  }

  const amount = Number(subscription.plan.amount);
  if (!Number.isFinite(amount) || amount <= 0) {
    throw new Error('Assigned plan has an invalid amount; refusing to create an invoice.');
  }

  const currency = subscription.plan.currency;
  if (!currency || currency.trim().length === 0) {
    throw new Error('Assigned plan has no currency; refusing to create an invoice.');
  }

  const invoiceNumber = createSubscriptionInvoiceNumber();

  // Snapshot plan amount and currency into the invoice. Future plan price
  // changes must not retroactively affect already-issued invoices.
  const invoice = await prisma.subscriptionInvoice.create({
    data: {
      subscriptionId: subscription.id,
      landlordId: subscription.landlordId,
      invoiceNumber,
      fygaroCustomRef: invoiceNumber,
      amount: new Prisma.Decimal(amount),
      currency,
      dueDate,
      status: SubscriptionInvoiceStatus.OPEN,
    },
  });

  const fygaroPaymentUrl = shouldGenerateFygaroPaymentLink({
    subscription,
    amount,
    invoiceStatus: invoice.status,
  })
    ? createFygaroPaymentUrl(invoice)
    : null;

  return prisma.subscriptionInvoice.update({
    where: { id: invoice.id },
    data: { fygaroPaymentUrl },
  });
}

export async function markSubscriptionPaid(invoiceId: string, providerReference?: string | null, payload?: unknown) {
  const invoice = await prisma.subscriptionInvoice.findUnique({
    where: { id: invoiceId },
    include: { subscription: { include: { plan: true } } },
  });
  if (!invoice) return null;
  const now = new Date();
  const subscription = invoice.subscription;
  const intervalMonths = subscription?.plan?.intervalMonths ?? 1;
  const currentPeriodEnd = subscription?.currentPeriodEnd ?? now;
  const newEnd = computeRenewedPeriodEnd(currentPeriodEnd, intervalMonths, now);
  await prisma.$transaction(async (tx) => {
    await tx.subscriptionInvoice.update({ where: { id: invoice.id }, data: { status: SubscriptionInvoiceStatus.PAID, paidAt: now, fygaroPaymentId: providerReference ?? undefined } });
    await tx.landlordSubscription.update({
      where: { id: invoice.subscriptionId },
      data: {
        status: SubscriptionStatus.ACTIVE,
        gracePeriodEndsAt: null,
        currentPeriodStart: now,
        currentPeriodEnd: newEnd,
        nextInvoiceAt: newEnd,
      },
    });
    const landlord = await tx.landlordProfile.findUnique({ where: { id: invoice.landlordId } });
    if (landlord) {
      const owner = await tx.user.update({ where: { id: landlord.ownerUserId }, data: { status: UserStatus.ACTIVE } });
      await tx.auditLog.create({
        data: {
          landlordId: invoice.landlordId,
          actorUserId: owner.id,
          actorEmail: owner.email,
          action: 'invoice_marked_paid',
          entityType: 'SubscriptionInvoice',
          entityId: invoice.id,
          details: { subscription_extended: true, newPeriodEnd: newEnd.toISOString() },
        },
      });
    }
    await tx.billingPaymentEvent.create({ data: { subscriptionInvoiceId: invoice.id, eventType: 'payment_confirmed', providerReference: providerReference ?? undefined, payload: payload as Prisma.JsonObject | undefined } });
  });
  return true;
}
