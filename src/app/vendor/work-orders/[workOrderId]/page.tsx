import Link from 'next/link';
import { notFound } from 'next/navigation';
import { WorkOrderStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { requireVendorUser } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import {
  vendorAcknowledgeWorkOrderAction,
  vendorAddCommentAction,
  vendorCompleteWorkOrderAction,
} from '@/server/actions';
import { formatSlaCountdown, getSlaStatus, type SlaStatus } from '@/lib/maintenance/sla';
import { getEffectiveTimezone } from '@/lib/time/effective';
import { formatDate, formatDateTime } from '@/lib/time/format';

export const dynamic = 'force-dynamic';

function badge(value: string) {
  return (
    <span className="inline-flex rounded-full border bg-slate-50 px-2 py-1 text-xs font-medium text-slate-700">
      {value.replaceAll('_', ' ')}
    </span>
  );
}

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

export default async function VendorWorkOrderDetail({ params }: { params: { workOrderId: string } }) {
  const { vendor } = await requireVendorUser();
  const tz = await getEffectiveTimezone();

  const workOrder = await prisma.maintenanceWorkOrder.findFirst({
    where: { id: params.workOrderId, vendorId: vendor.id },
    include: {
      maintenanceRequest: {
        include: {
          tenant: { select: { fullName: true } },
          property: { select: { name: true } },
          unit: { select: { unitName: true } },
          comments: { include: { author: { select: { name: true, email: true } } }, orderBy: { createdAt: 'asc' } },
        },
      },
    },
  });

  if (!workOrder) notFound();
  const request = workOrder.maintenanceRequest;

  return (
    <Shell title="Work Order">
      <div className="mb-4">
        <Link href="/vendor/dashboard" className="text-sm text-slate-600 hover:underline">
          ← Back to dashboard
        </Link>
      </div>

      <article className="rounded-xl bg-white border shadow-sm p-6 mb-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
          <div>
            <h3 className="text-xl font-semibold">{request.title}</h3>
            <p className="mt-1 text-sm text-slate-600">
              {request.tenant?.fullName ?? 'No tenant'} · {request.property.name}
              {request.unit ? ` / ${request.unit.unitName}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {badge(workOrder.status)}
            {badge(request.category)}
            {badge(request.priority)}
            {renderSlaBadge(request.slaDueAt, request.resolvedAt)}
          </div>
        </div>
        <p className="mt-5 whitespace-pre-line text-slate-700">{request.description}</p>
        <div className="mt-5 grid gap-3 text-sm text-slate-600 md:grid-cols-2">
          <div className="rounded-lg bg-slate-50 p-3">
            <span className="font-medium">Dispatched:</span> {formatDateTime(workOrder.dispatchedAt, tz)}
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <span className="font-medium">Started:</span> {formatDateTime(workOrder.startedAt, tz)}
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <span className="font-medium">Acknowledged:</span> {formatDateTime(workOrder.vendorAcknowledgedAt, tz)}
          </div>
          <div className="rounded-lg bg-slate-50 p-3">
            <span className="font-medium">Completed:</span> {formatDateTime(workOrder.completedAt, tz)}
          </div>
          {workOrder.scheduledDate ? (
            <div className="rounded-lg bg-slate-50 p-3">
              <span className="font-medium">Scheduled:</span> {formatDate(workOrder.scheduledDate, tz)}
            </div>
          ) : null}
          {workOrder.estimatedCost !== null && workOrder.estimatedCost !== undefined ? (
            <div className="rounded-lg bg-slate-50 p-3">
              <span className="font-medium">Estimated cost:</span> ${Number(workOrder.estimatedCost).toFixed(2)}
            </div>
          ) : null}
        </div>
        {workOrder.notes ? (
          <p className="mt-4 text-sm text-slate-700 whitespace-pre-line">
            <span className="font-medium">Notes:</span> {workOrder.notes}
          </p>
        ) : null}
        {workOrder.completionNotes ? (
          <p className="mt-2 text-sm text-slate-700 whitespace-pre-line">
            <span className="font-medium">Completion notes:</span> {workOrder.completionNotes}
          </p>
        ) : null}
      </article>

      {workOrder.status === WorkOrderStatus.OPEN || workOrder.status === WorkOrderStatus.DISPATCHED ? (
        <section className="rounded-xl bg-white border shadow-sm p-6 mb-6">
          <h3 className="font-semibold">Accept work order</h3>
          <p className="text-sm text-slate-500 mt-1">
            Acknowledging this work order will move it to <strong>In progress</strong> and notify the landlord.
          </p>
          <form action={vendorAcknowledgeWorkOrderAction} className="mt-4">
            <input type="hidden" name="workOrderId" value={workOrder.id} />
            <button className="rounded bg-brand-navy px-4 py-2 text-white">Accept work order</button>
          </form>
        </section>
      ) : null}

      {workOrder.status === WorkOrderStatus.IN_PROGRESS ? (
        <section className="rounded-xl bg-white border shadow-sm p-6 mb-6">
          <h3 className="font-semibold">Complete work order</h3>
          <form action={vendorCompleteWorkOrderAction} className="mt-4 grid gap-3">
            <input type="hidden" name="workOrderId" value={workOrder.id} />
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Actual cost (optional)</span>
              <input name="actualCost" type="number" step="0.01" className="rounded border px-3 py-2" />
            </label>
            <label className="grid gap-1 text-sm">
              <span className="text-slate-600">Completion notes</span>
              <textarea name="completionNotes" rows={3} className="rounded border px-3 py-2" />
            </label>
            <button className="rounded bg-emerald-700 px-4 py-2 text-white w-fit">Mark completed</button>
          </form>
        </section>
      ) : null}

      <section className="rounded-xl bg-white border shadow-sm p-6">
        <h3 className="font-semibold">Updates &amp; notes</h3>
        <div className="mt-4 space-y-3">
          {request.comments.length === 0 ? (
            <p className="text-sm text-slate-500">No updates yet.</p>
          ) : null}
          {request.comments.map((comment) => (
            <div key={comment.id} className="rounded-xl border bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3 text-xs text-slate-500">
                <span>{comment.author.name ?? comment.author.email}</span>
                <span>{formatDateTime(comment.createdAt, tz)}</span>
              </div>
              <p className="mt-2 whitespace-pre-line text-sm text-slate-700">{comment.message}</p>
            </div>
          ))}
        </div>
        <form action={vendorAddCommentAction} className="mt-5 grid gap-3">
          <input type="hidden" name="maintenanceRequestId" value={request.id} />
          <textarea required name="message" placeholder="Post an update" rows={3} className="rounded border px-3 py-2" />
          <button className="rounded bg-brand-navy px-4 py-2 text-white w-fit">Post update</button>
        </form>
      </section>
    </Shell>
  );
}
