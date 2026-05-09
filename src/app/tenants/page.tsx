import { RecordStatus } from '@prisma/client';
import { Shell } from '@/components/shell';
import { getCurrentLandlordWorkspace } from '@/lib/auth/guards';
import { prisma } from '@/lib/db/prisma';
import { inviteTenantAction } from '@/server/actions';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const { landlordId } = await getCurrentLandlordWorkspace();
  const [units, tenants, invitations] = await Promise.all([
    prisma.unit.findMany({ where: { landlordId, status: RecordStatus.ACTIVE }, include: { property: true }, orderBy: { unitName: 'asc' } }),
    prisma.tenant.findMany({ where: { landlordId, status: RecordStatus.ACTIVE }, orderBy: { createdAt: 'desc' } }),
    prisma.tenantInvitation.findMany({ where: { landlordId }, include: { unit: true }, orderBy: { createdAt: 'desc' }, take: 8 }),
  ]);

  return (
    <Shell title="Tenants">
      <form action={inviteTenantAction} className="grid md:grid-cols-4 gap-3 rounded-xl bg-white border shadow-sm p-4 mb-4">
        <input required name="email" type="email" placeholder="Tenant email" className="border rounded px-3 py-2" />
        <select name="unitId" className="border rounded px-3 py-2">
          <option value="">Optional unit</option>
          {units.map((unit) => <option key={unit.id} value={unit.id}>{unit.property.name} / {unit.unitName}</option>)}
        </select>
        <button className="rounded bg-brand-navy text-white px-4 py-2 md:col-span-2">Invite tenant</button>
      </form>
      <div className="grid lg:grid-cols-2 gap-4">
        <section className="rounded-xl bg-white border shadow-sm divide-y">
          {tenants.length === 0 ? <p className="p-4 text-slate-600">No active tenants yet.</p> : null}
          {tenants.map((tenant) => (
            <div key={tenant.id} className="p-4">
              <p className="font-medium">{tenant.fullName}</p>
              <p className="text-sm text-slate-600">{tenant.email}</p>
            </div>
          ))}
        </section>
        <section className="rounded-xl bg-white border shadow-sm divide-y">
          {invitations.length === 0 ? <p className="p-4 text-slate-600">No invitations yet.</p> : null}
          {invitations.map((invite) => (
            <div key={invite.id} className="p-4">
              <p className="font-medium">{invite.email}</p>
              <p className="text-sm text-slate-600">{invite.status} / token: {invite.inviteToken}</p>
            </div>
          ))}
        </section>
      </div>
    </Shell>
  );
}
