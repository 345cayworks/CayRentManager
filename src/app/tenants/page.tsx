import Link from 'next/link';
import { RecordStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { ConfirmButton } from '@/components/ui/confirm-button';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { deactivateTenantAction, inviteTenantAction, resendTenantInviteAction } from '@/server/actions';
import { CopyInviteLinkButton } from '@/components/copy-invite-link';
import { getEffectiveTimezone } from '@/lib/time/effective';
import { formatDateTime } from '@/lib/time/format';

export const dynamic = 'force-dynamic';

function humanizeStatus(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export default async function Page() {
  const { landlordId } = await getCurrentLandlordWorkspace();
  const tz = await getEffectiveTimezone();
  const fmt = (v: Date | null | undefined) => (v ? formatDateTime(v, tz) : 'n/a');
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.replace(/\/+$/, '');
  const [units, tenants, invitations] = await Promise.all([
    prisma.unit.findMany({ where: { landlordId, status: RecordStatus.ACTIVE }, include: { property: true }, orderBy: { unitName: 'asc' } }),
    prisma.tenant.findMany({ where: { landlordId, status: RecordStatus.ACTIVE }, orderBy: { createdAt: 'desc' } }),
    prisma.tenantInvitation.findMany({
      where: { landlordId },
      include: { unit: { include: { property: true } }, property: true },
      orderBy: { createdAt: 'desc' },
      take: 8,
    }),
  ]);

  return (
    <Shell title="Tenants">
      <form action={inviteTenantAction} className="grid md:grid-cols-4 gap-3 rounded-xl bg-white border shadow-sm p-4 mb-4">
        <input required name="email" type="email" placeholder="Tenant email" className="border rounded px-3 py-2" />
        <select name="unitId" className="border rounded px-3 py-2">
          <option value="">Optional unit</option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.property.name} / {unit.unitName}
            </option>
          ))}
        </select>
        <button className="rounded bg-brand-navy text-white px-4 py-2 md:col-span-2">Invite tenant</button>
      </form>
      <div className="grid lg:grid-cols-2 gap-4">
        <section className="rounded-xl bg-white border shadow-sm divide-y">
          {tenants.length === 0 ? <p className="p-4 text-slate-600">No active tenants yet.</p> : null}
          {tenants.map((tenant) => (
            <div key={tenant.id} className="p-4 flex justify-between gap-4">
              <div>
                <Link href={`/tenants/${tenant.id}`} className="font-medium text-brand-navy">
                  {tenant.fullName}
                </Link>
                <p className="text-sm text-slate-600">{tenant.email}</p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/tenants/${tenant.id}?edit=1#edit`}
                  className="text-sm rounded border border-slate-200 bg-white px-3 py-1 text-slate-700 hover:bg-slate-50"
                >
                  Edit
                </Link>
                <form action={deactivateTenantAction}>
                  <input type="hidden" name="tenantId" value={tenant.id} />
                  <ConfirmButton
                    message={`Deactivate ${tenant.fullName ?? 'this tenant'}? They will lose portal access.`}
                    className="text-sm rounded border border-slate-200 px-3 py-1 text-slate-500 hover:bg-slate-50"
                  >
                    Deactivate
                  </ConfirmButton>
                </form>
              </div>
            </div>
          ))}
        </section>
        <section className="rounded-xl bg-white border shadow-sm divide-y">
          <div className="p-4">
            <p className="font-medium">Tenant invitations</p>
            <p className="mt-2 text-sm text-slate-600">
              An invite email is sent automatically. You can also copy the link below or resend the email.
            </p>
          </div>
          {invitations.length === 0 ? (
            <p className="p-4 text-slate-600">No invitations yet.</p>
          ) : null}
          {invitations.map((invite) => {
            const invitePath = `/invite/${invite.inviteToken}`;
            const inviteUrl = appUrl ? `${appUrl}${invitePath}` : invitePath;
            const location = invite.unit
              ? `${invite.unit.property.name} / ${invite.unit.unitName}`
              : invite.property
              ? invite.property.name
              : 'Unassigned';

            return (
              <div key={invite.id} className="p-4 border-t last:border-b">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-medium">{invite.email}</p>
                    <p className="text-sm text-slate-600">{location}</p>
                  </div>
                  <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">
                    {humanizeStatus(invite.status)}
                  </span>
                </div>
                <div className="grid gap-2 text-sm text-slate-700">
                  <div>
                    <span className="font-medium">Created:</span> {fmt(invite.createdAt)}
                  </div>
                  <div>
                    <span className="font-medium">Expires:</span> {fmt(invite.expiresAt)}
                  </div>
                  {invite.acceptedAt ? (
                    <div>
                      <span className="font-medium">Accepted:</span> {fmt(invite.acceptedAt)}
                    </div>
                  ) : null}
                  <div>
                    <span className="font-medium">Invite link:</span>
                    <input
                      readOnly
                      value={inviteUrl}
                      className="mt-2 w-full rounded border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700"
                    />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CopyInviteLinkButton inviteUrl={inviteUrl} />
                    {invite.status === 'PENDING' ? (
                      <form action={resendTenantInviteAction}>
                        <input type="hidden" name="invitationId" value={invite.id} />
                        <button
                          type="submit"
                          className="text-sm rounded border border-slate-200 bg-white px-3 py-1 text-slate-700 hover:bg-slate-50"
                        >
                          Resend email
                        </button>
                      </form>
                    ) : null}
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
