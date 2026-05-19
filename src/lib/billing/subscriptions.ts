import { Prisma, SubscriptionInvoiceStatus, SubscriptionStatus, UserStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';
import { createFygaroPaymentUrl } from '@/lib/billing/fygaro';
import {
  shouldGenerateFygaroPaymentLink,
  shouldGenerateSubscriptionInvoice,
} from '@/lib/billing/policy';
import { computeRenewedPeriodEnd } from '@/lib/billing/plan-rules';
import { applyReferrerRewardForRedemption } from '@/lib/billing/access-code-apply';

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

/**
 * Pure idempotency decision: a payment must only be applied (subscription
 * extended) on the FIRST transition into PAID. If the invoice is already
 * PAID a duplicate/retried webhook is a no-op.
 */
export function isInvoiceAlreadyPaid(status: SubscriptionInvoiceStatus | string): boolean {
  return status === SubscriptionInvoiceStatus.PAID;
}

export async function markSubscriptionPaid(invoiceId: string, providerReference?: string | null, payload?: unknown) {
  const invoice = await prisma.subscriptionInvoice.findUnique({
    where: { id: invoiceId },
    include: { subscription: { include: { plan: true } } },
  });
  if (!invoice) return null;

  // Idempotency: a duplicate / retried Fygaro webhook must NOT re-extend the
  // subscription. If this invoice is already PAID, record a best-effort
  // duplicate event and return without mutating the subscription/user.
  if (isInvoiceAlreadyPaid(invoice.status)) {
    try {
      await prisma.billingPaymentEvent.create({
        data: {
          subscriptionInvoiceId: invoice.id,
          eventType: 'duplicate_webhook_ignored',
          providerReference: providerReference ?? undefined,
          payload: payload as Prisma.JsonObject | undefined,
        },
      });
    } catch {
      // Best-effort: never fail webhook handling on the duplicate-marker write.
    }
    return true;
  }

  const now = new Date();
  const subscription = invoice.subscription;
  const intervalMonths = subscription?.plan?.intervalMonths ?? 1;
  const currentPeriodEnd = subscription?.currentPeriodEnd ?? now;
  const newEnd = computeRenewedPeriodEnd(currentPeriodEnd, intervalMonths, now);
  let appliedAsFirstPayment = false;
  await prisma.$transaction(async (tx) => {
    // Conditional update guards against a concurrent webhook that already
    // flipped the invoice to PAID between our read above and this write.
    // count === 0 => another request won the race => idempotent no-op.
    const claimed = await tx.subscriptionInvoice.updateMany({
      where: { id: invoice.id, status: { not: SubscriptionInvoiceStatus.PAID } },
      data: { status: SubscriptionInvoiceStatus.PAID, paidAt: now, fygaroPaymentId: providerReference ?? undefined },
    });
    if (claimed.count === 0) {
      await tx.billingPaymentEvent.create({
        data: {
          subscriptionInvoiceId: invoice.id,
          eventType: 'duplicate_webhook_ignored',
          providerReference: providerReference ?? undefined,
          payload: payload as Prisma.JsonObject | undefined,
        },
      });
      return;
    }
    appliedAsFirstPayment = true;
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

  // Best-effort referrer payout on the FIRST paid invoice for this
  // subscription. Only when THIS call performed the genuine first PAID
  // transition (never on a duplicate/retried webhook). MUST NOT break
  // payment confirmation.
  if (appliedAsFirstPayment && invoice.subscriptionId) {
    try {
      const paidCount = await prisma.subscriptionInvoice.count({
        where: { subscriptionId: invoice.subscriptionId, status: SubscriptionInvoiceStatus.PAID },
      });
      if (paidCount === 1) {
        const redemption = await prisma.accessCodeRedemption.findFirst({
          where: {
            subscriptionId: invoice.subscriptionId,
            status: 'APPLIED',
            referrerUserId: { not: null },
            referrerBenefitApplied: { equals: Prisma.AnyNull },
          },
          orderBy: { createdAt: 'asc' },
        });
        if (redemption) {
          await applyReferrerRewardForRedemption(redemption.id);
          const landlord = await prisma.landlordProfile.findUnique({ where: { id: invoice.landlordId } });
          if (landlord) {
            const owner = await prisma.user.findUnique({ where: { id: landlord.ownerUserId } });
            if (owner) {
              await prisma.auditLog.create({
                data: {
                  landlordId: invoice.landlordId,
                  actorUserId: owner.id,
                  actorEmail: owner.email,
                  action: 'referral_reward_applied',
                  entityType: 'AccessCodeRedemption',
                  entityId: redemption.id,
                  details: { source: 'first_paid_invoice', invoiceId: invoice.id },
                },
              });
            }
          }
        }
      }
    } catch {
      // Swallow: payment confirmation must never fail due to referrer payout.
    }
  }

  return true;
}
