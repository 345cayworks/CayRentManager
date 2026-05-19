import Link from 'next/link';
import { RecordStatus, TenantApplicationStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { CopyInviteLinkButton } from '@/components/copy-invite-link';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { getEffectiveTimezone } from '@/lib/time/effective';
import { formatDate } from '@/lib/time/format';
import {
  createApplicationLinkAction,
  toggleApplicationLinkAction,
} from '@/server/application-actions';

export const dynamic = 'force-dynamic';

const STATUSES: TenantApplicationStatus[] = [
  TenantApplicationStatus.SUBMITTED,
  TenantApplicationStatus.UNDER_REVIEW,
  TenantApplicationStatus.APPROVED,
  TenantApplicationStatus.REJECTED,
  TenantApplicationStatus.WITHDRAWN,
];

function humanize(status: string) {
  return status
    .toLowerCase()
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default async function Page({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const { landlordId } = await getCurrentLandlordWorkspace();
  const tz = await getEffectiveTimezone();
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '');

  const statusFilter = STATUSES.find((value) => value === searchParams?.status);

  const [applications, links, properties, units] = await Promise.all([
    prisma.tenantApplication.findMany({
      where: { landlordId, ...(statusFilter ? { status: statusFilter } : {}) },
      include: {
        property: { select: { name: true } },
        unit: { select: { unitName: true, property: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
      take: 50,
    }),
    prisma.tenantApplicationLink.findMany({
      where: { landlordId },
      include: {
        property: { select: { name: true } },
        unit: { select: { unitName: true, property: { select: { name: true } } } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.property.findMany({
      where: { landlordId, status: RecordStatus.ACTIVE },
      orderBy: { name: 'asc' },
    }),
    prisma.unit.findMany({
      where: { landlordId, status: RecordStatus.ACTIVE },
      include: { property: true },
      orderBy: { unitName: 'asc' },
    }),
  ]);

  return (
    <Shell title="Applications">
      <section className="mb-6 rounded-xl bg-white border shadow-sm p-4">
        <p className="font-medium">Create an application link</p>
        <p className="mt-1 text-sm text-slate-600">
          Share a link so prospective tenants can apply. Approving an application
          creates a tenant invitation automatically.
        </p>
        <form
          action={createApplicationLinkAction}
          className="mt-4 grid gap-3 md:grid-cols-4"
        >
          <select name="propertyId" className="border rounded px-3 py-2">
            <option value="">Any property</option>
            {properties.map((property) => (
              <option key={property.id} value={property.id}>
                {property.name}
              </option>
            ))}
          </select>
          <select name="unitId" className="border rounded px-3 py-2">
            <option value="">Any unit</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.property.name} / {unit.unitName}
              </option>
            ))}
          </select>
          <input
            name="label"
            placeholder="Label (optional)"
            className="border rounded px-3 py-2"
          />
          <input
            name="expiresAt"
            type="date"
            className="border rounded px-3 py-2"
          />
          <button className="rounded bg-brand-navy text-white px-4 py-2 md:col-span-4">
            Create link
          </button>
        </form>
      </section>

      <div className="grid lg:grid-cols-2 gap-4">
        <section className="rounded-xl bg-white border shadow-sm">
          <div className="p-4 border-b">
            <p className="font-medium">Application links</p>
          </div>
          {links.length === 0 ? (
            <p className="p-4 text-slate-600">No application links yet.</p>
          ) : null}
          {links.map((link) => {
            const applyPath = `/apply/${link.token}`;
            const applyUrl = appUrl ? `${appUrl}${applyPath}` : applyPath;
            const location = link.unit
              ? `${link.unit.property.name} / ${link.unit.unitName}`
              : link.property
                ? link.property.name
                : 'Any property';
            return (
              <div key={link.id} className="p-4 border-t first:border-t-0">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-medium">{link.label || location}</p>
                    <p className="text-sm text-slate-600">{location}</p>
                  </div>
                  <span
                    className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${
                      link.active
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-slate-100 text-slate-600'
                    }`}
                  >
                    {link.active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                {link.expiresAt ? (
                  <p className="text-sm text-slate-600">
                    Expires {formatDate(link.expiresAt, tz)}
                  </p>
                ) : null}
                <input
                  readOnly
                  value={applyUrl}
                  className="mt-2 w-full rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
                />
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <CopyInviteLinkButton inviteUrl={applyUrl} />
                  <form action={toggleApplicationLinkAction}>
                    <input type="hidden" name="linkId" value={link.id} />
                    <input
                      type="hidden"
                      name="active"
                      value={link.active ? 'false' : 'true'}
                    />
                    <button
                      type="submit"
                      className="mt-2 inline-flex items-center justify-center rounded border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                    >
                      {link.active ? 'Deactivate' : 'Activate'}
                    </button>
                  </form>
                </div>
              </div>
            );
          })}
        </section>

        <section className="rounded-xl bg-white border shadow-sm">
          <div className="p-4 border-b">
            <p className="font-medium">Applications</p>
            <div className="mt-3 flex flex-wrap gap-2 text-xs">
              <Link
                href="/applications"
                className={`rounded-full px-3 py-1 font-medium ${
                  !statusFilter
                    ? 'bg-brand-navy text-white'
                    : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
              >
                All
              </Link>
              {STATUSES.map((status) => (
                <Link
                  key={status}
                  href={`/applications?status=${status}`}
                  className={`rounded-full px-3 py-1 font-medium ${
                    statusFilter === status
                      ? 'bg-brand-navy text-white'
                      : 'border border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  {humanize(status)}
                </Link>
              ))}
            </div>
          </div>
          {applications.length === 0 ? (
            <p className="p-4 text-slate-600">No applications yet.</p>
          ) : null}
          {applications.map((application) => {
            const location = application.unit
              ? `${application.unit.property.name} / ${application.unit.unitName}`
              : application.property
                ? application.property.name
                : 'Unassigned';
            return (
              <div key={application.id} className="p-4 border-t first:border-t-0">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <Link
                      href={`/applications/${application.id}`}
                      className="font-medium text-brand-navy"
                    >
                      {application.applicantName}
                    </Link>
                    <p className="text-sm text-slate-600">{application.email}</p>
                    <p className="text-sm text-slate-600">{location}</p>
                  </div>
                  <div className="text-right">
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                      {humanize(application.status)}
                    </span>
                    <p className="mt-2 text-xs text-slate-500">
                      {formatDate(application.createdAt, tz)}
                    </p>
                  </div>
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </Shell>
  );
}
