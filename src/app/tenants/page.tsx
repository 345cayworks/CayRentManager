import { RecordStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { deactivateTenantAction, inviteTenantAction } from '@/server/actions';
import { CopyInviteLinkButton } from '@/components/copy-invite-link';

export const dynamic = 'force-dynamic';

function formatDate(value: Date | null | undefined) {
  return value ? new Date(value).toLocaleString() : 'n/a';
}

function humanizeStatus(status: string) {
  return status.charAt(0) + status.slice(1).toLowerCase();
}

export default async function Page() {
  const { landlordId } = await getCurrentLandlordWorkspace();
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
                <p className="font-medium">{tenant.fullName}</p>
                <p className="text-sm text-slate-600">{tenant.email}</p>
              </div>
              <form action={deactivateTenantAction}>
                <input type="hidden" name="tenantId" value={tenant.id} />
                <button className="text-sm rounded border px-3 py-1">Deactivate</button>
              </form>
            </div>
          ))}
        </section>
        <section className="rounded-xl bg-white border shadow-sm divide-y">
          <div className="p-4">
            <p className="font-medium">Tenant invitations</p>
            <p className="mt-2 text-sm text-slate-600">
              Email sending is not enabled yet. Copy the invite link and send it to the tenant manually.
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
                    <span className="font-medium">Created:</span> {formatDate(invite.createdAt)}
                  </div>
                  <div>
                    <span className="font-medium">Expires:</span> {formatDate(invite.expiresAt)}
                  </div>
                  {invite.acceptedAt ? (
                    <div>
                      <span className="font-medium">Accepted:</span> {formatDate(invite.acceptedAt)}
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
                  <CopyInviteLinkButton inviteUrl={inviteUrl} />
                </div>
              </div>
            );
          })}
        </section>
      </div>
    </Shell>
  );
}
