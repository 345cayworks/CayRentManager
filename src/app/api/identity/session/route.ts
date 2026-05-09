import { NextResponse } from 'next/server';
import { UserStatus } from '@prisma/client';
import { createAppSession } from '@/lib/auth/session';
import { syncIdentityUser } from '@/lib/identity/sync';

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const netlifyUserId = String(body?.netlifyUserId ?? '');
  const email = String(body?.email ?? '').toLowerCase();
  const fullName = body?.fullName ? String(body.fullName) : null;

  if (!netlifyUserId || !email) {
    return NextResponse.json({ error: 'Netlify Identity user id and email are required.' }, { status: 400 });
  }

  const { user, createdWorkspace } = await syncIdentityUser({ netlifyUserId, email, fullName });
  if (user.status === UserStatus.DISABLED) {
    return NextResponse.json({ error: 'Account disabled.' }, { status: 403 });
  }

  await createAppSession(user.id);
  return NextResponse.json({
    user: { id: user.id, email: user.email, role: user.role, status: user.status },
    createdWorkspace,
  });
}
