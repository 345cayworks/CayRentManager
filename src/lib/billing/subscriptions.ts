import { Prisma, SubscriptionInvoiceStatus, SubscriptionStatus, UserStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { createFygaroPaymentUrl } from '@/lib/billing/fygaro';
import {
  shouldGenerateFygaroPaymentLink,
  shouldGenerateSubscriptionInvoice,
} from '@/lib/billing/policy';

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
  const invoice = await prisma.subscriptionInvoice.findUnique({ where: { id: invoiceId }, include: { subscription: true } });
  if (!invoice) return null;
  const now = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.subscriptionInvoice.update({ where: { id: invoice.id }, data: { status: SubscriptionInvoiceStatus.PAID, paidAt: now, fygaroPaymentId: providerReference ?? undefined } });
    await tx.landlordSubscription.update({
      where: { id: invoice.subscriptionId },
      data: {
        status: SubscriptionStatus.ACTIVE,
        gracePeriodEndsAt: null,
        currentPeriodStart: now,
        currentPeriodEnd: new Date(now.getTime() + 30 * 86_400_000),
        nextInvoiceAt: new Date(now.getTime() + 30 * 86_400_000),
      },
    });
    const landlord = await tx.landlordProfile.findUnique({ where: { id: invoice.landlordId } });
    if (landlord) {
      await tx.user.update({ where: { id: landlord.ownerUserId }, data: { status: UserStatus.ACTIVE } });
    }
    await tx.billingPaymentEvent.create({ data: { subscriptionInvoiceId: invoice.id, eventType: 'payment_confirmed', providerReference: providerReference ?? undefined, payload: payload as Prisma.JsonObject | undefined } });
  });
  return true;
}
