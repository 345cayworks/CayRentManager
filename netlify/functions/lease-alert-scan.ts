import { LeaseStatus, PaymentStatus } from '@prisma/client';
import { prisma } from '../../src/lib/db/prisma';
import { buildLeaseAlertFeed } from '../../src/lib/leases/lease-alerts';

export const config = {
  schedule: '0 */6 * * *',
};

function buildAlertKey(alert: {
  type: string;
  leaseId?: string;
  unitId?: string;
  propertyId?: string;
}) {
  return [alert.type, alert.leaseId ?? 'none', alert.unitId ?? 'none', alert.propertyId ?? 'none'].join(':');
}

export default async function leaseAlertScan() {
  try {
    const landlords = await prisma.landlordProfile.findMany({
      select: {
        id: true,
      },
    });

    let totalAlerts = 0;
    let totalResolved = 0;
    let totalLandlords = 0;

    for (const landlord of landlords) {
      totalLandlords += 1;

      const [leases, units] = await Promise.all([
        prisma.lease.findMany({
          where: {
            landlordId: landlord.id,
          },
          include: {
            tenant: true,
            property: true,
            unit: true,
            renewals: {
              orderBy: {
                createdAt: 'desc',
              },
              take: 1,
            },
            notices: {
              orderBy: {
                noticeDate: 'desc',
              },
              take: 1,
            },
            payments: {
              where: {
                status: {
                  not: PaymentStatus.VOID,
                },
              },
              orderBy: {
                dueDate: 'desc',
              },
              take: 12,
            },
          },
        }),
        prisma.unit.findMany({
          where: {
            landlordId: landlord.id,
          },
          include: {
            property: true,
            leases: {
              where: {
                status: LeaseStatus.ACTIVE,
              },
              select: {
                id: true,
                status: true,
              },
            },
          },
        }),
      ]);

      const alerts = buildLeaseAlertFeed({
        leases,
        units,
      });

      totalAlerts += alerts.length;

      const activeKeys = new Set<string>();

      for (const alert of alerts) {
        const alertKey = buildAlertKey(alert);
        activeKeys.add(alertKey);

        await prisma.leaseAlertSnapshot.upsert({
          where: {
            landlordId_alertKey: {
              landlordId: landlord.id,
              alertKey,
            },
          },
          create: {
            landlordId: landlord.id,
            alertKey,
            type: alert.type,
            severity: alert.severity,
            title: alert.title,
            description: alert.description,
            leaseId: alert.leaseId,
            tenantId: alert.tenantId,
            propertyId: alert.propertyId,
            unitId: alert.unitId,
            daysRemaining: alert.daysRemaining,
            amount: alert.amount,
            metadata: {
              generatedBy: 'lease-alert-scan',
            },
          },
          update: {
            severity: alert.severity,
            title: alert.title,
            description: alert.description,
            daysRemaining: alert.daysRemaining,
            amount: alert.amount,
            lastSeenAt: new Date(),
            status: 'ACTIVE',
            resolvedAt: null,
            dismissedAt: null,
          },
        });
      }

      const existingAlerts = await prisma.leaseAlertSnapshot.findMany({
        where: {
          landlordId: landlord.id,
          status: 'ACTIVE',
        },
        select: {
          id: true,
          alertKey: true,
        },
      });

      for (const snapshot of existingAlerts) {
        if (!activeKeys.has(snapshot.alertKey)) {
          totalResolved += 1;

          await prisma.leaseAlertSnapshot.update({
            where: {
              id: snapshot.id,
            },
            data: {
              status: 'RESOLVED',
              resolvedAt: new Date(),
            },
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        landlordsProcessed: totalLandlords,
        activeAlerts: totalAlerts,
        resolvedAlerts: totalResolved,
        scannedAt: new Date().toISOString(),
      }),
      {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  } catch (error) {
    console.error('lease-alert-scan failed', error);

    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
        },
      },
    );
  }
}
