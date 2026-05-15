import { LeaseAlertSnapshotStatus, RecordStatus, UserStatus } from '@prisma/client';
import { prisma } from '../../src/lib/db/prisma';
import { buildAlertDigest, type DigestAlert } from '../../src/lib/notifications/digest';
import { queueEmailNotification, processOutboundNotifications } from '../../src/lib/notifications/outbox';
import { resolvePreference } from '../../src/lib/notifications/preferences';

export const config = {
  // Daily at 07:00 UTC. Cayman is UTC-5 → roughly 02:00 local; tune later.
  schedule: '0 7 * * *',
};

export default async function alertDigestDaily() {
  try {
    const landlords = await prisma.landlordProfile.findMany({
      where: { status: RecordStatus.ACTIVE },
      select: { id: true, displayName: true },
    });

    const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? undefined;

    let workspacesProcessed = 0;
    let recipientsConsidered = 0;
    let digestsQueued = 0;
    let alertsTotal = 0;

    for (const landlord of landlords) {
      workspacesProcessed += 1;

      const [activeAlerts, memberships] = await Promise.all([
        prisma.leaseAlertSnapshot.findMany({
          where: {
            landlordId: landlord.id,
            status: LeaseAlertSnapshotStatus.ACTIVE,
          },
          select: {
            alertKey: true,
            type: true,
            severity: true,
            title: true,
            description: true,
            daysRemaining: true,
          },
        }),
        prisma.landlordMembership.findMany({
          where: {
            landlordId: landlord.id,
            status: RecordStatus.ACTIVE,
            user: {
              status: UserStatus.ACTIVE,
              email: { not: '' },
            },
          },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                alertPreferences: {
                  where: { landlordId: landlord.id },
                  take: 1,
                },
              },
            },
          },
        }),
      ]);

      alertsTotal += activeAlerts.length;
      if (activeAlerts.length === 0) continue;

      const digestAlerts: DigestAlert[] = activeAlerts.map((alert) => ({
        alertKey: alert.alertKey,
        type: alert.type,
        severity: alert.severity,
        title: alert.title,
        description: alert.description,
        daysRemaining: alert.daysRemaining ?? null,
      }));

      for (const membership of memberships) {
        recipientsConsidered += 1;
        const preference = resolvePreference(membership.user.alertPreferences[0] ?? null);
        if (!preference.digestEnabled) continue;
        if (!membership.user.email) continue;

        const digest = buildAlertDigest({
          workspaceName: landlord.displayName,
          alerts: digestAlerts,
          preference,
          appUrl,
        });

        if (digest.alertCount === 0) continue;

        await queueEmailNotification({
          landlordId: landlord.id,
          recipientUserId: membership.user.id,
          recipientEmail: membership.user.email,
          subject: digest.subject,
          body: digest.body,
          bodyHtml: digest.bodyHtml,
          relatedAlertKeys: digest.alertKeys,
        });

        digestsQueued += 1;
      }
    }

    const dispatchResult = await processOutboundNotifications({ limit: digestsQueued + 10 });

    return new Response(
      JSON.stringify({
        success: true,
        workspacesProcessed,
        alertsTotal,
        recipientsConsidered,
        digestsQueued,
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
    console.error('alert-digest-daily failed', error);
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
