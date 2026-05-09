import { NextResponse } from 'next/server';
import { UserStatus } from '@prisma/client';
import { createAppSession } from '@/lib/auth/session';
import { acceptTenantInvitation } from '@/lib/services/invitations';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const token = String(body?.token ?? '');
  const netlifyUserId = String(body?.netlifyUserId ?? '');
  const email = String(body?.email ?? '').toLowerCase();
  const fullName = body?.fullName ? String(body.fullName) : email;

  if (!token || !netlifyUserId || !email) {
    return NextResponse.json({ error: 'Invite token, Identity id, and email are required.' }, { status: 400 });
  }

  const result = await acceptTenantInvitation(token, email, fullName, netlifyUserId);
  if (result.user.status === UserStatus.DISABLED) {
    return NextResponse.json({ error: 'Account disabled.' }, { status: 403 });
  }

  await createAppSession(result.user.id);
  return NextResponse.json({ tenantId: result.tenant.id });
}
