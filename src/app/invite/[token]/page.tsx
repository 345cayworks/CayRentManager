import { InvitationStatus } from '@prisma/client';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/db/prisma';
import { acceptTenantInviteAction } from '@/server/actions';

export const dynamic = 'force-dynamic';

export default async function InviteTokenPage({ params }: { params: { token: string } }) {
  const invitation = await prisma.tenantInvitation.findUnique({
    where: { inviteToken: params.token },
    include: { landlord: true, unit: true },
  });

  if (!invitation) notFound();
  const expired = invitation.expiresAt < new Date();
  const disabled = invitation.status !== InvitationStatus.PENDING || expired;

  return (
    <main className="min-h-screen bg-slate-50 p-8">
      <div className="max-w-xl mx-auto rounded-xl bg-white border shadow-sm p-6">
        <h1 className="text-2xl font-semibold">Accept tenant invitation</h1>
        <p className="text-sm text-slate-600 mt-2">{invitation.landlord.displayName}{invitation.unit ? ` / ${invitation.unit.unitName}` : ''}</p>
        {disabled ? (
          <p className="mt-6 text-red-700">This invitation is no longer active.</p>
        ) : (
          <form action={acceptTenantInviteAction.bind(null, params.token)} className="mt-6 grid gap-3">
            <input required name="fullName" placeholder="Full name" className="border rounded px-3 py-2" />
            <input required name="email" type="email" placeholder={invitation.email} className="border rounded px-3 py-2" />
            <button className="rounded bg-brand-navy text-white px-4 py-2">Accept invite</button>
          </form>
        )}
      </div>
    </main>
  );
}
