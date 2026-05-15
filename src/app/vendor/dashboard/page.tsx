import Link from 'next/link';
import { WorkOrderStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { requireVendorUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { formatSlaCountdown, getSlaStatus, type SlaStatus } from '@/lib/maintenance/sla';
import { getEffectiveTimezone } from '@/lib/time/effective';
import { formatDate } from '@/lib/time/format';

export const dynamic = 'force-dynamic';

function slaBadge(status: SlaStatus, label: string) {
  const tones: Record<SlaStatus, string> = {
    ON_TRACK: 'bg-emerald-100 text-emerald-700',
    AT_RISK: 'bg-amber-100 text-amber-700',
    BREACHED: 'bg-red-100 text-red-700',
    MET: 'bg-slate-100 text-slate-600',
  };
  return (
    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-medium ${tones[status]}`}>{label}</span>
  );
}

function renderSlaBadge(slaDueAt: Date | null, resolvedAt: Date | null) {
  const status = getSlaStatus({ slaDueAt, resolvedAt });
  if (status === 'MET') return slaBadge(status, 'SLA met');
  if (status === 'BREACHED') return slaBadge(status, slaDueAt ? `SLA ${formatSlaCountdown(slaDueAt)}` : 'SLA breached');
  if (status === 'AT_RISK') return slaBadge(status, slaDueAt ? `At risk · ${formatSlaCountdown(slaDueAt)}` : 'At risk');
  return slaBadge(status, slaDueAt ? `On track · ${formatSlaCountdown(slaDueAt)}` : 'On track');
}

function statusBadge(status: WorkOrderStatus) {
  return (
    <span className="inline-flex rounded-full border bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700">
      {status.replaceAll('_', ' ')}
    </span>
  );
}

export default async function VendorDashboardPage({ searchParams }: { searchParams?: { tab?: string } }) {
  const { vendor } = await requireVendorUser();
  const tz = await getEffectiveTimezone();
  const activeTab = searchParams?.tab === 'completed' ? 'completed' : 'active';

  const [active, completed] = await Promise.all([
    prisma.maintenanceWorkOrder.findMany({
      where: {
        vendorId: vendor.id,
        status: { in: [WorkOrderStatus.OPEN, WorkOrderStatus.DISPATCHED, WorkOrderStatus.IN_PROGRESS] },
      },
      include: {
        maintenanceRequest: {
          select: {
            id: true,
            title: true,
            priority: true,
            slaDueAt: true,
            resolvedAt: true,
            property: { select: { name: true } },
            unit: { select: { unitName: true } },
          },
        },
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    }),
    prisma.maintenanceWorkOrder.findMany({
      where: { vendorId: vendor.id, status: WorkOrderStatus.COMPLETED },
      include: {
        maintenanceRequest: {
          select: { id: true, title: true, property: { select: { name: true } } },
        },
      },
      orderBy: { completedAt: 'desc' },
      take: 20,
    }),
  ]);

  const openCount = active.filter((wo) => wo.status === WorkOrderStatus.OPEN || wo.status === WorkOrderStatus.DISPATCHED).length;
  const inProgressCount = active.filter((wo) => wo.status === WorkOrderStatus.IN_PROGRESS).length;

  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  startOfMonth.setHours(0, 0, 0, 0);
  const completedThisMonth = completed.filter((wo) => wo.completedAt && wo.completedAt >= startOfMonth).length;

  return (
    <Shell title={`Welcome, ${vendor.name}`}>
      <div className="grid gap-4 md:grid-cols-3 mb-6">
        <div className="rounded-xl border bg-white shadow-sm p-4">
          <p className="text-sm text-slate-500">Open / dispatched</p>
          <p className="mt-2 text-2xl font-semibold">{openCount}</p>
        </div>
        <div className="rounded-xl border bg-white shadow-sm p-4">
          <p className="text-sm text-slate-500">In progress</p>
          <p className="mt-2 text-2xl font-semibold">{inProgressCount}</p>
        </div>
        <div className="rounded-xl border bg-white shadow-sm p-4">
          <p className="text-sm text-slate-500">Completed this month</p>
          <p className="mt-2 text-2xl font-semibold">{completedThisMonth}</p>
        </div>
      </div>

      <div className="flex gap-2 mb-4">
        <Link
          href="/vendor/dashboard"
          className={`rounded border px-4 py-2 text-sm ${activeTab === 'active' ? 'bg-brand-navy text-white' : 'hover:bg-slate-50'}`}
        >
          Active
        </Link>
        <Link
          href="/vendor/dashboard?tab=completed"
          className={`rounded border px-4 py-2 text-sm ${activeTab === 'completed' ? 'bg-brand-navy text-white' : 'hover:bg-slate-50'}`}
        >
          Completed
        </Link>
      </div>

      {activeTab === 'active' ? (
        <section className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          <header className="px-4 py-3 border-b bg-slate-50">
            <h3 className="font-semibold">Active work orders</h3>
          </header>
          <div className="divide-y divide-slate-100">
            {active.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">No active work orders.</p>
            ) : null}
            {active.map((wo) => (
              <div key={wo.id} className="px-4 py-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <Link className="font-medium text-brand-navy hover:underline" href={`/vendor/work-orders/${wo.id}`}>
                    {wo.maintenanceRequest.title}
                  </Link>
                  <p className="text-xs text-slate-500 mt-1">
                    {wo.maintenanceRequest.property.name}
                    {wo.maintenanceRequest.unit ? ` / ${wo.maintenanceRequest.unit.unitName}` : ''}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  {statusBadge(wo.status)}
                  {renderSlaBadge(wo.maintenanceRequest.slaDueAt, wo.maintenanceRequest.resolvedAt)}
                  <Link
                    href={`/vendor/work-orders/${wo.id}`}
                    className="rounded border px-3 py-1 text-xs font-medium hover:bg-slate-50"
                  >
                    Open
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <section className="rounded-2xl border bg-white shadow-sm overflow-hidden">
          <header className="px-4 py-3 border-b bg-slate-50">
            <h3 className="font-semibold">Completed work orders (last 20)</h3>
          </header>
          <div className="divide-y divide-slate-100">
            {completed.length === 0 ? (
              <p className="px-4 py-6 text-sm text-slate-500">No completed work orders yet.</p>
            ) : null}
            {completed.map((wo) => (
              <div key={wo.id} className="px-4 py-4 flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div>
                  <Link className="font-medium text-brand-navy hover:underline" href={`/vendor/work-orders/${wo.id}`}>
                    {wo.maintenanceRequest.title}
                  </Link>
                  <p className="text-xs text-slate-500 mt-1">{wo.maintenanceRequest.property.name}</p>
                </div>
                <div className="flex items-center gap-3 text-xs text-slate-500">
                  <span>Completed {formatDate(wo.completedAt, tz)}</span>
                  {statusBadge(wo.status)}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </Shell>
  );
}
