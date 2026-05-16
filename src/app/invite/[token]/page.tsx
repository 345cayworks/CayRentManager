import { InvitationStatus } from '@prisma/client';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { TenantInviteAuthForm } from '@/components/tenant-invite-auth-form';
import { prisma } from '@/lib/db/prisma';

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
    <main className="flex min-h-screen items-center justify-center bg-white px-4 py-12 text-slate-900 sm:px-6">
      <div className="w-full max-w-md">
        <Link
          href="/"
          className="inline-flex text-base font-semibold tracking-tight text-brand-navy"
        >
          CayRentManager
        </Link>
        <p className="mt-6 text-xs font-medium uppercase tracking-wide text-cyan-700">
          Tenant invitation
        </p>
        <h1 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl">
          Accept your invitation
        </h1>
        <p className="mt-2 text-sm leading-6 text-slate-600">
          {invitation.landlord.displayName}
          {invitation.unit ? ` · ${invitation.unit.unitName}` : ''}
        </p>

        <div className="mt-8 rounded-xl border border-slate-200 bg-white p-6">
          {disabled ? (
            <p className="text-sm leading-6 text-brand-danger">
              This invitation is no longer active. Please ask your landlord to
              send a new invitation.
            </p>
          ) : (
            <TenantInviteAuthForm token={params.token} invitedEmail={invitation.email} />
          )}
        </div>

        <div className="mt-6 flex flex-wrap gap-x-5 gap-y-2 text-xs">
          <Link
            href="/terms"
            className="text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
          >
            Terms
          </Link>
          <Link
            href="/privacy"
            className="text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
          >
            Privacy
          </Link>
          <Link
            href="/"
            className="text-slate-500 hover:text-slate-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-600"
          >
            Home
          </Link>
        </div>
      </div>
    </main>
  );
}
