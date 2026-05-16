import Link from 'next/link';
import { LeaseStatus, PaymentStatus, RecordStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { buildLeaseAlertFeed, type LeaseAlertSeverity } from '@/lib/leases/lease-alerts';
import { createLeaseAction, expireLeaseAction, terminateLeaseAction } from '@/server/actions';
import { getEffectiveTimezone } from '@/lib/time/effective';
import { formatDate } from '@/lib/time/format';

export const dynamic = 'force-dynamic';

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function differenceInDays(dateLeft: Date, dateRight: Date) {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.ceil((dateLeft.getTime() - dateRight.getTime()) / msPerDay);
}

function statCard(label: string, value: number | string) {
  return (
    <div className="rounded-2xl border bg-white p-5 shadow-sm">
      <p className="text-sm text-slate-500">{label}</p>
      <p className="mt-2 text-3xl font-semibold">{value}</p>
    </div>
  );
}

function statusBadge(status: string) {
  const styles: Record<string, string> = {
    ACTIVE: 'bg-emerald-100 text-emerald-700',
    EXPIRED: 'bg-red-100 text-red-700',
    TERMINATED: 'bg-slate-200 text-slate-700',
    DRAFT: 'bg-amber-100 text-amber-700',
  };

  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${styles[status] ?? 'bg-slate-100 text-slate-700'}`}>
      {status}
    </span>
  );
}

function alertBadge(severity: LeaseAlertSeverity) {
  const styles: Record<LeaseAlertSeverity, string> = {
    CRITICAL: 'bg-red-100 text-red-700',
    URGENT: 'bg-orange-100 text-orange-700',
    WARNING: 'bg-amber-100 text-amber-700',
    INFO: 'bg-slate-100 text-slate-700',
  };

  return <span className={`inline-flex rounded-full px-3 py-1 text-xs font-medium ${styles[severity]}`}>{severity}</span>;
}

function severityCard(label: LeaseAlertSeverity, count: number) {
  const styles: Record<LeaseAlertSeverity, string> = {
    CRITICAL: 'border-red-200 bg-red-50 text-red-700',
    URGENT: 'border-orange-200 bg-orange-50 text-orange-700',
    WARNING: 'border-amber-200 bg-amber-50 text-amber-700',
    INFO: 'border-slate-200 bg-slate-50 text-slate-700',
  };

  return (
    <div className={`rounded-2xl border p-4 ${styles[label]}`}>
      <p className="text-xs font-semibold uppercase tracking-wide">{label}</p>
      <p className="mt-2 text-3xl font-black">{count}</p>
    </div>
  );
}

export default async function Page() {
  const { landlordId } = await getCurrentLandlordWorkspace();
  const tz = await getEffectiveTimezone();

  const now = new Date();
  const next60Days = addDays(now, 60);

  const [tenants, units, leases] = await Promise.all([
    prisma.tenant.findMany({
      where: { landlordId, status: RecordStatus.ACTIVE },
      orderBy: { fullName: 'asc' },
    }),
    prisma.unit.findMany({
      where: { landlordId, status: RecordStatus.ACTIVE },
      include: {
        property: true,
        leases: {
          where: {
            status: LeaseStatus.ACTIVE,
          },
        },
      },
      orderBy: { unitName: 'asc' },
    }),
    prisma.lease.findMany({
      where: { landlordId },
      include: {
        tenant: true,
        unit: true,
        property: true,
        renewals: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        notices: {
          orderBy: { noticeDate: 'desc' },
          take: 1,
        },
        payments: {
          where: { status: { not: PaymentStatus.VOID } },
          orderBy: { dueDate: 'desc' },
          take: 12,
        },
      },
      orderBy: { endDate: 'asc' },
    }),
  ]);

  const activeLeases = leases.filter((lease) => lease.status === LeaseStatus.ACTIVE);
  const expiringSoon = activeLeases.filter((lease) => lease.endDate <= next60Days);
  const expiredLeases = leases.filter((lease) => lease.status === LeaseStatus.EXPIRED);
  const vacantUnits = units.filter((unit) => unit.leases.length === 0);
  const occupiedUnits = units.filter((unit) => unit.leases.length > 0);
  const renewalPipeline = leases.filter((lease) => lease.renewals.length > 0);
  const alerts = buildLeaseAlertFeed({ leases, units, from: now, highBalanceThreshold: 1000 });
  const priorityAlerts = alerts.slice(0, 8);
  const criticalAlerts = alerts.filter((alert) => alert.severity === 'CRITICAL').length;
  const urgentAlerts = alerts.filter((alert) => alert.severity === 'URGENT').length;
  const warningAlerts = alerts.filter((alert) => alert.severity === 'WARNING').length;
  const infoAlerts = alerts.filter((alert) => alert.severity === 'INFO').length;

  return (
    <Shell title="Lease Operations">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-6">
        <div>
          <h2 className="text-3xl font-semibold">Lease Tracking & Alerts</h2>
          <p className="text-slate-600 mt-1">
            Monitor expirations, renewals, occupancy, and lease lifecycle activity.
          </p>
        </div>

        <div className="flex flex-wrap gap-3">
          <Link href="/alerts" className="rounded bg-brand-navy px-4 py-2 text-sm font-medium text-white hover:opacity-90">
            Open Alert Center
          </Link>
          <Link href="/app" className="rounded border px-4 py-2 text-sm font-medium hover:bg-slate-50">
            Back to dashboard
          </Link>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5 mb-8">
        {statCard('Active leases', activeLeases.length)}
        {statCard('Expiring in 60 days', expiringSoon.length)}
        {statCard('Renewal pipeline', renewalPipeline.length)}
        {statCard('Occupied units', occupiedUnits.length)}
        {statCard('Vacant units', vacantUnits.length)}
      </div>

      <div className="grid gap-4 md:grid-cols-4 mb-8">
        {severityCard('CRITICAL', criticalAlerts)}
        {severityCard('URGENT', urgentAlerts)}
        {severityCard('WARNING', warningAlerts)}
        {severityCard('INFO', infoAlerts)}
      </div>

      <section className="rounded-2xl border bg-white shadow-sm mb-8 overflow-hidden">
        <div className="border-b px-6 py-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="font-semibold text-lg">Operational Alerts</h3>
            <p className="text-sm text-slate-500 mt-1">Prioritized lease, renewal, notice, vacancy, and balance risks.</p>
          </div>
          <Link href="/alerts" className="text-sm font-medium text-brand-navy hover:underline">
            {alerts.length} active alert(s) · View all
          </Link>
        </div>

        <div className="divide-y">
          {priorityAlerts.length === 0 ? (
            <div className="p-6 text-sm text-slate-500">No operational lease alerts at this time.</div>
          ) : (
            priorityAlerts.map((alert, index) => (
              <div key={`${alert.type}-${alert.leaseId ?? alert.unitId ?? index}`} className="p-5 flex flex-col gap-3 md:flex-row md:items-start md:justify-between hover:bg-slate-50">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    {alertBadge(alert.severity)}
                    <p className="font-medium text-slate-900">{alert.title}</p>
                  </div>
                  <p className="mt-2 text-sm text-slate-600">{alert.description}</p>
                </div>
                {alert.leaseId ? (
                  <Link href={`/leases/${alert.leaseId}`} className="text-sm font-medium text-brand-navy hover:underline">
                    Open lease
                  </Link>
                ) : null}
              </div>
            ))
          )}
        </div>
      </section>

      <form action={createLeaseAction} className="grid md:grid-cols-6 gap-3 rounded-2xl bg-white border shadow-sm p-5 mb-8">
        <select required name="tenantId" className="border rounded px-3 py-2 md:col-span-2">
          <option value="">Tenant</option>
          {tenants.map((tenant) => (
            <option key={tenant.id} value={tenant.id}>
              {tenant.fullName}
            </option>
          ))}
        </select>

        <select required name="unitId" className="border rounded px-3 py-2 md:col-span-2">
          <option value="">Unit</option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.property.name} / {unit.unitName}
            </option>
          ))}
        </select>

        <input required name="startDate" type="date" className="border rounded px-3 py-2" />
        <input required name="endDate" type="date" className="border rounded px-3 py-2" />
        <input name="rentAmount" type="number" step="0.01" placeholder="Rent override" className="border rounded px-3 py-2" />
        <input name="depositAmount" type="number" step="0.01" placeholder="Deposit" className="border rounded px-3 py-2" />

        <button className="rounded bg-brand-navy text-white px-4 py-2 md:col-span-4">
          Create lease
        </button>
      </form>

      <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <section className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          <div className="border-b px-6 py-4">
            <h3 className="font-semibold text-lg">Upcoming Lease Expirations</h3>
            <p className="text-sm text-slate-500 mt-1">
              Leases requiring renewal attention or vacancy preparation.
            </p>
          </div>

          <div className="divide-y">
            {expiringSoon.length === 0 ? (
              <div className="p-8 text-center text-sm text-slate-500">
                No leases expiring within the next 60 days.
              </div>
            ) : (
              expiringSoon.map((lease) => {
                const daysLeft = differenceInDays(lease.endDate, now);

                return (
                  <div key={lease.id} className="p-5 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between hover:bg-slate-50">
                    <div>
                      <Link href={`/leases/${lease.id}`} className="font-medium text-brand-navy">
                        {lease.tenant.fullName} / {lease.property.name} / {lease.unit.unitName}
                      </Link>

                      <p className="text-sm text-slate-600 mt-1">
                        Ends {formatDate(lease.endDate, tz)}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                      <span className={`font-medium ${daysLeft <= 14 ? 'text-red-600' : 'text-amber-600'}`}>
                        {daysLeft} days left
                      </span>

                      {statusBadge(lease.status)}

                      {lease.status === LeaseStatus.ACTIVE ? (
                        <div className="flex gap-2">
                          <form action={terminateLeaseAction}>
                            <input type="hidden" name="leaseId" value={lease.id} />
                            <ConfirmButton message="Terminate this lease? This ends the active tenancy." className="text-sm rounded border px-3 py-1">Terminate</ConfirmButton>
                          </form>

                          <form action={expireLeaseAction}>
                            <input type="hidden" name="leaseId" value={lease.id} />
                            <button className="text-sm rounded border px-3 py-1">Expire</button>
                          </form>
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>

        <div className="space-y-6">
          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="font-semibold text-lg">Renewal Activity</h3>

            <div className="mt-4 space-y-3">
              {renewalPipeline.length === 0 ? (
                <p className="text-sm text-slate-500">No renewal activity yet.</p>
              ) : (
                renewalPipeline.slice(0, 6).map((lease) => {
                  const renewal = lease.renewals[0];

                  return (
                    <div key={lease.id} className="rounded-xl border bg-slate-50 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-medium text-slate-900">{lease.tenant.fullName}</p>
                          <p className="text-sm text-slate-500 mt-1">{lease.property.name}</p>
                        </div>

                        <span className="inline-flex rounded-full bg-cyan-100 px-3 py-1 text-xs font-medium text-cyan-700">
                          {renewal.status}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="font-semibold text-lg">Vacancy Pipeline</h3>

            <div className="mt-4 space-y-3">
              {vacantUnits.length === 0 ? (
                <p className="text-sm text-slate-500">No vacant units.</p>
              ) : (
                vacantUnits.map((unit) => (
                  <div key={unit.id} className="rounded-xl border bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{unit.unitName}</p>
                        <p className="text-sm text-slate-500 mt-1">
                          {unit.property.name}
                        </p>
                      </div>

                      <span className="inline-flex rounded-full bg-red-100 px-3 py-1 text-xs font-medium text-red-700">
                        Vacant
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section className="rounded-2xl border bg-white p-6 shadow-sm">
            <h3 className="font-semibold text-lg">Expired / Terminated</h3>

            <div className="mt-4 space-y-3">
              {expiredLeases.length === 0 ? (
                <p className="text-sm text-slate-500">No expired leases.</p>
              ) : (
                expiredLeases.slice(0, 5).map((lease) => (
                  <div key={lease.id} className="rounded-xl border bg-slate-50 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{lease.tenant.fullName}</p>
                        <p className="text-sm text-slate-500 mt-1">
                          {lease.property.name}
                        </p>
                      </div>

                      {statusBadge(lease.status)}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </Shell>
  );
}
