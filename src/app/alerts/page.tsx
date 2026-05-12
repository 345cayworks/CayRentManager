import Link from 'next/link';
import { prisma } from '@/lib/db/prisma';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import {
  dismissAlertAction,
  markAlertReviewedAction,
} from '@/server/alert-actions';

const severityStyles: Record<string, string> = {
  CRITICAL: 'border-red-200 bg-red-50 text-red-700',
  URGENT: 'border-orange-200 bg-orange-50 text-orange-700',
  WARNING: 'border-yellow-200 bg-yellow-50 text-yellow-700',
  INFO: 'border-blue-200 bg-blue-50 text-blue-700',
};

function formatDate(date?: Date | null) {
  if (!date) return '—';

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date);
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
      No {label.toLowerCase()} alerts.
    </div>
  );
}

async function AlertsSection({
  title,
  status,
}: {
  title: string;
  status: 'ACTIVE' | 'REVIEWED' | 'RESOLVED';
}) {
  const { landlordId } = await getCurrentLandlordWorkspace();

  const alerts = await prisma.leaseAlertSnapshot.findMany({
    where: {
      landlordId,
      status,
    },
    orderBy: [
      {
        severity: 'desc',
      },
      {
        lastSeenAt: 'desc',
      },
    ],
    take: status === 'ACTIVE' ? 50 : 20,
  });

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
          <p className="text-sm text-slate-500">
            {alerts.length} alert{alerts.length === 1 ? '' : 's'}
          </p>
        </div>
      </div>

      {alerts.length === 0 ? (
        <EmptyState label={title} />
      ) : (
        <div className="space-y-4">
          {alerts.map((alert) => (
            <div
              key={alert.id}
              className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full border px-3 py-1 text-xs font-semibold ${severityStyles[alert.severity] ?? severityStyles.INFO}`}
                    >
                      {alert.severity}
                    </span>

                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-medium text-slate-600">
                      {alert.type.replaceAll('_', ' ')}
                    </span>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">
                      {alert.title}
                    </h3>

                    <p className="mt-2 max-w-3xl text-sm text-slate-600">
                      {alert.description}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-4 text-xs text-slate-500">
                    <span>First Seen: {formatDate(alert.firstSeenAt)}</span>
                    <span>Last Seen: {formatDate(alert.lastSeenAt)}</span>
                    {alert.resolvedAt ? (
                      <span>Resolved: {formatDate(alert.resolvedAt)}</span>
                    ) : null}
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  {alert.leaseId ? (
                    <Link
                      href={`/leases/${alert.leaseId}`}
                      className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                    >
                      Open Lease
                    </Link>
                  ) : null}

                  {status === 'ACTIVE' ? (
                    <>
                      <form action={markAlertReviewedAction}>
                        <input type="hidden" name="alertId" value={alert.id} />

                        <button
                          type="submit"
                          className="rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800"
                        >
                          Mark Reviewed
                        </button>
                      </form>

                      <form action={dismissAlertAction}>
                        <input type="hidden" name="alertId" value={alert.id} />

                        <button
                          type="submit"
                          className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                        >
                          Dismiss
                        </button>
                      </form>
                    </>
                  ) : null}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default async function AlertsPage() {
  const { landlordId } = await getCurrentLandlordWorkspace();

  const [activeCount, reviewedCount, resolvedCount] = await Promise.all([
    prisma.leaseAlertSnapshot.count({
      where: {
        landlordId,
        status: 'ACTIVE',
      },
    }),
    prisma.leaseAlertSnapshot.count({
      where: {
        landlordId,
        status: 'REVIEWED',
      },
    }),
    prisma.leaseAlertSnapshot.count({
      where: {
        landlordId,
        status: 'RESOLVED',
      },
    }),
  ]);

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8 text-white shadow-xl">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.3em] text-cyan-300">
              Operations Center
            </p>

            <h1 className="mt-3 text-4xl font-black tracking-tight">
              Alert Center
            </h1>

            <p className="mt-4 max-w-2xl text-sm text-slate-300">
              Monitor lease expirations, renewal gaps, vacancies, compliance risks,
              and operational issues across your portfolio.
            </p>
          </div>

          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-wide text-slate-300">
                Active
              </p>
              <p className="mt-2 text-3xl font-black">{activeCount}</p>
            </div>

            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-wide text-slate-300">
                Reviewed
              </p>
              <p className="mt-2 text-3xl font-black">{reviewedCount}</p>
            </div>

            <div className="rounded-2xl bg-white/10 p-4 backdrop-blur">
              <p className="text-xs uppercase tracking-wide text-slate-300">
                Resolved
              </p>
              <p className="mt-2 text-3xl font-black">{resolvedCount}</p>
            </div>
          </div>
        </div>
      </section>

      <AlertsSection title="Active Alerts" status="ACTIVE" />

      <AlertsSection title="Reviewed Alerts" status="REVIEWED" />

      <AlertsSection title="Resolved Alerts" status="RESOLVED" />
    </div>
  );
}
