import { NextResponse } from 'next/server';
import { getUser as getNetlifyIdentityUser } from '@netlify/identity';
import { UserStatus } from '@prisma/client';
import { createAppSession } from '@/lib/auth/session';
import { acceptTenantInvitation } from '@/lib/services/invitations';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = String(body?.token ?? '');
  const identityUser = await getNetlifyIdentityUser();
  const netlifyUserId = identityUser?.id ?? '';
  const email = String(identityUser?.email ?? '').toLowerCase();
  const fullName = body?.fullName ? String(body.fullName) : identityUser?.name ?? email;

  if (!token || !netlifyUserId || !email) {
    return NextResponse.json({ error: 'Invite token and a valid Netlify Identity session are required.' }, { status: 401 });
  }

  const result = await acceptTenantInvitation(token, email, fullName, netlifyUserId);
  if (result.user.status === UserStatus.DISABLED) {
    return NextResponse.json({ error: 'Account disabled.' }, { status: 403 });
  }

  await createAppSession(result.user.id);
  return NextResponse.json({ tenantId: result.tenant.id });
}
