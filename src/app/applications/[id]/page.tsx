import Link from 'next/link';
import { notFound } from 'next/navigation';
import { TenantApplicationStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { CopyInviteLinkButton } from '@/components/copy-invite-link';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { getEffectiveTimezone } from '@/lib/time/effective';
import { formatDate } from '@/lib/time/format';
import {
  canDecide,
  nextStatuses,
  type AppStatus,
} from '@/lib/applications/application-rules';
import {
  decideApplicationAction,
  withdrawApplicationAction,
} from '@/server/application-actions';

export const dynamic = 'force-dynamic';

function humanize(status: string) {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function Row({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex justify-between gap-4 py-2 text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="text-right font-medium text-slate-800">
        {value && value.trim() ? value : '—'}
      </span>
    </div>
  );
}

export default async function Page({ params }: { params: { id: string } }) {
  const { landlordId } = await getCurrentLandlordWorkspace();
  const tz = await getEffectiveTimezone();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '');

  const application = await prisma.tenantApplication.findFirst({
    where: { id: params.id, landlordId },
    include: {
      property: { select: { name: true } },
      unit: { select: { unitName: true, property: { select: { name: true } } } },
    },
  });

  if (!application) notFound();

  const status = application.status as AppStatus;
  const allowed = nextStatuses(status);
  const decidable = canDecide(status);

  const location = application.unit
    ? `${application.unit.property.name} / ${application.unit.unitName}`
    : application.property
      ? application.property.name
      : 'Unassigned';

  let inviteUrl: string | null = null;
  if (application.createdInvitationId) {
    const invitation = await prisma.tenantInvitation.findUnique({
      where: { id: application.createdInvitationId },
      select: { inviteToken: true },
    });
    if (invitation) {
      const invitePath = `/invite/${invitation.inviteToken}`;
      inviteUrl = appUrl ? `${appUrl}${invitePath}` : invitePath;
    }
  }

  return (
    <Shell title="Application">
      <Link
        href="/applications"
        className="text-sm text-slate-600 hover:text-slate-900"
      >
        ← Back to applications
      </Link>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl bg-white border shadow-sm p-4">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-lg font-semibold">{application.applicantName}</p>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
              {humanize(application.status)}
            </span>
          </div>
          <div className="divide-y">
            <Row label="Email" value={application.email} />
            <Row label="Phone" value={application.phone} />
            <Row label="Property / unit" value={location} />
            <Row label="Current address" value={application.currentAddress} />
            <Row label="Employer" value={application.employer} />
            <Row
              label="Monthly income"
              value={
                application.monthlyIncome
                  ? `KYD ${application.monthlyIncome.toString()}`
                  : null
              }
            />
            <Row
              label="Desired move-in"
              value={
                application.desiredMoveIn
                  ? formatDate(application.desiredMoveIn, tz)
                  : null
              }
            />
            <Row
              label="Occupants"
              value={
                application.occupants != null
                  ? String(application.occupants)
                  : null
              }
            />
            <Row label="Submitted" value={formatDate(application.createdAt, tz)} />
            {application.decisionAt ? (
              <Row
                label="Decided"
                value={formatDate(application.decisionAt, tz)}
              />
            ) : null}
          </div>
          {application.references ? (
            <div className="mt-4">
              <p className="text-sm font-medium text-slate-700">References</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                {application.references}
              </p>
            </div>
          ) : null}
          {application.notes ? (
            <div className="mt-4">
              <p className="text-sm font-medium text-slate-700">Notes</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                {application.notes}
              </p>
            </div>
          ) : null}
          {application.decisionNote ? (
            <div className="mt-4">
              <p className="text-sm font-medium text-slate-700">Decision note</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-slate-600">
                {application.decisionNote}
              </p>
            </div>
          ) : null}
        </section>

        <section className="rounded-xl bg-white border shadow-sm p-4">
          <p className="font-medium">Decision</p>
          {inviteUrl ? (
            <div className="mt-3 rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-sm font-medium text-emerald-800">
                Tenant invitation created
              </p>
              <input
                readOnly
                value={inviteUrl}
                className="mt-2 w-full rounded border border-emerald-200 bg-white px-3 py-2 text-xs text-slate-700"
              />
              <div className="mt-1">
                <CopyInviteLinkButton inviteUrl={inviteUrl} />
              </div>
            </div>
          ) : null}

          {!decidable ? (
            <p className="mt-3 text-sm text-slate-600">
              This application is {humanize(application.status).toLowerCase()} and
              can no longer be decided.
            </p>
          ) : (
            <div className="mt-4 space-y-4">
              {allowed.includes('UNDER_REVIEW') ? (
                <form action={decideApplicationAction}>
                  <input
                    type="hidden"
                    name="applicationId"
                    value={application.id}
                  />
                  <input
                    type="hidden"
                    name="decision"
                    value={TenantApplicationStatus.UNDER_REVIEW}
                  />
                  <button className="w-full rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50">
                    Mark under review
                  </button>
                </form>
              ) : null}

              <form action={decideApplicationAction} className="space-y-2">
                <input
                  type="hidden"
                  name="applicationId"
                  value={application.id}
                />
                <textarea
                  name="decisionNote"
                  rows={2}
                  placeholder="Optional decision note"
                  className="w-full rounded border border-slate-300 px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    name="decision"
                    value={TenantApplicationStatus.APPROVED}
                    className="flex-1 rounded bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700"
                  >
                    Approve
                  </button>
                  <button
                    name="decision"
                    value={TenantApplicationStatus.REJECTED}
                    className="flex-1 rounded border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Reject
                  </button>
                </div>
              </form>

              <form action={withdrawApplicationAction}>
                <input
                  type="hidden"
                  name="applicationId"
                  value={application.id}
                />
                <button className="w-full rounded border border-slate-200 px-4 py-2 text-sm text-slate-500 hover:bg-slate-50">
                  Withdraw application
                </button>
              </form>
            </div>
          )}
          <p className="mt-4 text-xs text-slate-500">
            Approving an application creates and emails a tenant invitation to
            the applicant.
          </p>
        </section>
      </div>
    </Shell>
  );
}
