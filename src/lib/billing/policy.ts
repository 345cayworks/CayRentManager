import { SubscriptionInvoiceStatus, SubscriptionStatus } from '@prisma/client';

export type BillingSubscriptionPolicyInput = {
  status: SubscriptionStatus;
  isComplimentary?: boolean | null;
  complimentaryUntil?: Date | string | null;
};

const BILLING_ACCESS_STATUSES: ReadonlySet<SubscriptionStatus> = new Set([
  SubscriptionStatus.ACTIVE,
  SubscriptionStatus.TRIAL,
  SubscriptionStatus.GRACE_PERIOD,
  SubscriptionStatus.MANUAL_OVERRIDE,
]);

const FYGARO_PAYABLE_INVOICE_STATUSES: ReadonlySet<SubscriptionInvoiceStatus> = new Set([
  SubscriptionInvoiceStatus.OPEN,
  SubscriptionInvoiceStatus.OVERDUE,
]);

function normalizeDate(value?: Date | string | null) {
  if (!value) return null;

  return value instanceof Date ? value : new Date(value);
}

export function isExpiredComplimentarySubscription(
  subscription: BillingSubscriptionPolicyInput
) {
  if (!subscription.isComplimentary) {
    return false;
  }

  const complimentaryUntil = normalizeDate(
    subscription.complimentaryUntil
  );

  if (!complimentaryUntil) {
    return false;
  }

  return complimentaryUntil.getTime() <= Date.now();
}

export function isComplimentarySubscription(
  subscription: BillingSubscriptionPolicyInput
) {
  if (subscription.status === SubscriptionStatus.COMPLIMENTARY) {
    return !isExpiredComplimentarySubscription(subscription);
  }

  if (!subscription.isComplimentary) {
    return false;
  }

  return !isExpiredComplimentarySubscription(subscription);
}

export function hasBillingAccess(
  subscription: BillingSubscriptionPolicyInput | null | undefined
) {
  if (!subscription) {
    return false;
  }

  if (isComplimentarySubscription(subscription)) {
    return true;
  }

  return BILLING_ACCESS_STATUSES.has(subscription.status);
}

export function shouldGenerateSubscriptionInvoice(
  subscription: BillingSubscriptionPolicyInput | null | undefined
) {
  if (!subscription) {
    return false;
  }

  return !isComplimentarySubscription(subscription);
}

export function shouldEnterGracePeriod(
  subscription: BillingSubscriptionPolicyInput | null | undefined
) {
  if (!subscription) {
    return false;
  }

  return !isComplimentarySubscription(subscription);
}

export function shouldGenerateFygaroPaymentLink(params: {
  subscription: BillingSubscriptionPolicyInput | null | undefined;
  amount: number;
  invoiceStatus: SubscriptionInvoiceStatus;
}) {
  const { subscription, amount, invoiceStatus } = params;

  if (!subscription) {
    return false;
  }

  if (isComplimentarySubscription(subscription)) {
    return false;
  }

  if (amount <= 0) {
    return false;
  }

  return FYGARO_PAYABLE_INVOICE_STATUSES.has(invoiceStatus);
}
