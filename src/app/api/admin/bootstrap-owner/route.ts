import { NextResponse } from 'next/server';
import { getUser as getNetlifyIdentityUser } from '@netlify/identity';
import { bootstrapPrimaryOwner, PRIMARY_SUPERADMIN_EMAIL } from '@/lib/identity/sync';

export async function POST() {
  const identityUser = await getNetlifyIdentityUser();
  const netlifyUserId = identityUser?.id ?? '';
  const email = String(identityUser?.email ?? '').toLowerCase();

  if (!netlifyUserId || !email) {
    return NextResponse.json({ error: 'A valid Netlify Identity session is required.' }, { status: 401 });
  }

  if (email !== PRIMARY_SUPERADMIN_EMAIL) {
    return NextResponse.json({ error: 'Only the primary platform owner can be bootstrapped.' }, { status: 403 });
  }

  const user = await bootstrapPrimaryOwner({
    netlifyUserId,
    email,
    fullName: identityUser?.name ?? 'Platform Owner',
  });

  return NextResponse.json({
    user: { id: user.id, email: user.email, role: user.role, status: user.status },
  });
}
