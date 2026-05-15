import { NotificationStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

export type QueueNotificationInput = {
  landlordId?: string | null;
  recipientUserId?: string | null;
  recipientEmail: string;
  subject: string;
  body: string;
  bodyHtml?: string | null;
  relatedAlertKeys?: string[];
};

/**
 * Queue an outbound email notification. The row is created in PENDING status;
 * a separate processor (or scheduled function) is responsible for dispatching
 * it via the configured provider. Keeping queue and send separate means that a
 * partial outage of the email provider never blocks application code paths.
 */
export async function queueEmailNotification(input: QueueNotificationInput) {
  return prisma.outboundNotification.create({
    data: {
      landlordId: input.landlordId ?? null,
      recipientUserId: input.recipientUserId ?? null,
      recipientEmail: input.recipientEmail,
      subject: input.subject,
      body: input.body,
      bodyHtml: input.bodyHtml ?? null,
      relatedAlertKeys: input.relatedAlertKeys ?? [],
      channel: 'EMAIL',
      status: NotificationStatus.PENDING,
    },
  });
}

type SendOutcome =
  | { ok: true; provider: string; providerMessageId: string | null }
  | { ok: false; provider: string; reason: string };

/**
 * Configured provider is selected by env. When the configured provider has
 * no credentials, falls back to `log-only` so deploy environments without
 * email keys remain safe and observable.
 */
function selectedProvider(): 'resend' | 'log' {
  if (process.env.NOTIFICATION_PROVIDER === 'resend' && process.env.RESEND_API_KEY) {
    return 'resend';
  }
  return 'log';
}

async function sendViaResend(payload: {
  to: string;
  subject: string;
  body: string;
  bodyHtml?: string | null;
}): Promise<SendOutcome> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATION_FROM_EMAIL;
  const fromName = process.env.NOTIFICATION_FROM_NAME ?? 'CayRentManager';

  if (!apiKey || !from) {
    return {
      ok: false,
      provider: 'resend',
      reason: 'RESEND_API_KEY or NOTIFICATION_FROM_EMAIL not configured.',
    };
  }

  try {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: `${fromName} <${from}>`,
        to: payload.to,
        subject: payload.subject,
        text: payload.body,
        ...(payload.bodyHtml ? { html: payload.bodyHtml } : {}),
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return {
        ok: false,
        provider: 'resend',
        reason: `Resend ${response.status}: ${errorText.slice(0, 240)}`,
      };
    }

    const data = (await response.json().catch(() => null)) as { id?: string } | null;
    return { ok: true, provider: 'resend', providerMessageId: data?.id ?? null };
  } catch (error) {
    return {
      ok: false,
      provider: 'resend',
      reason: error instanceof Error ? error.message : 'Unknown send error',
    };
  }
}

function sendViaLog(payload: {
  id: string;
  to: string;
  subject: string;
}): SendOutcome {
  // eslint-disable-next-line no-console
  console.log(
    `[notification:log] id=${payload.id} to=${payload.to} subject=${JSON.stringify(payload.subject)}`,
  );
  return { ok: true, provider: 'log', providerMessageId: null };
}

/**
 * Drain PENDING notifications from the outbox, attempting send via the
 * configured provider. Each row is marked SENT/FAILED with provider metadata.
 * Designed to be invoked from a scheduled function or on-demand admin tool.
 */
export async function processOutboundNotifications(options: { limit?: number } = {}) {
  const limit = options.limit ?? 50;
  const provider = selectedProvider();
  const now = new Date();

  const pending = await prisma.outboundNotification.findMany({
    where: { status: NotificationStatus.PENDING },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  let sent = 0;
  let failed = 0;

  for (const notification of pending) {
    let outcome: SendOutcome;
    if (provider === 'resend') {
      outcome = await sendViaResend({
        to: notification.recipientEmail,
        subject: notification.subject,
        body: notification.body,
        bodyHtml: notification.bodyHtml,
      });
    } else {
      outcome = sendViaLog({
        id: notification.id,
        to: notification.recipientEmail,
        subject: notification.subject,
      });
    }

    if (outcome.ok) {
      sent += 1;
      await prisma.outboundNotification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.SENT,
          provider: outcome.provider,
          providerMessageId: outcome.providerMessageId,
          attemptCount: notification.attemptCount + 1,
          sentAt: now,
          failureReason: null,
        },
      });
    } else {
      failed += 1;
      await prisma.outboundNotification.update({
        where: { id: notification.id },
        data: {
          status: NotificationStatus.FAILED,
          provider: outcome.provider,
          attemptCount: notification.attemptCount + 1,
          failureReason: outcome.reason,
        },
      });
    }
  }

  return { provider, processed: pending.length, sent, failed };
}
