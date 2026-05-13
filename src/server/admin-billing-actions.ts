'use server';

import { revalidatePath } from 'next/cache';
import { Prisma, SubscriptionInvoiceStatus } from '@prisma/client';
import { requireSuperadmin } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { createFygaroPaymentUrl } from '@/lib/billing/fygaro';
import {
  createInvoiceForSubscription,
  markSubscriptionPaid,
} from '@/lib/billing/subscriptions';
import {
  isComplimentarySubscription,
  shouldGenerateFygaroPaymentLink,
} from '@/lib/billing/policy';

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

export async function createSubscriptionInvoiceAction(formData: FormData) {
  await requireSuperadmin();

  const subscriptionId = text(formData, 'subscriptionId');

  if (!subscriptionId) {
    throw new Error('Subscription ID is required.');
  }

  await createInvoiceForSubscription(subscriptionId, new Date());

  revalidatePath('/admin/billing');
}

export async function regenerateFygaroLinkAction(formData: FormData) {
  await requireSuperadmin();

  const invoiceId = text(formData, 'invoiceId');

  if (!invoiceId) {
    throw new Error('Invoice ID is required.');
  }

  const invoice = await prisma.subscriptionInvoice.findUnique({
    where: { id: invoiceId },
    include: { subscription: true },
  });

  if (!invoice) {
    throw new Error('Invoice not found.');
  }

  if (
    !shouldGenerateFygaroPaymentLink({
      subscription: invoice.subscription,
      amount: Number(invoice.amount),
      invoiceStatus: invoice.status,
    })
  ) {
    throw new Error('This invoice is not eligible for a Fygaro payment link.');
  }

  const fygaroPaymentUrl = createFygaroPaymentUrl(invoice);

  await prisma.subscriptionInvoice.update({
    where: { id: invoice.id },
    data: { fygaroPaymentUrl },
  });

  await prisma.billingPaymentEvent.create({
    data: {
      subscriptionInvoiceId: invoice.id,
      eventType: 'fygaro_link_regenerated',
      provider: 'FYGARO',
      payload: {
        regeneratedBy: 'SUPERADMIN',
      } as Prisma.JsonObject,
    },
  });

  revalidatePath('/admin/billing');
}

export async function markSubscriptionInvoicePaidAction(formData: FormData) {
  await requireSuperadmin();

  const invoiceId = text(formData, 'invoiceId');

  if (!invoiceId) {
    throw new Error('Invoice ID is required.');
  }

  await markSubscriptionPaid(invoiceId, 'manual-superadmin', {
    source: 'admin_billing_dashboard',
  });

  revalidatePath('/admin/billing');
}

export async function waiveSubscriptionInvoiceAction(formData: FormData) {
  await requireSuperadmin();

  const invoiceId = text(formData, 'invoiceId');

  if (!invoiceId) {
    throw new Error('Invoice ID is required.');
  }

  const invoice = await prisma.subscriptionInvoice.findUnique({
    where: { id: invoiceId },
  });

  if (!invoice) {
    throw new Error('Invoice not found.');
  }

  await prisma.subscriptionInvoice.update({
    where: { id: invoice.id },
    data: {
      status: SubscriptionInvoiceStatus.WAIVED,
      waivedAt: new Date(),
      fygaroPaymentUrl: null,
    },
  });

  await prisma.billingPaymentEvent.create({
    data: {
      subscriptionInvoiceId: invoice.id,
      eventType: 'invoice_waived',
      provider: 'MANUAL',
      payload: {
        waivedBy: 'SUPERADMIN',
      } as Prisma.JsonObject,
    },
  });

  revalidatePath('/admin/billing');
}

export async function convertSubscriptionToPaidAction(formData: FormData) {
  await requireSuperadmin();

  const subscriptionId = text(formData, 'subscriptionId');

  if (!subscriptionId) {
    throw new Error('Subscription ID is required.');
  }

  const subscription = await prisma.landlordSubscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    throw new Error('Subscription not found.');
  }

  await prisma.landlordSubscription.update({
    where: { id: subscription.id },
    data: {
      isComplimentary: false,
      complimentarySeats: 0,
      complimentaryReason: null,
      complimentaryUntil: null,
      complimentaryByUserId: null,
      status: 'ACTIVE',
      nextInvoiceAt: new Date(),
    },
  });

  revalidatePath('/admin/billing');
}

export async function extendSubscriptionAction(formData: FormData) {
  await requireSuperadmin();

  const subscriptionId = text(formData, 'subscriptionId');
  const days = Math.max(1, Number(text(formData, 'days') || 30));

  if (!subscriptionId) {
    throw new Error('Subscription ID is required.');
  }

  const subscription = await prisma.landlordSubscription.findUnique({
    where: { id: subscriptionId },
  });

  if (!subscription) {
    throw new Error('Subscription not found.');
  }

  const base = subscription.currentPeriodEnd > new Date()
    ? subscription.currentPeriodEnd
    : new Date();

  await prisma.landlordSubscription.update({
    where: { id: subscription.id },
    data: {
      currentPeriodEnd: new Date(base.getTime() + days * 86_400_000),
      nextInvoiceAt: isComplimentarySubscription(subscription)
        ? null
        : new Date(base.getTime() + days * 86_400_000),
    },
  });

  revalidatePath('/admin/billing');
}
