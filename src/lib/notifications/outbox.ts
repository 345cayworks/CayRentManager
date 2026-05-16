import { NotificationStatus } from '@prisma/client';
import { prisma } from '@/lib/db/prisma';

export type NotificationChannelName = 'EMAIL' | 'SMS' | 'WHATSAPP';

export type QueueNotificationInput = {
  landlordId?: string | null;
  recipientUserId?: string | null;
  recipientEmail: string;
  recipientPhone?: string | null;
  channel?: NotificationChannelName;
  notificationKind?: string;
  subject: string;
  body: string;
  bodyHtml?: string | null;
  relatedAlertKeys?: string[];
};

/**
 * Queue an outbound notification for any channel. The row is created in
 * PENDING status; a separate processor (or scheduled function) is responsible
 * for dispatching it via the configured per-channel provider. Keeping queue
 * and send separate means a partial provider outage never blocks application
 * code paths.
 */
export async function queueNotification(input: QueueNotificationInput) {
  return prisma.outboundNotification.create({
    data: {
      landlordId: input.landlordId ?? null,
      recipientUserId: input.recipientUserId ?? null,
      recipientEmail: input.recipientEmail,
      recipientPhone: input.recipientPhone ?? null,
      subject: input.subject,
      body: input.body,
      bodyHtml: input.bodyHtml ?? null,
      relatedAlertKeys: input.relatedAlertKeys ?? [],
      channel: input.channel ?? 'EMAIL',
      notificationKind: input.notificationKind ?? 'GENERAL',
      status: NotificationStatus.PENDING,
    },
  });
}

/**
 * Backwards-compatible email queue helper. Delegates to {@link queueNotification}
 * with the EMAIL channel. Existing callers (e.g. the daily digest) keep working
 * unchanged.
 */
export async function queueEmailNotification(input: QueueNotificationInput) {
  return queueNotification({
    ...input,
    channel: 'EMAIL',
    notificationKind: input.notificationKind ?? 'GENERAL',
  });
}

type SendOutcome =
  | { ok: true; provider: string; providerMessageId: string | null }
  | { ok: false; provider: string; reason: string };

type EnvLike = Record<string, string | undefined>;

/**
 * Pure, unit-testable provider selection per channel. Given an env-like map,
 * returns the provider name string the dispatcher will use. When the
 * configured provider has no credentials, falls back to `log` so deploy
 * environments without keys remain safe and observable.
 */
export function selectChannelProvider(
  channel: string,
  env: EnvLike,
): 'resend' | 'twilio' | 'log' {
  if (channel === 'EMAIL') {
    if (env.NOTIFICATION_PROVIDER === 'resend' && env.RESEND_API_KEY) {
      return 'resend';
    }
    return 'log';
  }
  if (channel === 'SMS') {
    if (
      env.SMS_PROVIDER === 'twilio' &&
      env.TWILIO_ACCOUNT_SID &&
      env.TWILIO_AUTH_TOKEN &&
      env.TWILIO_SMS_FROM
    ) {
      return 'twilio';
    }
    return 'log';
  }
  if (channel === 'WHATSAPP') {
    if (
      env.WHATSAPP_PROVIDER === 'twilio' &&
      env.TWILIO_ACCOUNT_SID &&
      env.TWILIO_AUTH_TOKEN &&
      env.TWILIO_WHATSAPP_FROM
    ) {
      return 'twilio';
    }
    return 'log';
  }
  return 'log';
}

/**
 * Email provider selection. Retained for backwards compatibility; delegates to
 * {@link selectChannelProvider} so EMAIL behaviour is unchanged.
 */
function selectedProvider(): 'resend' | 'log' {
  const provider = selectChannelProvider('EMAIL', process.env);
  return provider === 'resend' ? 'resend' : 'log';
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

async function sendViaTwilio(
  channel: 'SMS' | 'WHATSAPP',
  payload: { to: string; body: string },
): Promise<SendOutcome> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const rawFrom =
    channel === 'SMS'
      ? process.env.TWILIO_SMS_FROM
      : process.env.TWILIO_WHATSAPP_FROM;

  if (!sid || !token || !rawFrom) {
    return {
      ok: false,
      provider: 'twilio',
      reason: 'Twilio credentials or sender not configured.',
    };
  }

  const from = channel === 'WHATSAPP' ? `whatsapp:${rawFrom}` : rawFrom;
  const to = channel === 'WHATSAPP' ? `whatsapp:${payload.to}` : payload.to;

  try {
    const params = new URLSearchParams();
    params.set('To', to);
    params.set('From', from);
    params.set('Body', payload.body);

    const response = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(`${sid}:${token}`).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      },
    );

    if (!response.ok) {
      const errorText = await response.text();
      return {
        ok: false,
        provider: 'twilio',
        reason: `Twilio ${response.status}: ${errorText.slice(0, 240)}`,
      };
    }

    const data = (await response.json().catch(() => null)) as { sid?: string } | null;
    return { ok: true, provider: 'twilio', providerMessageId: data?.sid ?? null };
  } catch (error) {
    return {
      ok: false,
      provider: 'twilio',
      reason: error instanceof Error ? error.message : 'Unknown send error',
    };
  }
}

async function sendViaTwilioSms(payload: { to: string; body: string }) {
  return sendViaTwilio('SMS', payload);
}

async function sendViaTwilioWhatsApp(payload: { to: string; body: string }) {
  return sendViaTwilio('WHATSAPP', payload);
}

function sendViaLog(payload: {
  id: string;
  to: string;
  subject: string;
  channel: string;
}): SendOutcome {
  // eslint-disable-next-line no-console
  console.log(
    `[notification:log] id=${payload.id} channel=${payload.channel} to=${payload.to} subject=${JSON.stringify(payload.subject)}`,
  );
  return { ok: true, provider: 'log', providerMessageId: null };
}

function stripHtml(value: string): string {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Drain PENDING notifications from the outbox, dispatching each row via the
 * provider selected for its channel. Each row is marked SENT/FAILED with
 * provider metadata. EMAIL behaviour is identical to before; SMS/WHATSAPP rows
 * route to Twilio (or log) using the recipient phone and plaintext body.
 */
export async function processOutboundNotifications(options: { limit?: number } = {}) {
  const limit = options.limit ?? 50;
  const now = new Date();

  const pending = await prisma.outboundNotification.findMany({
    where: { status: NotificationStatus.PENDING },
    orderBy: { createdAt: 'asc' },
    take: limit,
  });

  let sent = 0;
  let failed = 0;

  for (const notification of pending) {
    const channel = notification.channel as NotificationChannelName;
    const provider = selectChannelProvider(channel, process.env);
    let outcome: SendOutcome;

    if (channel === 'SMS' || channel === 'WHATSAPP') {
      if (!notification.recipientPhone) {
        outcome = {
          ok: false,
          provider,
          reason: 'no recipient phone',
        };
      } else {
        const plain = stripHtml(notification.body);
        if (provider === 'twilio') {
          outcome =
            channel === 'SMS'
              ? await sendViaTwilioSms({ to: notification.recipientPhone, body: plain })
              : await sendViaTwilioWhatsApp({
                  to: notification.recipientPhone,
                  body: plain,
                });
        } else {
          outcome = sendViaLog({
            id: notification.id,
            to: notification.recipientPhone,
            subject: notification.subject,
            channel,
          });
        }
      }
    } else if (provider === 'resend') {
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
        channel,
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

  return { provider: selectedProvider(), processed: pending.length, sent, failed };
}
