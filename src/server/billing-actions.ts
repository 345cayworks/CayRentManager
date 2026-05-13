'use server';

import { revalidatePath } from 'next/cache';
import { Prisma, SubscriptionInvoiceStatus, SubscriptionStatus } from '@prisma/client';
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
  shouldGenerateSubscriptionInvoice,
} from '@/lib/billing/policy';

const THIRTY_DAYS_MS = 30 * 86_400_000;

const NON_INVOICEABLE_SUBSCRIPTION_STATUSES: ReadonlySet<SubscriptionStatus> = new Set([
  SubscriptionStatus.INACTIVE,
  SubscriptionStatus.CANCELLED,
]);

function text(formData: FormData, key: string) {
  return String(formData.get(key) ?? '').trim();
}

function nullableText(formData: FormData, key: string) {
  const value = text(formData, key);
  return value.length > 0 ? value : null;
}

function dateFromForm(formData: FormData, key: string) {
  const value = text(formData, key);
  if (!value) return null;

  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

async function logBillingAuditAction(params: {
  actorUserId: string;
  actorEmail: string;
  landlordId?: string | null;
  action: string;
  entityType: string;
  entityId: string;
  details?: Prisma.JsonObject;
}) {
  await prisma.auditLog.create({
    data: {
      landlordId: params.landlordId ?? null,
      actorUserId: params.actorUserId,
      actorEmail: params.actorEmail,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
      details: params.details ?? {},
    },
  });
}

async function getSubscriptionOrThrow(subscriptionId: string) {
  const subscription = await prisma.landlordSubscription.findUnique({
    where: { id: subscriptionId },
    include: { plan: true, landlord: true },
  });

  if (!subscription) {
    throw new Error('Subscription not found.');
  }

  return subscription;
}

async function getInvoiceOrThrow(invoiceId: string) {
  const invoice = await prisma.subscriptionInvoice.findUnique({
    where: { id: invoiceId },
    include: { subscription: { include: { plan: true, landlord: true } } },
  });

  if (!invoice) {
    throw new Error('Invoice not found.');
  }

  return invoice;
}

export async function createSubscriptionInvoiceAction(formData: FormData) {
  const actor = await requireSuperadmin();
  const subscriptionId = text(formData, 'subscriptionId');
  const subscription = await getSubscriptionOrThrow(subscriptionId);

  if (!shouldGenerateSubscriptionInvoice(subscription)) {
    throw new Error('Complimentary subscriptions cannot be invoiced.');
  }

  if (NON_INVOICEABLE_SUBSCRIPTION_STATUSES.has(subscription.status)) {
    throw new Error('Inactive or cancelled subscriptions cannot be invoiced.');
  }

  const invoice = await createInvoiceForSubscription(subscription.id, new Date());

  if (invoice) {
    await logBillingAuditAction({
      actorUserId: actor.userId,
      actorEmail: actor.email,
      landlordId: subscription.landlordId,
      action: 'billing.invoice_created',
      entityType: 'SubscriptionInvoice',
      entityId: invoice.id,
      details: {
        subscriptionId: subscription.id,
        invoiceNumber: invoice.invoiceNumber,
      },
    });
  }

  revalidatePath('/admin/billing');
}

export async function regenerateFygaroLinkAction(formData: FormData) {
  const actor = await requireSuperadmin();
  const invoiceId = text(formData, 'invoiceId');
  const invoice = await getInvoiceOrThrow(invoiceId);
  const amount = Number(invoice.amount);

  if (!shouldGenerateFygaroPaymentLink({
    subscription: invoice.subscription,
    amount,
    invoiceStatus: invoice.status,
  })) {
    throw new Error('This invoice is not eligible for a Fygaro payment link.');
  }

  const fygaroPaymentUrl = createFygaroPaymentUrl(invoice);

  await prisma.subscriptionInvoice.update({
    where: { id: invoice.id },
    data: { fygaroPaymentUrl },
  });

  await logBillingAuditAction({
    actorUserId: actor.userId,
    actorEmail: actor.email,
    landlordId: invoice.landlordId,
    action: 'billing.fygaro_link_regenerated',
    entityType: 'SubscriptionInvoice',
    entityId: invoice.id,
    details: {
      subscriptionId: invoice.subscriptionId,
      invoiceNumber: invoice.invoiceNumber,
    },
  });

  revalidatePath('/admin/billing');
}

export async function markInvoicePaidManuallyAction(formData: FormData) {
  const actor = await requireSuperadmin();
  const invoiceId = text(formData, 'invoiceId');
  const invoice = await getInvoiceOrThrow(invoiceId);

  if (invoice.status === SubscriptionInvoiceStatus.WAIVED) {
    throw new Error('Waived invoices cannot be marked paid.');
  }

  await markSubscriptionPaid(invoice.id, 'manual_admin_payment', {
    source: 'superadmin_billing_dashboard',
    actorUserId: actor.userId,
  });

  await logBillingAuditAction({
    actorUserId: actor.userId,
    actorEmail: actor.email,
    landlordId: invoice.landlordId,
    action: 'billing.invoice_paid_manually',
    entityType: 'SubscriptionInvoice',
    entityId: invoice.id,
    details: {
      subscriptionId: invoice.subscriptionId,
      invoiceNumber: invoice.invoiceNumber,
    },
  });

  revalidatePath('/admin/billing');
}

export async function waiveInvoiceAction(formData: FormData) {
  const actor = await requireSuperadmin();
  const invoiceId = text(formData, 'invoiceId');
  const invoice = await getInvoiceOrThrow(invoiceId);

  if (invoice.status === SubscriptionInvoiceStatus.PAID) {
    throw new Error('Paid invoices cannot be waived.');
  }

  await prisma.subscriptionInvoice.update({
    where: { id: invoice.id },
    data: {
      status: SubscriptionInvoiceStatus.WAIVED,
      waivedAt: new Date(),
      fygaroPaymentUrl: null,
    },
  });

  await logBillingAuditAction({
    actorUserId: actor.userId,
    actorEmail: actor.email,
    landlordId: invoice.landlordId,
    action: 'billing.invoice_waived',
    entityType: 'SubscriptionInvoice',
    entityId: invoice.id,
    details: {
      subscriptionId: invoice.subscriptionId,
      invoiceNumber: invoice.invoiceNumber,
    },
  });

  revalidatePath('/admin/billing');
}

export async function makeComplimentaryAction(formData: FormData) {
  const actor = await requireSuperadmin();
  const subscriptionId = text(formData, 'subscriptionId');
  const subscription = await getSubscriptionOrThrow(subscriptionId);
  const complimentaryReason = nullableText(formData, 'complimentaryReason') ?? 'SuperAdmin complimentary account';
  const complimentaryUntil = dateFromForm(formData, 'complimentaryUntil');

  if (isComplimentarySubscription(subscription)) {
    revalidatePath('/admin/billing');
    return;
  }

  await prisma.landlordSubscription.update({
    where: { id: subscription.id },
    data: {
      status: SubscriptionStatus.COMPLIMENTARY,
      isComplimentary: true,
      complimentaryReason,
      complimentaryUntil,
      complimentaryByUserId: actor.userId,
      gracePeriodEndsAt: null,
      nextInvoiceAt: null,
    },
  });

  await logBillingAuditAction({
    actorUserId: actor.userId,
    actorEmail: actor.email,
    landlordId: subscription.landlordId,
    action: 'billing.complimentary_granted',
    entityType: 'LandlordSubscription',
    entityId: subscription.id,
    details: {
      reason: complimentaryReason,
      complimentaryUntil: complimentaryUntil?.toISOString() ?? null,
    },
  });

  revalidatePath('/admin/billing');
}

export async function extendComplimentaryAction(formData: FormData) {
  const actor = await requireSuperadmin();
  const subscriptionId = text(formData, 'subscriptionId');
  const subscription = await getSubscriptionOrThrow(subscriptionId);
  const complimentaryUntil = dateFromForm(formData, 'complimentaryUntil');

  if (!complimentaryUntil) {
    throw new Error('Complimentary until date is required.');
  }

  await prisma.landlordSubscription.update({
    where: { id: subscription.id },
    data: {
      status: SubscriptionStatus.COMPLIMENTARY,
      isComplimentary: true,
      complimentaryUntil,
      complimentaryByUserId: actor.userId,
      gracePeriodEndsAt: null,
      nextInvoiceAt: null,
    },
  });

  await logBillingAuditAction({
    actorUserId: actor.userId,
    actorEmail: actor.email,
    landlordId: subscription.landlordId,
    action: 'billing.complimentary_extended',
    entityType: 'LandlordSubscription',
    entityId: subscription.id,
    details: {
      complimentaryUntil: complimentaryUntil.toISOString(),
    },
  });

  revalidatePath('/admin/billing');
}

export async function convertToPaidAction(formData: FormData) {
  const actor = await requireSuperadmin();
  const subscriptionId = text(formData, 'subscriptionId');
  const subscription = await getSubscriptionOrThrow(subscriptionId);
  const now = new Date();

  await prisma.landlordSubscription.update({
    where: { id: subscription.id },
    data: {
      status: SubscriptionStatus.ACTIVE,
      isComplimentary: false,
      complimentaryReason: null,
      complimentaryUntil: null,
      complimentaryByUserId: null,
      gracePeriodEndsAt: null,
      nextInvoiceAt: now,
    },
  });

  const invoice = await createInvoiceForSubscription(subscription.id, now);

  await logBillingAuditAction({
    actorUserId: actor.userId,
    actorEmail: actor.email,
    landlordId: subscription.landlordId,
    action: 'billing.converted_to_paid',
    entityType: 'LandlordSubscription',
    entityId: subscription.id,
    details: {
      invoiceId: invoice?.id ?? null,
      invoiceNumber: invoice?.invoiceNumber ?? null,
    },
  });

  revalidatePath('/admin/billing');
}

export async function extendSubscriptionAction(formData: FormData) {
  const actor = await requireSuperadmin();
  const subscriptionId = text(formData, 'subscriptionId');
  const subscription = await getSubscriptionOrThrow(subscriptionId);
  const days = Math.max(1, Number(text(formData, 'days') || 30));
  const currentEnd = subscription.currentPeriodEnd ?? new Date();
  const nextEnd = new Date(currentEnd.getTime() + days * 86_400_000);

  await prisma.landlordSubscription.update({
    where: { id: subscription.id },
    data: {
      currentPeriodEnd: nextEnd,
      nextInvoiceAt: isComplimentarySubscription(subscription)
        ? null
        : new Date(nextEnd.getTime()),
    },
  });

  await logBillingAuditAction({
    actorUserId: actor.userId,
    actorEmail: actor.email,
    landlordId: subscription.landlordId,
    action: 'billing.subscription_extended',
    entityType: 'LandlordSubscription',
    entityId: subscription.id,
    details: {
      days,
      currentPeriodEnd: nextEnd.toISOString(),
    },
  });

  revalidatePath('/admin/billing');
}
