import { LeaseAlertSnapshotStatus, Prisma, RecordStatus } from '@prisma/client';
import { prisma } from '../../src/lib/db/prisma';
import {
  evaluateEscalation,
  resolveEscalationPolicy,
  selectEscalationRecipients,
  type EscalationPolicyShape,
} from '../../src/lib/notifications/escalation';
import { buildEscalationMessage } from '../../src/lib/notifications/escalation-message';
import {
  processOutboundNotifications,
  queueNotification,
} from '../../src/lib/notifications/outbox';
import { getEscalationDefaults, getPlatformSettings } from '../../src/lib/settings/platform';

export const config = {
  // Hourly. Escalation cadence is hour-grained, so a top-of-hour run suffices.
  schedule: '0 * * * *',
};

type ChannelName = 'EMAIL' | 'SMS' | 'WHATSAPP';

export default async function alertEscalationScan() {
  try {
    const landlords = await prisma.landlordProfile.findMany({
      where: { status: RecordStatus.ACTIVE },
      select: { id: true, displayName: true, timezone: true },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? undefined;
    const [platform, escalationDefaults] = await Promise.all([
      getPlatformSettings(),
      getEscalationDefaults(),
    ]);

    const now = new Date();
    let workspacesProcessed = 0;
    let alertsEvaluated = 0;
    let escalationsCreated = 0;
    let notificationsQueued = 0;

    for (const landlord of landlords) {
      workspacesProcessed += 1;

      const storedPolicy = await prisma.escalationPolicy.findUnique({
        where: { landlordId: landlord.id },
      });

      const policy: EscalationPolicyShape = resolveEscalationPolicy(
        storedPolicy
          ? {
              enabled: storedPolicy.enabled,
              minSeverity: storedPolicy.minSeverity,
              thresholdHours: storedPolicy.thresholdHours,
              repeatHours: storedPolicy.repeatHours,
              notifyRoles: storedPolicy.notifyRoles,
              channels: storedPolicy.channels,
            }
          : null,
        {
          enabled: escalationDefaults.enabled,
          minSeverity: escalationDefaults.minSeverity,
          thresholdHours: escalationDefaults.thresholdHours,
        },
      );

      if (!policy.enabled) continue;

      const [snapshots, memberships] = await Promise.all([
        prisma.leaseAlertSnapshot.findMany({
          where: {
            landlordId: landlord.id,
            status: LeaseAlertSnapshotStatus.ACTIVE,
            reviewedAt: null,
          },
          select: {
            alertKey: true,
            severity: true,
            title: true,
            description: true,
            daysRemaining: true,
            firstSeenAt: true,
          },
        }),
        prisma.landlordMembership.findMany({
          where: {
            landlordId: landlord.id,
            status: RecordStatus.ACTIVE,
          },
          include: {
            user: { select: { email: true, phone: true, status: true } },
          },
        }),
      ]);

      if (snapshots.length === 0) continue;

      const recipients = selectEscalationRecipients(
        memberships.map((m) => ({
          userId: m.userId,
          role: m.role,
          status: m.status,
          user: {
            email: m.user.email,
            phone: m.user.phone,
            status: m.user.status,
          },
        })),
        policy.notifyRoles,
      );

      if (recipients.length === 0) continue;

      const channels = policy.channels.filter(
        (c): c is ChannelName => c === 'EMAIL' || c === 'SMS' || c === 'WHATSAPP',
      );

      for (const snapshot of snapshots) {
        alertsEvaluated += 1;

        const highest = await prisma.alertEscalation.aggregate({
          where: { landlordId: landlord.id, alertKey: snapshot.alertKey },
          _max: { level: true },
        });
        const highestSentLevel = highest._max.level ?? 0;

        const decision = evaluateEscalation({
          severity: snapshot.severity,
          firstSeenAt: snapshot.firstSeenAt,
          now,
          policy,
          highestSentLevel,
        });

        if (!decision.escalate) continue;

        const message = buildEscalationMessage({
          workspaceName: landlord.displayName,
          alert: {
            title: snapshot.title,
            description: snapshot.description,
            severity: snapshot.severity,
            daysRemaining: snapshot.daysRemaining ?? null,
          },
          level: decision.level,
          appUrl,
          timezone: landlord.timezone || platform.timezone,
        });

        const notifiedUserIds: string[] = [];

        for (const recipient of recipients) {
          for (const channel of channels) {
            if ((channel === 'SMS' || channel === 'WHATSAPP') && !recipient.phone) {
              continue;
            }
            await queueNotification({
              landlordId: landlord.id,
              recipientUserId: recipient.userId,
              recipientEmail: recipient.email,
              recipientPhone: recipient.phone,
              channel,
              notificationKind: 'ESCALATION',
              subject: message.subject,
              body: message.body,
              bodyHtml: message.bodyHtml,
              relatedAlertKeys: [snapshot.alertKey],
            });
            notificationsQueued += 1;
          }
          notifiedUserIds.push(recipient.userId);
        }

        try {
          await prisma.alertEscalation.create({
            data: {
              landlordId: landlord.id,
              alertKey: snapshot.alertKey,
              level: decision.level,
              severity: snapshot.severity,
              notifiedUserIds,
              channels,
            },
          });
          escalationsCreated += 1;
        } catch (error) {
          // Unique violation = another concurrent run already recorded this
          // level; safe to skip.
          if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
          ) {
            continue;
          }
          throw error;
        }
      }
    }

    const dispatchResult = await processOutboundNotifications({
      limit: notificationsQueued + 10,
    });

    return new Response(
      JSON.stringify({
        success: true,
        workspacesProcessed,
        alertsEvaluated,
        escalationsCreated,
        notificationsQueued,
        provider: dispatchResult.provider,
        sent: dispatchResult.sent,
        failed: dispatchResult.failed,
        scannedAt: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  } catch (error) {
    console.error('alert-escalation-scan failed', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      },
    );
  }
}
